# play.medal.poker — front-end build v3 (9 Oct 2026)

Browser version of the Medal Telegram Mini App, built as the front-end body for the developers.
No backend, no build step: open `index.html` in a browser (hash routes) or deploy the folder (clean URLs). All numbers are placeholder data.

## Files

```
index.html      markup for every screen (one page, hash-routed) + inline icon sprite
styles.css      design tokens, components, responsive rules
app.js          sample data, router, guest/sign-in state, chat rail + auto-translate, lobby, table, games, giveaways, inventory
assets/         brand marks (emblem, wordmark, lockup), game art crops from the Figma, full 52-card deck (card-{rank}{S|H|D|C}.webp)
build_icons.py  regenerates the icon sprite (Phosphor / Tabler / Game Icons / flag-icons, see Icons)
robots.txt      Disallow all — keep while this is a test deployment
_headers        Netlify / Cloudflare Pages headers: noindex + basic hardening
_redirects      SPA fallback (`/* /index.html 200`) so /poker, /table/t2 … load directly
icon-sources/   Iconify dumps of Phosphor, Tabler, Game Icons and flag-icons used by build_icons.py
```

## URLs: with or without the `#`

Both work. Served from a real origin, the app uses clean paths (`/poker`, `/table/t2`, `/giveaway/g1`) through the History API;
the `_redirects` file makes the host serve `index.html` for every path (Cloudflare Pages and Netlify read it as-is; on nginx use
`try_files $uri /index.html;`). Opened as a local file, or on a host without that rule, it falls back to hash routes
(`#poker`, `#table-t2`). Old `#` links are redirected to the clean path on load. The switch is the `data-routing="path"`
attribute on `#frame`; remove it to force hash routing.

## Putting it on a domain for viewing

The folder is a static site: upload it as-is, nothing to compile.

1. **Cloudflare Pages (recommended).** Cloudflare already fronts medal.app / medal.poker. Pages → Create → *Upload assets* → drop the `play-medal-poker` folder. You get `<project>.pages.dev` in about a minute. Then *Custom domains* → add `play.medal.poker` (or `preview.medal.poker`); because the zone is in the same account Cloudflare writes the CNAME itself. To keep it team-only, add a Zero Trust Access policy (free up to 50 users, email one-time code) in front of the hostname.
2. **Netlify (what medal.app used before).** Drag the folder onto app.netlify.com → `*.netlify.app` URL → *Domain settings* → add `play.medal.poker` → create the CNAME in Cloudflare DNS pointing at the Netlify subdomain. Password protection needs a paid plan, so use option 1's Access policy if it must stay private.
3. **Sub-path of the existing site.** Copy the folder into the current site's `dist/play/` and redeploy → `medal.app/play/`. No DNS, but it mixes the concept with production.

The page sets `noindex` in both the HTML and `_headers`, so search engines will not pick up the test. The Google Fonts request (Rubik) works on any real domain. The real Telegram Login only works once `https://play.medal.poker` is registered in @BotFather, which is not needed for a viewing test.

## Screens (hash routes)

`#hub` · `#poker` (lobby) · `#table` (poker table) · `#games` · `#blackjack` · `#ring` · `#roulette` · `#chaos` · `#durak` ·
`#giveaways` · `#giveaway` (detail) · `#leaders` (boards + events) · `#inventory` · `#profile`

Modals: Telegram sign-in, wallet (deposit / withdraw), buy-in, chat rules, concept notes.

## Telegram gifts / NFTs

Gift tiles render from `img` (a PNG/WebP render on a radial backdrop) or fall back to an emoji. `assets/gift-pepe.webp` is the
example render (Plush Pepe, cut from the team’s giveaway banner). In production use the gift’s own image from the Telegram
Gifts API and the real Model / Symbol / Backdrop attributes; the floor value comes from the marketplace feed.

## Guest mode

Every screen renders for guests. Anything that needs an account carries `data-gate` (or is one of the
gated actions listed in `app.js`): for a guest it opens the sign-in modal instead of acting, and remembers
a pending seat so the buy-in continues after sign-in.

## Chat auto-translate

The chat header is one row: a channel dropdown (Global · Poker · Русский · chat rules), the translate button and collapse.
Translate opens a toggle plus a target language (EN, RU, ZH, AR, FA, ES, TR, DE), remembered per device; the button shows the
target flag while it is on, and picking a UI language in the top bar sets the same target.
Each message carries `lang` and a `tr` map of translations. When the toggle is on, a message in another language shows
`tr[target]` with a `RU → EN` tag; tapping the tag swaps back to the original. Messages without a translation show the original with a language tag.

Production: detect the language on ingest, translate server-side on demand (DeepL, Google Cloud Translation or Azure Translator all handle these eight), cache per (messageId, target) so a message is translated once per language, and only translate for viewers who have the toggle on. Moderation runs on the original text. The same component serves the per-table chat.

## Icons

The sprite inside `index.html` is generated by `build_icons.py` from the Iconify dumps in `icon-sources/` (fetched once; re-run the
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

## Design tokens (from the Mini App redesign)

Ground `#0b0c10` · card `#0f1014` · input `#15161b` · primary `#4e80ff` · bright CTA `#1684ff` ·
positive/go `#9bda1b` · danger `#f04040` · unique `#d642fb` · Telegram `#2aabee` · felt `#32598b`. Type: Rubik (Google Fonts), tabular numerals in tables.

Layout: sticky 64px top bar, collapsible 300px chat rail (Duel-style; overlay below 1100px), content up to 1320px.
Below 760px the bottom nav mirrors the Mini App (Hub · Poker · Games · Gifts · Leaders).
