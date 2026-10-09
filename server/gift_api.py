"""
Medal gift resolver — turns a Telegram collectible link (https://t.me/nft/LootBag-7631)
into JSON the web app can render.

Why this exists: the Bot API cannot resolve /nft/ links. Telegram only exposes
payments.getUniqueStarGift to a logged-in *user* session (MTProto), so this runs
server-side with a Telethon user client. The session file never leaves the server
and the browser only ever talks to this API.

Endpoints
  GET /api/health
  GET /api/gift/{slug}             JSON (cached CACHE_TTL seconds; 404 on STARGIFT_SLUG_INVALID)
  GET /api/gift?link=https://t.me/nft/{slug}
  GET /api/gift/{slug}/image       model thumbnail (webp/png) — cached on disk
  GET /api/gift/{slug}/animation   model animation (.tgs = gzipped Lottie JSON)
  GET /api/gift/{slug}/pattern     pattern (symbol) thumbnail

Run
  cp .env.example .env            # fill API_ID / API_HASH from https://my.telegram.org
  pip install -r requirements.txt
  python login.py                 # once: phone → code → (2FA) → writes gift.session
  uvicorn gift_api:app --host 127.0.0.1 --port 8787
"""
from __future__ import annotations

import asyncio
import os
import re
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from telethon import TelegramClient, errors, functions, types

load_dotenv()

API_ID = int(os.environ["API_ID"])
API_HASH = os.environ["API_HASH"]
SESSION = os.environ.get("SESSION", "gift")                 # gift.session next to this file
CACHE_TTL = int(os.environ.get("CACHE_TTL", "300"))         # 5 minutes, per slug
NEG_TTL = int(os.environ.get("NEG_CACHE_TTL", "60"))        # cache "not found" briefly
MEDIA_DIR = Path(os.environ.get("MEDIA_DIR", "cache"))
ALLOWED_ORIGINS = [o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "https://play.medal.poker").split(",") if o.strip()]
PUBLIC_BASE = os.environ.get("PUBLIC_BASE", "/api").rstrip("/")   # how the browser reaches this API

SLUG_RE = re.compile(r"^[A-Za-z0-9]{1,64}-\d{1,9}$")
LINK_RE = re.compile(r"(?:https?://)?(?:www\.)?t\.me/nft/([A-Za-z0-9]+-\d+)", re.I)

client = TelegramClient(SESSION, API_ID, API_HASH)
_cache: dict[str, tuple[float, Any]] = {}
_locks: dict[str, asyncio.Lock] = {}
MEDIA_DIR.mkdir(parents=True, exist_ok=True)


def parse_slug(value: str) -> str:
    """Accept 'LootBag-7631' or any t.me/nft/LootBag-7631 link; return the slug or raise 400."""
    value = (value or "").strip()
    m = LINK_RE.search(value)
    slug = m.group(1) if m else value
    if not SLUG_RE.match(slug):
        raise HTTPException(400, "Expected a slug like LootBag-7631 or a https://t.me/nft/… link")
    return slug


def hex_color(n: int | None) -> str | None:
    return None if n is None else "#%06x" % (n & 0xFFFFFF)


def peer_info(peer, users: dict, chats: dict) -> dict | None:
    if peer is None:
        return None
    if isinstance(peer, types.PeerUser):
        u = users.get(peer.user_id)
        name = " ".join(x for x in [getattr(u, "first_name", None), getattr(u, "last_name", None)] if x) if u else None
        return {"type": "user", "id": peer.user_id, "username": getattr(u, "username", None), "name": name,
                "label": ("@" + u.username) if (u and u.username) else (name or "Telegram user")}
    cid = getattr(peer, "channel_id", None) or getattr(peer, "chat_id", None)
    c = chats.get(cid)
    return {"type": "channel", "id": cid, "username": getattr(c, "username", None), "name": getattr(c, "title", None),
            "label": ("@" + c.username) if (c and c.username) else (getattr(c, "title", None) or "Telegram channel")}


def stars_amounts(items) -> list[dict] | None:
    if not items:
        return None
    out = []
    for a in items:
        if isinstance(a, types.StarsTonAmount):
            out.append({"currency": "TON", "amount": a.amount / 1e9})
        elif isinstance(a, types.StarsAmount):
            out.append({"currency": "XTR", "amount": a.amount + (a.nanos or 0) / 1e9})
    return out or None


def serialize(r, slug: str) -> dict:
    g = r.gift
    users = {u.id: u for u in getattr(r, "users", [])}
    chats = {c.id: c for c in getattr(r, "chats", [])}
    attrs: dict[str, Any] = {"model": None, "pattern": None, "backdrop": None, "original_details": None}
    docs: dict[str, int] = {}
    for a in g.attributes:
        if isinstance(a, types.StarGiftAttributeModel):
            attrs["model"] = {"name": a.name, "rarity_permille": a.rarity_permille, "rarity": f"{a.rarity_permille / 10:g}%"}
            docs["model"] = a.document.id
        elif isinstance(a, types.StarGiftAttributePattern):
            attrs["pattern"] = {"name": a.name, "rarity_permille": a.rarity_permille, "rarity": f"{a.rarity_permille / 10:g}%"}
            docs["pattern"] = a.document.id
        elif isinstance(a, types.StarGiftAttributeBackdrop):
            attrs["backdrop"] = {
                "name": a.name, "rarity_permille": a.rarity_permille, "rarity": f"{a.rarity_permille / 10:g}%",
                "backdrop_id": getattr(a, "backdrop_id", None),
                "colors": {"center": hex_color(a.center_color), "edge": hex_color(a.edge_color),
                           "pattern": hex_color(a.pattern_color), "text": hex_color(a.text_color)},
            }
        elif isinstance(a, types.StarGiftAttributeOriginalDetails):
            attrs["original_details"] = {
                "sender": peer_info(getattr(a, "sender_id", None), users, chats),
                "recipient": peer_info(getattr(a, "recipient_id", None), users, chats),
                "date": int(a.date.timestamp()) if getattr(a, "date", None) else None,
                "message": getattr(getattr(a, "message", None), "text", None),
            }

    owner: dict | None = peer_info(getattr(g, "owner_id", None), users, chats)
    if owner is None and getattr(g, "owner_name", None):
        owner = {"type": "hidden", "name": g.owner_name, "label": g.owner_name}
    if owner is None and getattr(g, "owner_address", None):
        owner = {"type": "address", "address": g.owner_address, "label": g.owner_address[:6] + "…" + g.owner_address[-4:]}

    value = None
    if getattr(g, "value_amount", None) is not None and getattr(g, "value_currency", None):
        value = {"amount": g.value_amount / 100, "currency": g.value_currency}

    base = f"{PUBLIC_BASE}/gift/{slug}"
    return {
        "slug": g.slug, "title": g.title, "num": g.num, "id": str(g.id),
        "link": f"https://t.me/nft/{g.slug}",
        "owner": owner,
        "availability_issued": g.availability_issued, "availability_total": g.availability_total,
        "attributes": attrs,
        "gift_address": getattr(g, "gift_address", None),
        "resell_amount": stars_amounts(getattr(g, "resell_amount", None)),
        "resale_ton_only": bool(getattr(g, "resale_ton_only", False)),
        "require_premium": bool(getattr(g, "require_premium", False)),
        "released_by": peer_info(getattr(g, "released_by", None), users, chats),
        "value": value,
        "images": {
            "thumb": f"{base}/image" if "model" in docs else None,
            "animation": f"{base}/animation" if "model" in docs else None,
            "pattern": f"{base}/pattern" if "pattern" in docs else None,
        },
        "_docs": docs,                       # stripped before sending; used by the media endpoints
        "fetched_at": int(time.time()), "cache_ttl": CACHE_TTL,
    }


async def resolve(slug: str) -> dict:
    """Cached lookup. Raises HTTPException(404) for unknown slugs."""
    now = time.time()
    hit = _cache.get(slug)
    if hit and hit[0] > now:
        if hit[1] is None:
            raise HTTPException(404, "Gift not found")
        return hit[1]
    lock = _locks.setdefault(slug, asyncio.Lock())
    async with lock:
        hit = _cache.get(slug)
        if hit and hit[0] > now:
            if hit[1] is None:
                raise HTTPException(404, "Gift not found")
            return hit[1]
        try:
            r = await client(functions.payments.GetUniqueStarGiftRequest(slug=slug))
        except errors.FloodWaitError as e:
            raise HTTPException(429, f"Telegram asks to wait {e.seconds}s", headers={"Retry-After": str(e.seconds)})
        except errors.RPCError as e:
            if "STARGIFT_SLUG_INVALID" in str(getattr(e, "message", e)):
                _cache[slug] = (now + NEG_TTL, None)
                raise HTTPException(404, "Gift not found")
            raise HTTPException(502, f"Telegram error: {getattr(e, 'message', e)}")
        data = serialize(r, slug)
        _cache[slug] = (now + CACHE_TTL, data)
        return data


async def media_bytes(slug: str, kind: str) -> tuple[bytes, str]:
    data = await resolve(slug)
    doc_key = "pattern" if kind == "pattern" else "model"
    doc_id = data["_docs"].get(doc_key)
    if not doc_id:
        raise HTTPException(404, "No media for this gift")
    want_thumb = kind in ("image", "pattern")
    path = MEDIA_DIR / f"doc-{doc_id}-{'thumb' if want_thumb else 'anim'}.bin"
    if path.exists():
        return path.read_bytes(), ("image/webp" if want_thumb else "application/x-tgsticker")
    # the document object is only reachable through a fresh (or cached) TL result: refetch when needed
    r = await client(functions.payments.GetUniqueStarGiftRequest(slug=slug))
    doc = None
    for a in r.gift.attributes:
        if doc_key == "model" and isinstance(a, types.StarGiftAttributeModel):
            doc = a.document
        if doc_key == "pattern" and isinstance(a, types.StarGiftAttributePattern):
            doc = a.document
    if doc is None:
        raise HTTPException(404, "No media for this gift")
    blob = await client.download_media(doc, file=bytes, thumb=(-1 if want_thumb else None))
    if not blob:
        raise HTTPException(502, "Could not download media")
    path.write_bytes(blob)
    mime = "image/webp" if want_thumb else "application/x-tgsticker"
    if want_thumb and blob[:4] == b"\x89PNG":
        mime = "image/png"
    elif want_thumb and blob[:2] == b"\xff\xd8":
        mime = "image/jpeg"
    return blob, mime


@asynccontextmanager
async def lifespan(_: FastAPI):
    await client.connect()
    if not await client.is_user_authorized():
        raise RuntimeError("No Telegram session. Run `python login.py` once on this server first.")
    me = await client.get_me()
    print(f"gift_api: logged in as {me.username or me.id}; CORS → {ALLOWED_ORIGINS}")
    yield
    await client.disconnect()


app = FastAPI(title="Medal gift resolver", lifespan=lifespan, docs_url=None, redoc_url=None)
app.add_middleware(CORSMiddleware, allow_origins=ALLOWED_ORIGINS, allow_methods=["GET"], allow_headers=["*"], max_age=600)


def public(data: dict) -> dict:
    return {k: v for k, v in data.items() if not k.startswith("_")}


@app.get("/api/health")
async def health():
    return {"ok": True, "authorized": await client.is_user_authorized(), "cached": len(_cache)}


@app.get("/api/gift")
async def gift_by_link(link: str = Query(..., description="https://t.me/nft/LootBag-7631")):
    data = await resolve(parse_slug(link))
    return JSONResponse(public(data), headers={"Cache-Control": "public, max-age=60"})


@app.get("/api/gift/{slug}")
async def gift(slug: str):
    data = await resolve(parse_slug(slug))
    return JSONResponse(public(data), headers={"Cache-Control": "public, max-age=60"})


@app.get("/api/gift/{slug}/{kind}")
async def gift_media(slug: str, kind: str):
    if kind not in ("image", "animation", "pattern"):
        raise HTTPException(404, "Unknown media kind")
    blob, mime = await media_bytes(parse_slug(slug), kind)
    return Response(blob, media_type=mime, headers={"Cache-Control": "public, max-age=86400, immutable"})


@app.exception_handler(HTTPException)
async def http_error(_: Request, exc: HTTPException):
    return JSONResponse({"error": exc.detail, "status": exc.status_code}, status_code=exc.status_code, headers=getattr(exc, "headers", None))
