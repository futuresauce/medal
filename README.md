# play.medal.poker — front-end build v5 (9 Oct 2026)

Browser version of the Medal Telegram Mini App, built as the front-end body for the developers.
Static front-end (this repo's root) plus one small backend (`server/`, the Telegram gift resolver, runs on the VPS). All game numbers are placeholder data.

## Files (this repository — github.com/futuresauce/medal)

The repository root **is** the deployable site, so a host pointed at the root (Cloudflare Workers / Pages, Netlify, GitHub Pages)
serves it with no build step. Edit the sources in `src/`, run `python3 tools/build.py`, commit.

```
index.html, styles.css, app.js   built from src/ with root-absolute paths (so /table/t2 and /gift/… load assets)
404.html                         copy of index.html: hosts that serve 404.html for unknown paths still boot the app on deep links
assets/                          brand marks, game art crops from the Figma, 52-card deck (card-{rank}{S|H|D|C}.webp), gift-pepe.webp
robots.txt                       Disallow all — keep while this is a test deployment
_headers                         Netlify / Cloudflare headers: noindex + basic hardening
.assetsignore                    Cloudflare: keeps src/, server/, tools/ and zips out of the uploaded assets
src/                             index.html · styles.css · app.js with relative paths (double-click index.html to preview locally)
tools/                           build.py (src/ → root files + dist/preview.html), build_icons.py + icon-sources/ (regenerates the icon sprite)
server/                          Telegram gift resolver (FastAPI + Telethon) — see below
```

## URLs: with or without the `#`

Both work. Served from a real origin, the app uses clean paths (`/poker`, `/table/t2`, `/giveaway/g1`) through the History API;
the `_redirects` file makes the host serve `index.html` for every path (Cloudflare Pages and Netlify read it as-is; on nginx use
`try_files $uri /index.html;`). Opened as a local file, or on a host without that rule, it falls back to hash routes
(`#poker`, `#table-t2`). Old `#` links are redirected to the clean path on load. The switch is the `data-routing="path"`
attribute on `#frame`; remove it to force hash routing.

Deep links on a refresh need the host to fall back to the app: **Cloudflare Workers** (static assets) → Settings → Assets →
*Not found handling: Single-page application* (or `"not_found_handling": "single-page-application"` in `wrangler.jsonc`);
**Cloudflare Pages / Netlify** → add a `_redirects` file at the root containing `/*  /index.html  200`; **GitHub Pages** → nothing,
it serves `404.html`, which is a copy of the app.

## Putting it on a domain for viewing

The root of this repo is a static site: nothing to compile.

1. **Cloudflare (recommended; the zone for medal.poker is already there).** Workers & Pages → Create → *Connect to Git* → this repo.
   Build command **empty**, deploy/output directory **`/`** (the root). Then *Custom domains* → add `play.medal.poker`; Cloudflare
   writes the CNAME itself. Keep it team-only with a Zero Trust Access policy (free up to 50 users, email one-time code).
   Every push to `main` redeploys. Turn on single-page-application not-found handling as described above.
2. **Netlify.** *Import from Git* → this repo → publish directory `/`, no build command → `*.netlify.app` → *Domain settings* →
   add `play.medal.poker` → CNAME in Cloudflare DNS. Add `_redirects` (`/*  /index.html  200`) for clean deep links.
3. **GitHub Pages.** Repo *Settings → Pages → Deploy from branch → main / (root)*. Deep links work through `404.html`.

The page sets `noindex` in both the HTML and `_headers`, so search engines will not pick up the test. The Google Fonts request
(Rubik) works on any real domain. The real Telegram Login only works once `https://play.medal.poker` is registered in @BotFather,
which is not needed for a viewing test. Deploy at the **root** of a hostname (paths are `/assets/…`); for a sub-path deployment
add `<base href="/play/">` and change the paths.

## Working on it

```bash
# edit src/index.html, src/styles.css, src/app.js — then rebuild the root files and commit
python3 tools/build.py
git add -A && git commit -m "describe the change" && git push
```

`tools/build.py` writes the root `index.html`/`styles.css`/`app.js`/`404.html` (root-absolute paths) and `dist/preview.html`
(single file, relative paths, git-ignored). `tools/build_icons.py` regenerates the icon sprite inside `src/index.html` from
`tools/icon-sources/` — run `build.py` afterwards. `.gitignore` keeps `dist/`, the resolver's `.env`, session files and cache out
of the repo.

## Screens (routes)

`/` hub · `/poker` · `/table/:id` · `/games` · `/blackjack` · `/ring` · `/roulette` · `/chaos` · `/durak` ·
`/giveaways` · `/giveaway/:id` · `/gift/:slug` (Telegram collectible) · `/leaders` · `/inventory` · `/profile`
(hash equivalents: `#poker`, `#table-t2`, `#gift-LootBag-7631` …)

Modals: Telegram sign-in, wallet (deposit / withdraw), buy-in, chat rules, concept notes.

## Telegram gift resolver (`server/`)

`t.me/nft/LootBag-7631` links cannot be resolved with the Bot API. Telegram exposes `payments.getUniqueStarGift` only to a
logged-in **user** session (MTProto), so `server/gift_api.py` runs that call with a Telethon user client and the browser only
ever talks to this API. The session file never leaves the server.

Setup (once, on the VPS):

```bash
cd server && python3 -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt
cp .env.example .env        # API_ID / API_HASH from https://my.telegram.org (use a dedicated Telegram account)
python login.py             # phone → code → 2FA; writes gift.session (chmod 600, never commit)
uvicorn gift_api:app --host 127.0.0.1 --port 8787
```

`medal-gift.service` is a systemd unit; `nginx-gift.conf` serves the site files and proxies `/api/` on the same origin with a rate
limit. If the static site stays on Cloudflare Pages, run the API on `api.medal.poker` instead, set `ALLOWED_ORIGINS` and
`PUBLIC_BASE=https://api.medal.poker/api` in `.env`, and point the front end at it with
`<meta name="medal-api" content="https://api.medal.poker/api">` in `index.html`.

Endpoints:

| Route | Returns |
|-------|---------|
| `GET /api/gift/{slug}` or `GET /api/gift?link=https://t.me/nft/{slug}` | JSON: `title`, `slug`, `num`, `owner` (user/channel/hidden/address), `availability_issued`, `availability_total`, `attributes.model/pattern/backdrop` (name, `rarity_permille`, `rarity`, backdrop `colors`), `attributes.original_details`, `gift_address`, `resell_amount` (`XTR` stars / `TON`), `value`, `released_by`, `images`, `link` |
| `GET /api/gift/{slug}/image` | model thumbnail (webp/png), cached on disk |
| `GET /api/gift/{slug}/animation` | the model’s `.tgs` (gzipped Lottie) |
| `GET /api/gift/{slug}/pattern` | symbol thumbnail |
| `GET /api/health` | `{ok, authorized, cached}` |

Answers are cached per slug for `CACHE_TTL` (300 s); unknown slugs (`STARGIFT_SLUG_INVALID`) return **404** and are cached
for 60 s; Telegram flood waits become **429** with `Retry-After`. Slugs are validated (`^[A-Za-z0-9]+-\d+$`) before any call.

Front end: `/gift/:slug` fetches `{medal-api}/gift/:slug`, renders the card (backdrop gradient from the real backdrop colours,
model/symbol/backdrop with rarity, owner, supply, resale price, TON address, original sender) and an **Open in Telegram** link.
Animated gifts play through lottie-web (loaded on demand from cdnjs) after the `.tgs` is gunzipped with `DecompressionStream`;
if that fails the thumbnail stays. Entry points: the lookup box in the Gift center and on the gift page, `t.me/nft/…` links in
chat (rendered as gift chips) and “Collectible details” in Inventory. When the API is unreachable the page shows an amber
notice and the link-only card; when the slug is invalid it shows the not-found card. The browser never calls Telegram.

Gift tiles elsewhere render from `img` (a render on a radial backdrop) or fall back to an emoji; `assets/gift-pepe.webp` is the
example render. In production feed them from `/api/gift/{slug}/image`.

## Poker: lobby + multi-table workspace

`/poker` has two modes, switched by the Lobby / My tables segment in the page head (and `/poker/tables` as a route):

* **Lobby** – game tabs, one toolbar row (currency · stakes · Filters · search · Quick seat), the table list and the sticky
  selected-table preview. Row `Join` buttons are quiet until the row is hovered or selected.
* **My tables** – the window workspace. Watching or buying in opens the table as a window here (`openTable(id)`); a single
  table fills the canvas, two or more auto-tile (side by side on wide canvases, otherwise stacked, 2 columns up to four
  tables, 3 beyond). Windows drag by the title bar and resize from the bottom-right grip, which pins the layout; **Tile**
  returns to auto layout. Maximize (button or double-click on the title bar) brings one table forward and hides the rest;
  clicking another tab while maximized swaps it in. Layout, open tables and the maximized table persist in
  `localStorage` (`mp.ws`). Each window renders the shared table stage (`feltHTML` / `actionbarHTML`) on a 960×600 design
  canvas scaled with `transform` (`--s`), so seats, cards and the action bar keep their proportions at any window size.
  On phones (≤760px) a table opens in the portrait single-table view instead (`/table/:id`); `/poker/tables` there is a
  stacked overview, tap a window to open it.

Hooks: `TABLES`, `state.ws`, `renderWorkspace()`, `openTable()` / `closeTable()`. Table state for every open window will
come from the same WebSocket feed as the single view; the workspace only needs `feltHTML(t)` re-run per update.

## Guest mode

Every screen renders for guests. Anything that needs an account carries `data-gate` (or is one of the
gated actions listed in `app.js`): for a guest it opens the sign-in modal instead of acting, and remembers
a pending seat so the buy-in continues after sign-in.

## Chat auto-translate

The chat header is one row: a channel dropdown (Global · Poker · Русский · chat rules), the translate button and collapse. Collapsed, the chat is a 56px rail (open button with unread badge, online count); on `/poker` the rail stays fixed-width so the workspace keeps its space.
Translate opens a toggle plus a target language (EN, RU, ZH, AR, FA, ES, TR, DE), remembered per device; the button shows the
target flag while it is on, and picking a UI language in the top bar sets the same target.
Each message carries `lang` and a `tr` map of translations. When the toggle is on, a message in another language shows
`tr[target]` with a `RU → EN` tag; tapping the tag swaps back to the original. Messages without a translation show the original with a language tag.

Production: detect the language on ingest, translate server-side on demand (DeepL, Google Cloud Translation or Azure Translator all handle these eight), cache per (messageId, target) so a message is translated once per language, and only translate for viewers who have the toggle on. Moderation runs on the original text. The same component serves the per-table chat.

## Icons

The sprite inside `src/index.html` is generated by `tools/build_icons.py` from the Iconify dumps in `tools/icon-sources/` (fetched once; re-run the
script after editing the icon map). Weights: **Phosphor Bold** for secondary icons, **Phosphor Fill** for active nav, wallet, currency
chips and CTAs (`i-<name>` / `i-<name>-fill`; `.is-active` swaps to the filled glyph). Tabler supplies `swords`, Game Icons supplies the
GRAM gem (`cut-diamond`), the MEDAL shield-chip is a custom mark. Flags are `f-<cc>` symbols from lipis/flag-icons (4x3), used in the
language menu, the chat translate menu and the profile.

Licenses: Phosphor Icons MIT · Tabler Icons MIT · Game Icons CC BY 3.0 (credit game-icons.net in the site’s credits/footer) · flag-icons MIT.

## Hooks for the real implementation

| Area | Where | What to do |
|------|-------|------------|
| Sign-in | `simulateLogin()` in `app.js` | Replace with the Telegram Login library (`Telegram.Login.init/auth`), verify the ID token server-side, then call `applyAuth()` with the real user. |
| Wallet | `connect-wallet` action | TON Connect wallet picker; GRAM deposit/withdraw endpoints. MEDAL is not purchasable. |
| Tables | `TABLES` array, `renderLobby()`, `renderTable()` | Lobby list from the table service; table state (seats, board, pot, acting seat, timers) over WebSocket. |
| Chat | `CHAT`, `pushMsg()`, `sendChat()`, `applyTranslate()` | Global / Poker / RU channels, per-table chat, translation map per message. Moderation flags not built. |
| Games | `#blackjack #ring #roulette #chaos #durak` sections | Static game stages with bet boxes (`[data-betbox]`, chip strip, currency tabs). Replace with the game engines. |
| Giveaways | `GIVEAWAYS`, `renderGifts()`, `renderParticipants()` | Rounds, Rejoin Shield, invite links. |
| Inventory | `NFTS`, `renderNfts()` | Telegram Gift collectibles; withdraw confirmation is in-page. |
| Earn | `claim` / `promo` actions | Free MEDAL every 8h, daily bonus checks, referral share. |
| Languages | `setLang()` / `[data-lang]` | Sets `<html lang>`/`dir` and the chat target; English copy only. Add the EN/RU/ZH/AR/FA dictionary and swap strings at render time. |
| Game actions | `actionToast()` | Deal / Hit / Stand / Join round / Create room / Red-Green-Black show feedback toasts; replace with the game engines. |

## Design tokens (v5)

One accent: warm metal `--accent #d9a441` / `--accent-2 #f0c25c` (ink `#1b1200`) on primary buttons, MEDAL chips, rank 1 and
the acting-seat ring. GRAM is steel (`--steel #9fb3c8`, `--steel-soft`), so the two currencies read apart without a second
hue. Status green `#7fbf6a` is reserved for live dots and seat fill. Ground `#0b0c10` · surfaces `#0f1014 / #15161b /
#1b1c22 / #23242b` · felt `#32598b` · danger `#f04040`. Legacy names (`--blue`, `--azure`, `--gold`, `--tg`) alias the
accent, so older components inherit it. Spacing is an 8px scale (`--s1 … --s6`), radius 16 (`--r`), Rubik with tabular
numerals in tables and stats. Motion is limited to seat fill, row select and the chat rail; nothing loops.

Layout: sticky 64px top bar, 300px chat rail that collapses to a 56px rail (unread badge + online count) so it never covers
content; overlay below 1100px with the chat button in the top bar. Content up to 1320px. Below 760px the bottom nav mirrors
the Mini App (Hub · Poker · Games · Gifts · Leaders).
