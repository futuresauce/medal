#!/usr/bin/env python3
"""Build the inline SVG sprite (icons + flags) for index.html.

Sources (icon-sources/*.json are Iconify API dumps, fetched once):
  phosphor.json  Phosphor Icons (MIT)        bold = default weight, fill = active / CTA weight
  extra.json     more Phosphor (ph2), Tabler Icons (MIT), Game Icons (CC BY 3.0), flag-icons (MIT)
  flags.json     flag-icons by lipis (MIT), 4x3
  Font Awesome Free 7 (CC BY 4.0) is the last-resort fallback (preinstalled).

Every icon id gets `i-<id>` (bold). Ids whose source has a fill weight also get `i-<id>-fill`.
Flags are emitted as `f-<cc>` (viewBox 0 0 640 480).
Writes between <!--ICONS:START--> and <!--ICONS:END--> in index.html.
"""
import json, os, re

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'icon-sources')
FA = '/opt/npm-tools/node_modules/@fortawesome/fontawesome-free/svgs'

def load(name):
    p = os.path.join(SRC, name)
    return json.load(open(p, encoding='utf-8')) if os.path.exists(p) else {}

PH = load('phosphor.json')          # {bold:{icons:{'house-bold': body}}, fill:{...}}
EX = load('extra.json')             # {tabler, tablerFill, game, flags, ph2: {icons:{name:{b,w,h}}}}
FL = load('flags.json')             # {'gb-4x3': {w,h,b}}

def ph(name, weight):
    key = f'{name}-{weight}'
    body = (PH.get(weight, {}).get('icons', {}) or {}).get(key)
    if not body:
        v = (EX.get('ph2', {}).get('icons', {}) or {}).get(key)
        body = v['b'] if v else None
    return body

def tb(name, fill=False):
    src = EX.get('tablerFill' if fill else 'tabler', {}).get('icons', {})
    v = src.get(name + ('-filled' if fill else '')) or src.get(name)
    return v

def gi(name):
    return EX.get('game', {}).get('icons', {}).get(name)

# id -> candidates. ('ph', phosphor-name) | ('tb', tabler-name) | ('gi', game-icons-name) | ('fa', set, name) | ('custom', key)
ICONS = {
    'home': [('ph', 'house')], 'chip': [('ph', 'poker-chip')], 'games': [('ph', 'dice-five')], 'cards': [('ph', 'cards')],
    'gift': [('ph', 'gift')], 'gifts': [('ph', 'gift')], 'trophy': [('ph', 'trophy')], 'chat': [('ph', 'chat-circle-dots')], 'chats': [('ph', 'chats-circle')],
    'wallet': [('ph', 'wallet')], 'user': [('ph', 'user')], 'bag': [('ph', 'backpack')], 'gear': [('ph', 'gear-six')], 'star': [('ph', 'star')],
    'bell': [('ph', 'bell')], 'bookmark': [('ph', 'bookmark-simple')], 'eye': [('ph', 'eye')], 'eye-off': [('ph', 'eye-slash')],
    'tg': [('ph', 'telegram-logo')], 'tg-plane': [('ph', 'paper-plane-tilt')], 'send': [('ph', 'paper-plane-right')],
    'x-twitter': [('ph', 'x-logo')], 'instagram': [('ph', 'instagram-logo')], 'youtube': [('ph', 'youtube-logo')],
    'gram': [('gi', 'cut-diamond'), ('ph', 'sketch-logo')], 'medal': [('custom', 'medal')], 'fa-medal': [('ph', 'medal')],
    'close': [('ph', 'x')], 'chev': [('ph', 'caret-down')], 'chev-l': [('ph', 'caret-left')], 'chev-r': [('ph', 'caret-right')], 'chev-u': [('ph', 'caret-up')],
    'plus': [('ph', 'plus')], 'minus': [('ph', 'minus')], 'menu': [('ph', 'list')], 'search': [('ph', 'magnifying-glass')],
    'lang': [('ph', 'translate')], 'globe': [('ph', 'globe-hemisphere-west')], 'info': [('ph', 'info')], 'help': [('ph', 'question')],
    'check': [('ph', 'check')], 'check-circle': [('ph', 'check-circle')], 'warn': [('ph', 'warning')], 'copy': [('ph', 'copy')],
    'share': [('ph', 'share-network')], 'link': [('ph', 'link')], 'external': [('ph', 'arrow-square-out')], 'more': [('ph', 'dots-three')],
    'reply': [('ph', 'arrow-bend-up-left')], 'arrow-left': [('ph', 'arrow-left')], 'arrow-right': [('ph', 'arrow-right')],
    'sort': [('ph', 'arrows-down-up')], 'filter': [('ph', 'funnel')], 'list': [('ph', 'list-bullets')], 'layers': [('ph', 'stack')],
    'sliders': [('ph', 'sliders-horizontal')], 'sync': [('ph', 'arrows-clockwise')], 'repeat': [('ph', 'repeat')], 'rejoin': [('ph', 'arrow-counter-clockwise')],
    'history': [('ph', 'clock-counter-clockwise')], 'clock': [('ph', 'clock')], 'stopwatch': [('ph', 'timer')], 'hourglass': [('ph', 'hourglass-medium')],
    'calendar': [('ph', 'calendar-dots')], 'lock': [('ph', 'lock-key')], 'key': [('ph', 'key')], 'shield': [('ph', 'shield-check')],
    'logout': [('ph', 'sign-out')], 'user-circle': [('ph', 'user-circle')], 'user-plus': [('ph', 'user-plus')], 'users': [('ph', 'users')],
    'group': [('ph', 'users-three')], 'id': [('ph', 'identification-badge')], 'at': [('ph', 'at')], 'phone': [('ph', 'device-mobile')], 'qr': [('ph', 'qr-code')],
    'sound': [('ph', 'speaker-high')], 'sound-off': [('ph', 'speaker-slash')], 'play': [('ph', 'play')], 'pause': [('ph', 'pause')], 'shuffle': [('ph', 'shuffle')],
    'signal': [('ph', 'broadcast')], 'bolt': [('ph', 'lightning')], 'fire': [('ph', 'fire')], 'crown': [('ph', 'crown')], 'queen': [('ph', 'crown-simple')],
    'certificate': [('ph', 'seal-check')], 'ranking': [('ph', 'ranking')], 'chart': [('ph', 'chart-line-up')], 'trend': [('ph', 'trend-up')],
    'percent': [('ph', 'percent')], 'target': [('ph', 'target')], 'infinity': [('ph', 'infinity')], 'rocket': [('ph', 'rocket-launch')],
    'gamepad': [('ph', 'game-controller')], 'wand': [('ph', 'magic-wand')], 'sparkle': [('ph', 'sparkle')], 'confetti': [('ph', 'confetti')],
    'tag': [('ph', 'tag')], 'ticket': [('ph', 'ticket')], 'store': [('ph', 'storefront')], 'horn': [('ph', 'megaphone')], 'bulb': [('ph', 'lightbulb')],
    'flag': [('ph', 'flag')], 'robot': [('ph', 'robot')], 'handshake': [('ph', 'handshake')], 'hand-dollar': [('ph', 'hand-coins')],
    'coins': [('ph', 'coins')], 'sack': [('ph', 'money')], 'bank': [('ph', 'bank')], 'transfer': [('ph', 'arrows-left-right')],
    'save': [('ph', 'floppy-disk')], 'table': [('ph', 'table')], 'ban': [('ph', 'prohibit')], 'scissors': [('ph', 'scissors')],
    'rock': [('ph', 'hand-fist')], 'paper': [('ph', 'hand')], 'heart': [('ph', 'heart')], 'diamond': [('ph', 'diamond')],
    'spade': [('ph', 'spade')], 'club': [('ph', 'club')], 'swords': [('tb', 'swords'), ('custom', 'swords')], 'dice5': [('ph', 'dice-five')],
    'clover': [('ph', 'clover')],
}

CUSTOM = {
    'medal': ('0 0 24 24', '<path fill="currentColor" d="M12 1.5 3.5 4.6v6.2c0 5.3 3.6 10.1 8.5 11.7 4.9-1.6 8.5-6.4 8.5-11.7V4.6L12 1.5Z"/><circle cx="12" cy="11.2" r="4.6" fill="#0b0c10" opacity=".55"/><path fill="currentColor" d="M12 8.1c1 1.3 2.4 2.1 2.4 3.4a1.5 1.5 0 0 1-2.1 1.4l.5 1.5h-1.6l.5-1.5a1.5 1.5 0 0 1-2.1-1.4c0-1.3 1.4-2.1 2.4-3.4Z"/>'),
    'swords': ('0 0 24 24', '<path fill="currentColor" d="M3 3h4l10.3 10.3 1.1-1.1 1.4 1.4-1.4 1.4 2.6 2.6-1.4 1.4-2.6-2.6-1.4 1.4-1.4-1.4 1.1-1.1L5 5v-2Zm18 0v2l-5.4 5.4-2-2L19 3h2Zm-9.9 11.1 2 2-2.8 2.8 1.1 1.1-1.4 1.4-1.4-1.4-2.6 2.6-1.4-1.4 2.6-2.6L5.8 17.2l1.4-1.4 1.1 1.1 2.8-2.8Z"/>'),
}
FLAGS = ['gb', 'ru', 'cn', 'sa', 'ir', 'es', 'tr', 'de', 'us', 'ua', 'kz', 'br', 'fr']

def fa(set_, name):
    p = os.path.join(FA, set_, name + '.svg')
    if not os.path.exists(p):
        return None
    s = open(p, encoding='utf-8').read()
    vb = re.search(r'viewBox="([^"]+)"', s).group(1)
    paths = re.findall(r'<path[^>]*d="([^"]+)"', s)
    return vb, ''.join(f'<path fill="currentColor" d="{d}"/>' for d in paths)

def resolve(cand, weight):
    kind = cand[0]
    if kind == 'ph':
        body = ph(cand[1], weight) or (ph(cand[1], 'bold') if weight != 'fill' else None)
        return ('0 0 256 256', body) if body else None
    if kind == 'tb':
        v = tb(cand[1], fill=(weight == 'fill'))
        if not v:
            return None
        body = v['b'].replace('stroke-width="2"', 'stroke-width="2.4"')
        return (f'0 0 {v["w"]} {v["h"]}', body)
    if kind == 'gi':
        v = gi(cand[1])
        return (f'0 0 {v["w"]} {v["h"]}', v['b']) if v else None
    if kind == 'custom':
        return CUSTOM[cand[1]]
    if kind == 'fa':
        return fa(cand[1], cand[2])
    return None

out, used = [], {}
for id_, cands in ICONS.items():
    base = None
    for cand in cands:
        base = resolve(cand, 'bold')
        if base:
            used[cand[0]] = used.get(cand[0], 0) + 1
            break
    if not base:
        raise SystemExit(f'no source for icon {id_}')
    out.append(f'<symbol id="i-{id_}" viewBox="{base[0]}">{base[1]}</symbol>')
    fill = None
    for cand in cands:
        if cand[0] in ('ph', 'tb'):
            fill = resolve(cand, 'fill')
            if fill:
                break
    if fill:
        out.append(f'<symbol id="i-{id_}-fill" viewBox="{fill[0]}">{fill[1]}</symbol>')

flag_src = dict(FL)
flag_src.update({k: v for k, v in (EX.get('flags', {}).get('icons', {}) or {}).items()})
nflags = 0
for cc in FLAGS:
    v = flag_src.get(f'{cc}-4x3')
    if not v:
        continue
    out.append(f'<symbol id="f-{cc}" viewBox="0 0 {v["w"]} {v["h"]}">{v["b"]}</symbol>')
    nflags += 1

credits = 'Icons: Phosphor Icons (MIT), Tabler Icons (MIT), Game Icons by Lorc/Delapouite (CC BY 3.0, game-icons.net). Flags: flag-icons by lipis (MIT).'
sprite = f'<!--ICONS:START--><svg width="0" height="0" style="position:absolute" aria-hidden="true"><!-- {credits} --><defs>' + ''.join(out) + '</defs></svg><!--ICONS:END-->'

html_path = os.path.join(ROOT, 'index.html')
html = open(html_path, encoding='utf-8').read()
assert '<!--ICONS:START-->' in html, 'icon markers missing'
html = re.sub(r'<!--ICONS:START-->.*?<!--ICONS:END-->', lambda m: sprite, html, flags=re.S)
open(html_path, 'w', encoding='utf-8').write(html)
print(f'{len(out)} symbols ({nflags} flags) from {used} — {len(sprite) // 1024} KB')
