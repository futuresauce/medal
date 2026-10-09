/* ============================================================
   play.medal.poker — front-end behaviour
   No backend yet. Everything renders from the data arrays below.
   Developers: swap DATA.* for API/WebSocket feeds, replace
   simulateLogin() with the Telegram Login library, and wire the
   TON Connect hook in openWallet(). Buttons with [data-gate] open the
   sign-in modal for guests instead of acting.
   ============================================================ */
(function () {
  'use strict';

  /* ---------------------------------------------------------- utils */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n, cur) => cur === 'GRAM' ? (Math.round(n * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }) : Math.round(n).toLocaleString('en-US');
  const short = (n, cur) => n >= 1000 ? (n / 1000).toLocaleString('en-US', { maximumFractionDigits: n % 1000 ? 1 : 0 }) + 'k' : fmt(n, cur); // compact figure for tight cells
  const hue = (name) => { let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360; return h; };
  const avatar = (name, cls) => `<span class="avatar ${cls || ''}" style="--h:${hue(name)}">${esc(name.slice(0, 1).toUpperCase())}</span>`;
  const seeded = (seed) => () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const rnd = seeded(42);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const icon = (id) => `<svg><use href="#i-${id}"/></svg>`;
  const parseDur = (s) => { // "5d14h", "1d1h15m31s", "12h", "45m"
    let t = 0; const m = { d: 86400, h: 3600, m: 60, s: 1 };
    String(s).replace(/(\d+)\s*([dhms])/g, (_, n, u) => { t += +n * m[u]; return ''; });
    return t;
  };

  /* ---------------------------------------------------------- data (replace with API feeds) */
  const NAMES = ['Solo23', 'Egorich', 'Magazinger', 'fafafaf', 'amor_fati', 'Spiritmonster', 'cut1e', 'omiomiaa', 'Vaska', 'Nikitos', 'Queen_K', 'drachen', 'tuf_tuf', 'george123', 'Lenochka', 'bobr_kurwa', 'Mirai', 'Sanchez', 'Alik', 'Polina_P', 'Kir', 'Zed', 'maxpower', 'Tima'];
  const TABLE_NAMES = ['Aurora', 'Baikal', 'Comet', 'Dune', 'Ember', 'Fjord', 'Glacier', 'Harbor', 'Iris', 'Juno', 'Kite', 'Lumen', 'Mistral', 'Nova', 'Orbit', 'Pulse', 'Quartz', 'Ridge', 'Sable', 'Tundra', 'Umber', 'Vega', 'Willow', 'Zenith'];
  const STAKES = [
    { cur: 'MEDAL', sb: 1, bb: 2, min: 40, max: 200, tier: 'micro' },
    { cur: 'MEDAL', sb: 5, bb: 10, min: 200, max: 1000, tier: 'low' },
    { cur: 'MEDAL', sb: 25, bb: 50, min: 1000, max: 5000, tier: 'mid' },
    { cur: 'MEDAL', sb: 100, bb: 200, min: 4000, max: 20000, tier: 'high' },
    { cur: 'GRAM', sb: 0.01, bb: 0.02, min: 0.4, max: 3, tier: 'micro' },
    { cur: 'GRAM', sb: 0.05, bb: 0.1, min: 2, max: 10, tier: 'low' },
    { cur: 'GRAM', sb: 0.25, bb: 0.5, min: 10, max: 50, tier: 'mid' },
    { cur: 'GRAM', sb: 1, bb: 2, min: 40, max: 200, tier: 'high' },
  ];
  const TABLES = TABLE_NAMES.map((name, i) => {
    const st = STAKES[(i * 5 + 1) % STAKES.length];
    const seats = (i % 5 === 3) ? 2 : 6;
    const n = Math.min(seats, Math.floor(rnd() * (seats + 1)));
    const pool = NAMES.slice();
    const players = [];
    for (let k = 0; k < n; k++) {
      const p = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
      players.push({ name: p, stack: st.min + rnd() * (st.max - st.min) });
    }
    return { id: 't' + (i + 1), name, game: 'NLH', ...st, seats, players, avgPot: st.bb * (6 + rnd() * 14), flop: Math.round(38 + rnd() * 50), hph: Math.round(48 + rnd() * 60) };
  });
  // make the featured table interesting
  TABLES[1].players = [{ name: 'Solo23', stack: 0.35 }, { name: 'Magazinger', stack: 4.2 }, { name: 'amor_fati', stack: 2.75 }, { name: 'cut1e', stack: 6.1 }];
  Object.assign(TABLES[1], STAKES[5], { seats: 6, avgPot: 1.17, flop: 71, hph: 64 });
  TABLES[0].players = [{ name: 'Egorich', stack: 180 }, { name: 'fafafaf', stack: 92 }, { name: 'Spiritmonster', stack: 210 }, { name: 'omiomiaa', stack: 61 }, { name: 'Vaska', stack: 144 }];

  // Every message carries `lang`; `tr` holds translations keyed by target language.
  // In production the translation service fills tr[target] on demand (cached per message).
  const CHAT = {
    global: [
      { n: 'medal_mod', mod: true, lang: 'en', t: 'Welcome to the web beta. Same account as the Mini App, same chips. Report bugs in @Medals.', tr: { ru: 'Добро пожаловать в веб-бету. Тот же аккаунт, что и в мини-приложении, те же фишки. Баги — в @Medals.', es: 'Bienvenido a la beta web. Misma cuenta que la Mini App, mismas fichas. Reporta errores en @Medals.' }, ago: 42 },
      { n: 'Spiritmonster', lang: 'en', t: 'anyone at the 0.25/0.50 table? Quartz is 3 handed', tr: { ru: 'кто-нибудь за столом 0.25/0.50? на Quartz трое', es: '¿alguien en la mesa 0.25/0.50? Quartz está a 3' }, ago: 31 },
      { n: 'Nikitos', lang: 'ru', t: 'кто на Aurora? раздачи сегодня огонь', tr: { en: 'who’s on Aurora? the hands are on fire tonight', es: '¿quién está en Aurora? las manos están que arden hoy' }, ago: 29 },
      { n: 'fafafaf', lang: 'en', t: 'ngl the free tables are juicy tonight', tr: { ru: 'честно, фри-столы сегодня сочные' }, ago: 28 },
      { n: 'george123', lang: 'en', t: 'how do i claim the 50 MEDAL?', tr: { ru: 'как забрать 50 MEDAL?' }, ago: 24 },
      { n: 'Kolyan', lang: 'en', q: 'george123: how do i claim the 50 MEDAL?', t: 'Profile → Earn → Claim. every 8 hours', tr: { ru: 'Профиль → Заработок → Забрать. каждые 8 часов' }, ago: 23 },
      { n: 'Lenochka', lang: 'ru', t: 'подключила кошелёк за минуту, тот же TON Connect что и в приложении', tr: { en: 'connected my wallet in a minute, same TON Connect as in the app' }, ago: 21 },
      { n: 'amor_fati', lang: 'en', t: 'gg @Solo23, nice river', tr: { ru: 'gg @Solo23, красивый ривер' }, ago: 19 },
      { n: 'Solo23', lang: 'en', q: 'amor_fati: gg @Solo23, nice river', t: 'had to. flush draw + overs', tr: { ru: 'пришлось. флеш-дро + оверкарты' }, ago: 18 },
      { n: 'Sanchez', lang: 'es', t: '¿el sorteo del sombrero sigue abierto? quiero entrar', tr: { en: 'is the top hat giveaway still open? I want in', ru: 'розыгрыш цилиндра ещё открыт? хочу зайти' }, ago: 15 },
      { n: 'cut1e', lang: 'en', t: 'Ring #2455 just paid 38 GRAM to Solo23 with 11% lol', tr: { ru: 'Ring #2455 только что выплатил 38 GRAM Solo23 с 11% лол' }, ago: 14 },
      { n: 'Mirai', lang: 'zh', t: '这个免费桌也太好玩了，大家快来', tr: { en: 'these free tables are so much fun, everyone come', ru: 'эти фри-столы такие весёлые, все сюда' }, ago: 11 },
      { n: 'omiomiaa', lang: 'en', t: 'is the Top Hat giveaway still open?', tr: { ru: 'розыгрыш Top Hat ещё открыт?' }, ago: 9 },
      { n: 'medal_mod', mod: true, lang: 'en', q: 'omiomiaa: is the Top Hat giveaway still open?', t: 'Yes, round 1 closes in 5 days. 32 of 50 in so far.', tr: { ru: 'Да, первый раунд закрывается через 5 дней. Пока 32 из 50.' }, ago: 8 },
      { n: 'Vaska', lang: 'en', t: 'durak room up, 10 MEDAL, come', tr: { ru: 'комната в дурака открыта, 10 MEDAL, заходите' }, ago: 5 },
      { n: 'tuf_tuf', lang: 'en', t: 'hit 100x on roulette green today 🟢', tr: { ru: 'поймал 100x на зелёном в рулетке сегодня 🟢' }, ago: 2 },
      { n: 'Solo23', lang: 'en', t: 'just won this in the ring, check it: https://t.me/nft/LootBag-7631', tr: { ru: 'только что выиграл это в ринге, смотрите: https://t.me/nft/LootBag-7631' }, ago: 1 },
    ],
    poker: [
      { n: 'Magazinger', lang: 'en', t: 'Baikal 0.05/0.10 has two seats open', tr: { ru: 'на Baikal 0.05/0.10 два свободных места' }, ago: 20 },
      { n: 'Egorich', lang: 'en', t: 'heads-up anyone? Dune is empty', tr: { ru: 'кто в хедз-ап? Dune пустой' }, ago: 15 },
      { n: 'Kir', lang: 'ru', t: 'сел на Baikal, ждём ещё одного', tr: { en: 'sat down at Baikal, waiting for one more' }, ago: 12 },
      { n: 'Solo23', lang: 'en', t: 'running it twice when?', tr: { ru: 'когда будет run it twice?' }, ago: 11 },
      { n: 'medal_mod', mod: true, lang: 'en', t: 'Run it twice and PLO are on the roadmap. Not in this beta.', tr: { ru: 'Run it twice и PLO в планах. Не в этой бете.' }, ago: 10 },
      { n: 'amor_fati', lang: 'en', t: 'saved hands export would be nice too', tr: { ru: 'экспорт сохранённых раздач тоже был бы кстати' }, ago: 4 },
    ],
    ru: [
      { n: 'Nikitos', lang: 'ru', t: 'кто за столом Aurora? раздачи огонь', tr: { en: 'who’s at the Aurora table? the hands are on fire' }, ago: 17 },
      { n: 'Lenochka', lang: 'ru', t: 'как подключить кошелёк? в приложении было проще', tr: { en: 'how do I connect a wallet? it was easier in the app' }, ago: 12 },
      { n: 'medal_mod', mod: true, lang: 'ru', q: 'Lenochka: как подключить кошелёк?', t: 'Кошелёк → Подключить кошелёк. Тот же TON Connect, что и в мини-приложении.', tr: { en: 'Wallet → Connect wallet. The same TON Connect as in the Mini App.' }, ago: 11 },
      { n: 'Kir', lang: 'ru', t: 'дурак на 25 MEDAL, захожу', tr: { en: 'durak for 25 MEDAL, I’m in' }, ago: 6 },
      { n: 'Polina_P', lang: 'ru', t: 'розыгрыш цилиндра — кто участвует?', tr: { en: 'the top hat giveaway — who’s in?' }, ago: 3 },
    ],
  };
  const TABLE_CHAT = [
    { n: 'Solo23', lang: 'en', t: 'nh', tr: { ru: 'красиво' }, ago: 3 }, { n: 'Magazinger', lang: 'en', t: 'ty. tough fold', tr: { ru: 'спс. тяжёлый фолд' }, ago: 2 }, { n: 'cut1e', lang: 'en', t: 'dealer is cold tonight', tr: { ru: 'дилер сегодня холодный' }, ago: 1 },
  ];
  const INCOMING = [
    { t: 'gl all', lang: 'en', tr: { ru: 'всем удачи' } }, { t: 'who wants heads up', lang: 'en', tr: { ru: 'кто хочет хедз-ап' } }, { t: 'claimed my 50, back to Aurora', lang: 'en', tr: { ru: 'забрал свои 50, обратно на Aurora' } },
    { t: 'nice hand', lang: 'en', tr: { ru: 'красивая раздача' } }, { t: 'ring is filling up', lang: 'en', tr: { ru: 'ринг заполняется' } }, { t: 'кто на Baikal? сажусь', lang: 'ru', tr: { en: 'who’s on Baikal? sitting down' } },
    { t: 'that river tho', lang: 'en', tr: { ru: 'ну и ривер' } }, { t: 'vamos, otra ronda de Ring', lang: 'es', tr: { en: 'come on, another Ring round', ru: 'давайте, ещё раунд Ring' } }, { t: 'durak 5 MEDAL room open', lang: 'en', tr: { ru: 'комната в дурака на 5 MEDAL открыта' } },
  ];

  const LEADERS = {
    blackjack: { title: 'Blackjack Duel', unit: 'wins', rows: [['Solo23', 52, 1840], ['Egorich', 48, 1210], ['Magazinger', 44, 2330], ['fafafaf', 40, 980], ['amor_fati', 36, 1500], ['Kolyan', 31, 760], ['cut1e', 29, 640], ['omiomiaa', 27, 1120], ['Vaska', 22, 410], ['Nikitos', 19, 380], ['Queen_K', 18, 290], ['drachen', 15, 275]] },
    poker: { title: 'Poker', unit: 'hands won', rows: [['Magazinger', 312, 42.6], ['Solo23', 298, 38.1], ['Spiritmonster', 240, 21.4], ['amor_fati', 221, 30.2], ['Kolyan', 188, 12.5], ['Egorich', 171, 9.8], ['cut1e', 150, 15.3], ['Mirai', 133, 6.1], ['Sanchez', 120, 4.4], ['Alik', 118, 7.9]] },
    durak: { title: 'Durak', unit: 'wins', rows: [['Vaska', 61, 920], ['Kir', 55, 640], ['Nikitos', 49, 810], ['Kolyan', 44, 510], ['Lenochka', 38, 300], ['bobr_kurwa', 30, 450], ['Zed', 24, 180], ['Tima', 20, 160]] },
    chaos: { title: 'Medal Chaos', unit: 'duels won', rows: [['Egorich', 97, 310], ['Kolyan', 88, 240], ['Polina_P', 80, 150], ['maxpower', 71, 400], ['Queen_K', 66, 120], ['Solo23', 60, 210], ['tuf_tuf', 52, 95], ['george123', 40, 60]] },
  };

  const GIVEAWAYS = [
    { id: 'g1', name: 'Plush Pepe #2345', img: 'gift-pepe', g1: '#2f9d55', g2: '#0f3d22', entry: '2 GRAM', closes: '5d14h', players: 32, max: 50, rounds: 2, unique: true, status: 'open', mine: false },
    { id: 'g2', name: 'Lucky Clover #118', emoji: '🍀', g1: '#3fbf5a', g2: '#145a2a', entry: 'Free', closes: '12h10m', players: 128, max: 200, rounds: 3, status: 'open', mine: true },
    { id: 'g3', name: 'Snow Globe #305', emoji: '🔮', g1: '#7fc8ff', g2: '#1d4f8a', entry: '1 GRAM', closes: '2d3h', players: 14, max: 40, rounds: 2, status: 'open', mine: false },
    { id: 'g4', name: 'Jester Hat #51', emoji: '🃏', g1: '#ff6ac1', g2: '#7a1d58', entry: 'Free', closes: '6d2h', players: 9, max: 100, rounds: 3, status: 'open', mine: false },
    { id: 'g5', name: 'Desert Rose #9', emoji: '🌹', g1: '#ff7a59', g2: '#8a1d1d', entry: '5 GRAM', closes: '3d8h', players: 41, max: 50, rounds: 2, unique: true, status: 'open', mine: false },
    { id: 'g6', name: 'Top Hat #2101', emoji: '🎩', g1: '#5a6cff', g2: '#2b2f8f', entry: '2 GRAM', players: 50, max: 50, rounds: 2, status: 'done', winner: 'Solo23' },
    { id: 'g7', name: 'Vintage Lamp #88', emoji: '🪔', g1: '#f5b942', g2: '#7a4a10', entry: 'Free', players: 200, max: 200, rounds: 3, status: 'done', winner: 'amor_fati' },
  ];

  const NFTS = [
    { id: '#2345', slug: 'PlushPepe-2345', name: 'Plush Pepe', img: 'gift-pepe', g1: '#2f9d55', g2: '#0f3d22', model: 'Lovestruck', symbol: 'Heart', backdrop: 'Onyx Black', value: 9800, unique: true },
    { id: '#32425', slug: 'TopHat-32425', name: 'Top Hat', emoji: '🎩', g1: '#5a6cff', g2: '#2b2f8f', model: 'Ravenclaw', symbol: 'Autumn Leaves', backdrop: 'Midnight Blue', value: 12.24 },
    { id: '#5299', slug: 'SnowGlobe-5299', name: 'Snow Globe', emoji: '🔮', g1: '#7fc8ff', g2: '#1d4f8a', model: 'Frost', symbol: 'Pine', backdrop: 'Steel', value: 4.8 },
    { id: '#911', slug: 'LuckyClover-911', name: 'Lucky Clover', emoji: '🍀', g1: '#3fbf5a', g2: '#145a2a', model: 'Field', symbol: 'Dew', backdrop: 'Moss', value: 1.1 },
  ];

  const ROOMS = {
    durak: [{ host: 'Vaska', bet: 10, cur: 'MEDAL', note: '36 cards · transferable' }, { host: 'Kir', bet: 25, cur: 'MEDAL', note: '36 cards · classic' }, { host: 'Lenochka', bet: 0.5, cur: 'GRAM', note: '36 cards · transferable' }],
    chaos: [{ host: 'Egorich', bet: 1, cur: 'MEDAL', note: 'Best of 3' }, { host: 'Polina_P', bet: 5, cur: 'MEDAL', note: 'Best of 1' }, { host: 'maxpower', bet: 0.2, cur: 'GRAM', note: 'Best of 5' }, { host: 'Queen_K', bet: 10, cur: 'MEDAL', note: 'Best of 3' }, { host: 'tuf_tuf', bet: 1, cur: 'GRAM', note: 'Best of 1' }, { host: 'george123', bet: 1, cur: 'MEDAL', note: 'Best of 1' }],
  };

  const FEED = [
    ['Solo23', 'won 38.2 GRAM in Ring #2455'], ['Zenith', 'new 0.25/0.50 GRAM table opened'], ['amor_fati', 'entered the Top Hat #2345 giveaway'], ['cut1e', 'hit a straight flush at Ember'], ['Vaska', 'won 45 MEDAL at Durak'], ['Lucky Clover #118', '128 of 200 seats taken'], ['Egorich', 'won a BO3 duel for 10 MEDAL'], ['Magazinger', 'took a 6.4 GRAM pot at Baikal'], ['tuf_tuf', 'hit green ×14 on Roulette'], ['Queen_K', 'claimed free MEDAL'],
  ];

  /* ---------------------------------------------------------- state */
  const state = {
    user: null,
    seated: null,             // seat index at the current table when signed in and sat down
    table: 't2',
    lobby: { tab: 'cash', cur: 'all', game: 'NLH', stakes: 'all', size: 'all', hideFull: false, hideEmpty: false, q: '', sort: 'players', dir: -1 },
    chan: 'global',
    unread: 0,
    replyTo: null,
    lb: 'blackjack', lbMode: 'wins',
    gf: 'all',
    nft: 0,
    view: 'hub',
    pendingSeat: null,
    tr: { on: false, lang: 'en' },
    seatedAt: {},                       // tableId -> { seat, stack }
    ws: { open: [], rects: {}, auto: true, max: null, z: 1 },   // table workspace
    pmode: 'lobby',
  };
  try { const w = JSON.parse(localStorage.getItem('mp.ws') || 'null'); if (w && Array.isArray(w.open)) { state.ws.open = w.open.filter((id) => TABLES.some((t) => t.id === id)); state.ws.rects = w.rects || {}; state.ws.auto = w.auto !== false; state.ws.max = w.max || null; } } catch (e) { /* ignore */ }
  try { const t = JSON.parse(localStorage.getItem('mp.tr') || 'null'); if (t && typeof t.on === 'boolean') state.tr = t; } catch (e) { /* storage unavailable */ }
  const LANG_NAMES = { en: 'English', ru: 'Русский', zh: '中文', ar: 'العربية', fa: 'فارسی', es: 'Español', tr: 'Türkçe', de: 'Deutsch' };
  let chatOpen = window.innerWidth > 1100;
  try { const v = localStorage.getItem('mp.chat'); if (v) chatOpen = v === '1'; } catch (e) { /* storage unavailable */ }

  /* ---------------------------------------------------------- toasts + modals */
  function toast(msg, kind) {
    const el = document.createElement('div');
    el.className = 'toast' + (kind === 'info' ? ' toast--info' : '');
    el.innerHTML = icon(kind === 'info' ? 'info' : 'check') + '<span>' + esc(msg) + '</span>';
    $('#toasts').appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 320); }, 3200);
  }
  function openModal(id) { $$('.modal').forEach((m) => { m.hidden = true; }); const m = $('#' + id); if (m) { m.hidden = false; const f = m.querySelector('button:not(.modal__close),input'); if (f) setTimeout(() => f.focus(), 30); } }
  function closeModals() { $$('.modal').forEach((m) => { m.hidden = true; }); }

  /* ---------------------------------------------------------- auth */
  function applyAuth() {
    const u = !!state.user;
    $$('[data-auth="guest"]').forEach((el) => { el.hidden = u || (el.id === 'guestStrip' && el.dataset.dismissed === '1'); });
    $$('[data-auth="user"]').forEach((el) => { el.hidden = !u; });
    $$('[data-chat-input]').forEach((i) => { i.disabled = !u; i.placeholder = u ? 'Message' : 'Log in to chat'; });
    $$('[data-chat-send]').forEach((b) => { b.disabled = !u; });
    const ci = $('#chatInput'); ci.disabled = !u; ci.placeholder = u ? 'Message' : 'Log in to chat'; $('#chatSend').disabled = !u;
    $$('[data-bal]').forEach((b) => { b.textContent = u ? '—' : '—'; });
    $$('[data-betbox]').forEach(updateBetbox);
    $('#bjName').textContent = u ? state.user.name : 'Guest';
    document.body.classList.toggle('is-user', u);
    renderTable();
    if (state.view === 'poker' && state.pmode === 'tables') renderWorkspace();
  }
  function simulateLogin() {
    const btn = $('#doLogin');
    btn.disabled = true; btn.querySelector('span').textContent = 'Opening Telegram…';
    setTimeout(() => {
      btn.disabled = false; btn.querySelector('span').textContent = 'Log in with Telegram';
      state.user = { name: 'Kolyan', handle: '@kolyan', medal: 2345, gram: 6654 };
      closeModals(); applyAuth();
      toast('Signed in as Kolyan · 2,345 MEDAL · 6,654 GRAM');
      if (state.pendingJoin) { state.pendingJoin = false; openBuyin(); }
    }, 900);
  }
  function logout() { state.user = null; state.seatedAt = {}; state.pendingSeat = null; state.pendingJoin = false; applyAuth(); if (state.view === 'poker' && state.pmode === 'tables') renderWorkspace(); toast('Logged out. You can keep watching as a guest.', 'info'); }

  /* ---------------------------------------------------------- router */
  const VIEWS = ['hub', 'poker', 'table', 'games', 'blackjack', 'ring', 'roulette', 'chaos', 'durak', 'giveaways', 'giveaway', 'gift', 'leaders', 'inventory', 'profile'];
  // Clean URLs (/poker, /table/t2) when served from a real origin and the frame opts in; hash routes (#poker, #table-t2) otherwise.
  const PATH_MODE = $('#frame').dataset.routing === 'path' && /^https?:$/.test(location.protocol);
  function parseRoute() {
    let raw = PATH_MODE ? location.pathname.replace(/^\/+|\/+$/g, '') : (location.hash || '').slice(1);
    let sep = PATH_MODE ? '/' : '-';
    if (PATH_MODE && !raw && location.hash) { raw = location.hash.slice(1); sep = '-'; }   // old #links still work
    const parts = raw.split(sep);
    const view = VIEWS.includes(parts[0]) ? parts[0] : 'hub';
    const param = parts.slice(1).join(sep === '/' ? '/' : '-');
    if (PATH_MODE && sep === '-' && VIEWS.includes(parts[0])) history.replaceState({}, '', urlFor(view, param));
    return { view, param };
  }
  function urlFor(view, param) {
    if (PATH_MODE) return '/' + (view === 'hub' ? '' : view + (param ? '/' + param : ''));
    return '#' + view + (param ? '-' + param : '');
  }
  function go(view, param) {
    if (PATH_MODE) { history.pushState({}, '', urlFor(view, param)); route(); }
    else location.hash = urlFor(view, param).slice(1);
  }
  function route() {
    const { view: h, param } = parseRoute();
    if (h === 'table' && param && TABLES.some((t) => t.id === param)) state.table = param;
    if (h === 'giveaway' && param) state.gift = param;
    if (h === 'gift') renderGift(decodeURIComponent(param || ''));
    const prev = state.view; state.view = h;
    $$('.view').forEach((v) => v.classList.toggle('is-active', v.dataset.view === h));
    const navKey = ['table'].includes(h) ? 'poker' : ['blackjack', 'ring', 'roulette', 'chaos', 'durak'].includes(h) ? 'games' : h === 'giveaway' ? 'giveaways' : h;
    $$('[data-nav]').forEach((a) => a.classList.toggle('is-active', a.dataset.nav === navKey));
    document.body.classList.remove('nav-open');
    closeMenus();
    document.body.dataset.view = h;
    if (prev !== h) window.scrollTo(0, 0);
    if (h === 'poker') { renderLobby(); setPokerMode(param === 'tables' ? 'tables' : 'lobby'); }
    if (h === 'table') renderTable();
    if (h === 'leaders') renderLeaders();
    if (h === 'giveaways') renderGifts();
    if (h === 'giveaway') renderParticipants();
    if (h === 'inventory') renderNfts();
    if (window.innerWidth <= 1100 && chatOpen) setChat(false, true);
  }

  /* ---------------------------------------------------------- chat */
  function setChat(open, silent) {
    chatOpen = open;
    document.body.classList.toggle('chat-closed', !open);
    document.body.classList.toggle('chat-open', open);
    $('#scrim').hidden = !(open && window.innerWidth <= 1100);
    if (open) { state.unread = 0; updateBadges(); const l = $('#chatList'); l.scrollTop = l.scrollHeight; }
    if (!silent) { try { localStorage.setItem('mp.chat', open ? '1' : '0'); } catch (e) { /* ignore */ } }
  }
  function updateBadges() { ['#chatBadge', '#railBadge'].forEach((s) => { const b = $(s); if (b) { b.hidden = !state.unread; b.textContent = state.unread; } }); }
  const GIFT_LINK = /(?:https?:\/\/)?(?:www\.)?t\.me\/nft\/([A-Za-z0-9]+-\d+)/g;
  const giftTitle = (slug) => { const [name, num] = slug.split('-'); return `${name.replace(/([a-z])([A-Z])/g, '$1 $2')} #${num}`; };
  const fmtText = (s) => esc(s)
    .replace(GIFT_LINK, (_, slug) => `<a class="giftlink" href="${urlFor('gift', slug)}">${icon('gift-fill')}${esc(giftTitle(slug))}</a>`)
    .replace(/(^|\s)@(\w+)/g, '$1<span class="mention">@$2</span>');
  function msgHTML(m) {
    const cls = m.mod ? ' msg__name--mod' : (state.user && m.n === state.user.name ? ' msg__name--me' : '');
    const lang = m.lang || 'en';
    const target = state.tr.lang;
    const translated = state.tr.on && lang !== target && m.tr && m.tr[target];
    const foreign = state.tr.on && lang !== target && !translated;
    const text = translated ? m.tr[target] : m.t;
    const tag = translated
      ? `<button class="msg__tr" data-action="tr-toggle" data-orig="${esc(m.t)}" data-tr="${esc(m.tr[target])}" title="Translated from ${LANG_NAMES[lang] || lang.toUpperCase()} · tap for the original">${icon('lang')}${lang.toUpperCase()} → ${target.toUpperCase()}</button>`
      : foreign ? `<span class="msg__tr" title="No ${LANG_NAMES[target] || target} translation yet">${icon('lang')}${lang.toUpperCase()}</span>` : '';
    return `<div class="msg" data-name="${esc(m.n)}">${avatar(m.n, 'avatar--sm')}<div class="msg__body">${m.q ? `<span class="msg__quote">↩ ${esc(m.q)}</span>` : ''}<span class="msg__name${cls}">${esc(m.n)}</span><span class="msg__text">${fmtText(text)}</span>${tag}<span class="msg__time">${m.ago != null ? m.ago + 'm' : 'now'}</span></div><button class="iconbtn msg__reply" data-action="reply" title="Reply">${icon('reply')}</button></div>`;
  }
  function applyTranslate(save) {
    const { on, lang } = state.tr;
    const btn = $('#trBtn'); btn.classList.toggle('is-on', on); btn.setAttribute('aria-pressed', String(on));
    const FLAG = { en: 'gb', ru: 'ru', zh: 'cn', ar: 'sa', fa: 'ir', es: 'es', tr: 'tr', de: 'de' };
    const fl = $('#trBtnFlag'); fl.toggleAttribute('hidden', !on); fl.querySelector('use').setAttribute('href', '#f-' + (FLAG[lang] || 'gb')); $('.trbtn__icon').toggleAttribute('hidden', on);
    $('#trToggle').checked = on; $('#trMenu').classList.toggle('is-off', !on);
    $$('#trLangs button').forEach((b) => b.classList.toggle('is-active', b.dataset.trlang === lang));
    const st = $('#trSettingText'); if (st) st.textContent = on ? `On · everything in ${LANG_NAMES[lang]}` : 'Off';
    if (save) { try { localStorage.setItem('mp.tr', JSON.stringify(state.tr)); } catch (e) { /* ignore */ } }
    renderChat();
  }
  function renderChat() {
    const list = $('#chatList');
    list.innerHTML = `<div class="msg msg--sys">${state.chan === 'ru' ? 'Русскоязычный канал · модераторы онлайн' : state.chan === 'poker' ? 'Poker channel · table talk and seat requests' : 'Global channel · 1,355 online'}</div>` + CHAT[state.chan].map(msgHTML).join('');
    list.scrollTop = list.scrollHeight;
    $('#tableChatList').innerHTML = TABLE_CHAT.map(msgHTML).join('');
  }
  function pushMsg(chan, m) {
    CHAT[chan].push(m);
    if (CHAT[chan].length > 60) CHAT[chan].shift();
    if (chan === state.chan) { const l = $('#chatList'); const stick = l.scrollHeight - l.scrollTop - l.clientHeight < 80; l.insertAdjacentHTML('beforeend', msgHTML(m)); if (stick) l.scrollTop = l.scrollHeight; }
    if (!chatOpen) { state.unread++; updateBadges(); }
  }
  function sendChat(input, chan) {
    const t = input.value.trim(); if (!t) return;
    const m = { n: state.user.name, t, lang: state.tr.on ? state.tr.lang : 'en', ago: null };
    if (state.replyTo && chan === state.chan) { m.q = state.replyTo; state.replyTo = null; $('#chatReply').hidden = true; }
    if (chan === 'table') { TABLE_CHAT.push(m); $('#tableChatList').insertAdjacentHTML('beforeend', msgHTML(m)); } else pushMsg(chan, m);
    input.value = '';
  }
  setInterval(() => { if (document.hidden) return; const n = pick(NAMES.filter((x) => x !== 'Kolyan')); const m = pick(INCOMING); pushMsg('global', { n, t: m.t, lang: m.lang, tr: m.tr, ago: null }); }, 24000);

  /* ---------------------------------------------------------- live bits */
  const T0 = Date.now();
  function tickCountdowns() {
    const now = Date.now();
    $$('[data-countdown]').forEach((el) => {
      let s = Math.max(0, Math.round((T0 + parseDur(el.dataset.countdown) * 1000 - now) / 1000));
      const d = Math.floor(s / 86400); s -= d * 86400; const h = Math.floor(s / 3600); s -= h * 3600; const m = Math.floor(s / 60); s -= m * 60;
      el.textContent = d > 0 ? `${d}d ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    });
  }
  setInterval(tickCountdowns, 1000);
  let roul = 14; setInterval(() => { roul = roul <= 0 ? 30 : roul - 1; $('#roulTimer').textContent = '0:' + String(roul).padStart(2, '0'); }, 1000);
  let online = 1355; setInterval(() => { online += Math.round((rnd() - 0.5) * 6); $('#onlineCount').textContent = online.toLocaleString('en-US'); $('#statOnline').textContent = online.toLocaleString('en-US'); const ro = $('#railOnline'); if (ro) ro.textContent = online.toLocaleString('en-US'); }, 7000);
  let feedI = 0;
  function pushFeed() {
    const f = FEED[feedI++ % FEED.length]; const box = $('#liveFeed');
    box.insertAdjacentHTML('afterbegin', `<div><b>${esc(f[0])}</b><span>${esc(f[1])}</span><time>now</time></div>`);
    while (box.children.length > 3) box.lastElementChild.remove();
    Array.from(box.children).forEach((c, i) => { if (i) c.querySelector('time').textContent = (i * 11) + 's'; });
  }
  for (let i = 0; i < 3; i++) pushFeed();
  setInterval(() => { if (!document.hidden) pushFeed(); }, 11000);

  /* ---------------------------------------------------------- hub widgets */
  function seatsBar(t) { return `<span class="seatsbar">${Array.from({ length: t.seats }, (_, k) => `<i class="${k < t.players.length ? 'on' : ''}"></i>`).join('')}</span>`; }
  function renderHub() {
    const live = TABLES.filter((t) => t.players.length && t.players.length < t.seats).sort((a, b) => b.players.length - a.players.length).slice(0, 6);
    $('#hubTables').innerHTML = live.map((t) => `<a class="minitable" href="#table" data-open-table="${t.id}"><div><b>${esc(t.name)} <small class="muted">· ${t.seats === 2 ? 'HU' : '6-max'}</small></b><small>${fmt(t.sb, t.cur)}/${fmt(t.bb, t.cur)} ${t.cur}</small></div>${seatsBar(t)}<span class="muted">${t.players.length}/${t.seats}</span></a>`).join('');
    $('#hubGifts').innerHTML = GIVEAWAYS.filter((g) => g.status === 'open').slice(0, 4).map((g) => `<a class="minigift" href="#giveaway" data-gift="${g.id}">${giftTile(g, 'gifttile--sm')}<div><b>${esc(g.name)}</b><small>${g.players}/${g.max} in · closes in <span data-countdown="${g.closes}"></span></small></div><span class="pill ${g.entry === 'Free' ? 'pill--green' : 'pill--azure'}">${g.entry}</span></a>`).join('');
    $('#hubLeaders').innerHTML = leaderRows(LEADERS.blackjack.rows.slice(0, 5), 'wins', true);
    $$('[data-leaders]').forEach((ol) => { ol.innerHTML = leaderRows(LEADERS[ol.dataset.leaders].rows.slice(0, +ol.dataset.limit || 3), 'wins', true); });
    tickCountdowns();
  }
  function leaderRows(rows, mode, mini) {
    return rows.map((r, i) => {
      const score = mode === 'wins' ? r[1] : r[2];
      const unit = mode === 'wins' ? 'wins' : 'wagered';
      return mini
        ? `<li><span class="rank rank--${i + 1}">${i + 1}</span>${avatar(r[0], 'avatar--sm')}<span class="name">${esc(r[0])}</span><span class="score">${score.toLocaleString('en-US')} ${unit}</span></li>`
        : `<li class="${state.user && r[0] === state.user.name ? 'is-me' : ''}"><span class="rank rank--${i + 1}">${i + 1}</span>${avatar(r[0])}<span class="name">${esc(r[0])}<small>${i < 3 ? ['Gold · 500 MEDAL + gift', 'Silver · 250 MEDAL', 'Bronze · 100 MEDAL'][i] : 'ELO ' + (1300 - i * 17)}</small></span><span class="score">${score.toLocaleString('en-US')}<small>${unit}</small></span></li>`;
    }).join('');
  }

  /* ---------------------------------------------------------- poker lobby */
  function tierOf(t) { return t.tier; }
  function filteredTables() {
    const f = state.lobby;
    let rows = TABLES.filter((t) => (f.tab === 'hu' ? t.seats === 2 : f.tab === 'cash' ? true : true))
      .filter((t) => f.cur === 'all' || t.cur === f.cur)
      .filter((t) => f.stakes === 'all' || tierOf(t) === f.stakes)
      .filter((t) => f.size === 'all' || String(t.seats) === f.size)
      .filter((t) => !f.hideFull || t.players.length < t.seats)
      .filter((t) => !f.hideEmpty || t.players.length > 0)
      .filter((t) => !f.q || (t.name + ' ' + t.players.map((p) => p.name).join(' ')).toLowerCase().includes(f.q));
    const k = f.sort;
    rows.sort((a, b) => {
      const va = k === 'players' ? a.players.length : k === 'name' ? a.name : k === 'bb' ? a.bb * (a.cur === 'GRAM' ? 1000 : 1) : a[k];
      const vb = k === 'players' ? b.players.length : k === 'name' ? b.name : k === 'bb' ? b.bb * (b.cur === 'GRAM' ? 1000 : 1) : b[k];
      return (va > vb ? 1 : va < vb ? -1 : 0) * f.dir;
    });
    return rows;
  }
  function renderLobby() {
    const rows = filteredTables();
    $('#tableCount').textContent = rows.length + (rows.length === 1 ? ' table' : ' tables');
    $('#tableBody').innerHTML = rows.map((t) => `<tr data-table="${t.id}" class="${t.id === state.table ? 'is-selected' : ''}">
      <td><span class="tname">${esc(t.name)}<small>${t.seats === 2 ? 'HU' : '6-max'}</small></span></td>
      <td><span class="cur ${t.cur === 'GRAM' ? 'cur--gram' : ''}">${icon(t.cur === 'GRAM' ? 'gram' : 'medal')}${t.cur}</span> ${fmt(t.sb, t.cur)}/${fmt(t.bb, t.cur)}</td>
      <td>${fmt(t.min, t.cur)} – ${fmt(t.max, t.cur)}</td>
      <td><span class="players">${seatsBar(t)}<span class="${t.players.length === t.seats ? 'full' : ''}">${t.players.length}/${t.seats}</span></span></td>
      <td>${fmt(t.avgPot, t.cur)}</td>
      <td class="col-stat">${t.flop}%</td>
      <td class="col-stat">${t.hph}</td>
      <td style="text-align:right"><button class="btn btn--sm btn--ghost joinbtn ${t.players.length === t.seats ? '' : 'joinbtn--go'}" data-action="join" data-table="${t.id}">${t.players.length === t.seats ? 'Watch' : 'Join'}</button></td>
    </tr>`).join('') || `<tr><td colspan="8" class="muted" style="text-align:center;padding:40px">No tables match these filters. <button class="linkbtn" data-action="reset-filters">Reset filters</button></td></tr>`;
    $$('#tableGrid th').forEach((th) => th.classList.toggle('is-sorted', th.dataset.sort === state.lobby.sort));
    $('#tableGrid').classList.toggle('show-stats', !!state.lobby.stats);
    const f = state.lobby; const n = (f.size !== 'all') + (f.game !== 'NLH') + f.hideFull + f.hideEmpty;
    const fc = $('#filterCount'); fc.hidden = !n; fc.textContent = n;
    renderDetail();
  }
  function renderDetail() {
    const t = TABLES.find((x) => x.id === state.table) || TABLES[0];
    const pos6 = [[50, 102], [6, 74], [6, 26], [50, -2], [94, 26], [94, 74]], pos2 = [[50, 102], [50, -2]];
    const pos = t.seats === 2 ? pos2 : pos6;
    const seats = Array.from({ length: t.seats }, (_, i) => {
      const p = t.players[i]; const [x, y] = pos[i];
      return `<div class="seatmap__seat ${p ? '' : 'is-empty'}" style="left:${x}%;top:${y}%">${p ? avatar(p.name) : `<span class="avatar">+</span>`}<b>${p ? esc(p.name) : 'open'}</b></div>`;
    }).join('');
    const full = t.players.length === t.seats;
    $('#tableDetail').innerHTML = `
      <h3>${esc(t.name)} <span class="pill ${t.cur === 'GRAM' ? 'pill--azure' : 'pill--live'}">${t.cur}</span></h3>
      <div class="seatmap">${seats}<div class="seatmap__center"><b>${fmt(t.sb, t.cur)}/${fmt(t.bb, t.cur)}</b>${t.cur === 'GRAM' ? 'GRAM' : 'free · ELO rated'}</div></div>
      <div class="tabledetail__facts"><div><span>Buy-in</span><b title="${fmt(t.min, t.cur)} – ${fmt(t.max, t.cur)} ${t.cur}">${short(t.min, t.cur)}–${short(t.max, t.cur)}</b></div><div><span>Avg pot</span><b>${fmt(t.avgPot, t.cur)}</b></div><div><span>Speed</span><b>${t.hph} h/hr</b></div></div>
      <div class="playerrow">${t.players.map((p) => `<span title="${esc(p.name)} · ${fmt(p.stack, t.cur)}">${avatar(p.name)}</span>`).join('')}${Array.from({ length: t.seats - t.players.length }, () => '<span class="avatar avatar--open">+</span>').join('')}<span>${t.players.length}/${t.seats} seated${t.players.length < t.seats ? ` · ${t.seats - t.players.length} open` : ''}</span></div>
      <div class="btnrow btnrow--split"><button class="btn btn--ghost" data-action="open-table" data-table="${t.id}">${icon('eye-fill')}Watch</button><button class="btn btn--primary" data-action="join" data-table="${t.id}" ${full ? 'disabled' : ''}>${full ? 'Table full' : 'Join table'}</button></div>`;
  }

  /* ---------------------------------------------------------- buy-in + seat */
  function openBuyin() {
    const t = TABLES.find((x) => x.id === state.table);
    $('#biMin').textContent = fmt(t.min, t.cur); $('#biMax').textContent = fmt(t.max, t.cur); $('#biCur').textContent = t.cur;
    $('#biBal').textContent = state.user ? (t.cur === 'GRAM' ? state.user.gram : state.user.medal).toLocaleString('en-US') : '—';
    const a = $('#biAmount'); a.min = t.min; a.max = t.max; a.step = t.cur === 'GRAM' ? 0.1 : 1; a.value = fmt(Math.min(t.max, Math.max(t.min, t.cur === 'GRAM' ? 1 : t.min * 2.5)), t.cur).replace(/,/g, '');
    $$('#biQuick button').forEach((b) => { const v = b.dataset.bi; b.textContent = v === 'min' ? 'Min' : v === 'max' ? 'Max' : fmt(t.cur === 'GRAM' ? +v : t.min * (+v === 1 ? 2.5 : 4), t.cur); });
    openModal('m-buyin');
  }
  function confirmBuyin() {
    const t = TABLES.find((x) => x.id === state.table);
    const amt = +$('#biAmount').value || t.min;
    if (amt < t.min || amt > t.max) { toast(`Buy-in must be between ${fmt(t.min, t.cur)} and ${fmt(t.max, t.cur)} ${t.cur}`, 'info'); return; }
    let seat = state.pendingSeat;
    if (seat == null || t.players[seat]) { seat = null; for (let i = 0; i < t.seats; i++) { if (!t.players[i]) { seat = i; break; } } }
    if (seat == null) { toast('No open seats at this table.', 'info'); closeModals(); return; }
    state.seatedAt[t.id] = { seat, stack: amt }; state.pendingSeat = null;
    closeModals(); openTable(t.id);
    toast(`Seated at ${t.name} with ${fmt(amt, t.cur)} ${t.cur}. Waiting for the next hand.`);
    $('#tileSeated') && ($('#tileSeated').textContent = Object.keys(state.seatedAt).length);
  }

  /* ---------------------------------------------------------- table rendering (shared by the single view and workspace windows) */
  const SEAT_POS6 = [[50, 100], [9, 78], [9, 22], [50, 0], [91, 22], [91, 78]];
  const SEAT_POS2 = [[50, 100], [50, 0]];
  const heroSeat = (t) => (state.user && state.seatedAt[t.id]) ? state.seatedAt[t.id].seat : null;
  function feltHTML(t) {
    const pos = t.seats === 2 ? SEAT_POS2 : SEAT_POS6;
    const hero = heroSeat(t);
    const acting = hero != null ? hero : (t.players.length ? 1 % t.seats : -1);
    const dealer = t.players.length > 1 ? 2 % t.seats : 0;
    const pot = t.bb * 11.7;
    const seats = pos.map((_, i) => {
      const pi = hero == null ? i : (i - hero + t.seats) % t.seats;
      const [x, y] = pos[pi];
      const p = t.players[i];
      const isHero = i === hero;
      if (!p && !isHero) {
        return `<div class="seat seat--empty" style="left:${x}%;top:${y}%"><button class="seat__pod" data-action="sit" data-seat="${i}">${icon('plus')}Sit here</button></div>`;
      }
      const name = isHero ? state.user.name : p.name;
      const stack = isHero ? state.seatedAt[t.id].stack : p.stack;
      const inHand = isHero || i < 3 || t.seats === 2;
      const bet = inHand && i !== dealer ? t.bb * (i === 0 ? 2 : 1) : 0;
      const topSeat = t.seats === 2 ? 1 : 3;
      const betStyle = pi === 0 ? (isHero ? 'left:108%;top:50%;transform:translateY(-50%)' : 'right:104%;top:50%;transform:translateY(-50%)') : pi === topSeat ? 'left:50%;bottom:-34px;transform:translateX(-50%)' : (x < 50 ? 'left:104%;top:50%;transform:translateY(-50%)' : 'right:104%;top:50%;transform:translateY(-50%)');
      const dealerStyle = pi === 0 ? 'left:-6px;top:-10px' : pi === topSeat ? 'left:-6px;bottom:-10px' : (x < 50 ? 'right:-8px;bottom:-8px' : 'left:-8px;bottom:-8px');
      return `<div class="seat ${isHero ? 'seat--hero' : ''} ${i === acting ? 'is-acting' : ''} ${!inHand ? 'is-away' : ''}" style="left:${x}%;top:${y}%">
        <div class="seat__pod">${avatar(name)}<div class="seat__info"><b>${esc(name)}</b><span>${icon(t.cur === 'GRAM' ? 'gram' : 'medal')}${fmt(stack, t.cur)}</span></div>
          ${isHero ? `<div class="seat__cards"><img src="assets/card-QD.webp" alt="Queen of diamonds"><img src="assets/card-QS.webp" alt="Queen of spades"></div>` : inHand ? `<div class="seat__cards"><span class="cardback"></span><span class="cardback"></span></div>` : ''}
          ${i === dealer ? `<span class="seat__dealer" style="${dealerStyle}">D</span>` : ''}
          ${bet ? `<span class="seat__bet" style="${betStyle}"><i class="chipdot"></i>${fmt(bet, t.cur)}</span>` : ''}
        </div>
        ${isHero ? '<span class="seat__tag">Pair</span>' : !inHand ? '<span class="seat__tag seat__tag--fold">sitting out</span>' : i === acting ? '<span class="seat__tag">thinking…</span>' : ''}
      </div>`;
    }).join('');
    return `<div class="felt__inner"></div><img class="felt__logo" src="assets/wordmark.png" alt="">
      <div class="pot"><span>Total pot</span><b>${fmt(pot, t.cur)}</b></div>
      <div class="board">${['KC', '6D', 'JH'].map((c) => `<img src="assets/card-${c}.webp" alt="">`).join('')}<span class="cardback"></span><span class="cardback"></span></div>
      <div class="seats">${seats}</div>`;
  }
  function actionbarHTML(t) {
    const hero = heroSeat(t);
    const open = t.seats - t.players.length;
    if (!state.user) {
      return `<div class="actionbar__guest"><span>${icon('eye')}Watching as a guest · pick any open seat to play</span><button class="btn btn--primary" data-action="login">${icon('tg-plane')}<span>Log in with Telegram to sit</span></button></div>`;
    }
    if (hero == null) {
      return `<div class="actionbar__guest"><span>${icon('eye')}Watching · ${open > 0 ? `${open} open seat${open > 1 ? 's' : ''}` : 'table is full, you’re on the waiting list'}</span><button class="btn btn--primary" data-action="sit" data-seat="auto" ${open > 0 ? '' : 'disabled'}>${icon('plus')}Take a seat</button></div>`;
    }
    const stack = state.seatedAt[t.id].stack;
    const min = t.bb * 2, max = Math.max(min, stack), step = t.cur === 'GRAM' ? 0.01 : 1, val = Math.min(max, t.bb * 3);
    return `<div class="actionbar__user">
      <div class="handinfo"><span class="muted">Your hand</span><b>Pair of queens</b><span class="turn"><span class="turn__bar"></span></span></div>
      <div class="actions">
        <button class="act act--fold" data-action="act" data-act="fold">Fold</button>
        <button class="act act--call" data-action="act" data-act="call">Call <span>${fmt(t.bb / 2, t.cur)}</span></button>
        <button class="act act--raise" data-action="act" data-act="raise">Raise <span class="raise-val">${fmt(val, t.cur)}</span></button>
      </div>
      <div class="raisebox">
        <div class="seg seg--xs"><button data-raise="2">2x</button><button data-raise="3" class="is-active">3x</button><button data-raise="pot">Pot</button><button data-raise="max">All-in</button></div>
        <input class="slider raise-slider" type="range" min="${min}" max="${max}" step="${step}" value="${val}" style="--p:${((val - min) / ((max - min) || 1)) * 100}%" aria-label="Raise amount">
      </div>
    </div>`;
  }
  function updateRaise(sl) {
    const box = sl.closest('.actionbar__user'); const t = TABLES.find((x) => x.id === (sl.closest('[data-table-id]') || {}).dataset?.tableId) || TABLES.find((x) => x.id === state.table);
    const p = ((+sl.value - +sl.min) / ((+sl.max - +sl.min) || 1)) * 100; sl.style.setProperty('--p', p + '%');
    const v = box && box.querySelector('.raise-val'); if (v) v.textContent = fmt(+sl.value, t ? t.cur : 'MEDAL');
  }
  function renderTable() {
    const t = TABLES.find((x) => x.id === state.table); if (!t) return;
    const hero = heroSeat(t);
    $('#tvName').textContent = t.name;
    $('#tvMeta').textContent = `NLH · ${fmt(t.sb, t.cur)}/${fmt(t.bb, t.cur)} ${t.cur} · ${t.seats === 2 ? 'heads-up' : '6-max'} · Hand #245`;
    $('#felt').dataset.tableId = t.id; $('#felt').innerHTML = feltHTML(t);
    $('#actionbar').dataset.tableId = t.id; $('#actionbar').innerHTML = actionbarHTML(t);
    $$('.stage__top [data-auth="user"]').forEach((b) => { b.hidden = !(state.user && hero != null); });
    $('#tvInfo').innerHTML = `<dt>Table</dt><dd>${esc(t.name)} · ${t.seats === 2 ? 'heads-up' : '6-max'}</dd><dt>Game</dt><dd>No-Limit Hold’em</dd><dt>Blinds</dt><dd>${fmt(t.sb, t.cur)} / ${fmt(t.bb, t.cur)} ${t.cur}</dd><dt>Buy-in</dt><dd>${fmt(t.min, t.cur)} – ${fmt(t.max, t.cur)}</dd><dt>Players</dt><dd>${t.players.length + (hero != null ? 1 : 0)} / ${t.seats}</dd><dt>Speed</dt><dd>${t.hph} hands/hr</dd>`;
  }

  /* ---------------------------------------------------------- table workspace: draggable, resizable windows */
  const WS = { W: 960, H: 600, MIN_W: 420, MIN_H: 280, HEAD: 40 };
  const wsSave = () => { try { localStorage.setItem('mp.ws', JSON.stringify({ open: state.ws.open, rects: state.ws.rects, auto: state.ws.auto, max: state.ws.max })); } catch (e) { /* ignore */ } };
  function openTable(id, focus) {
    if (!state.ws.open.includes(id)) { state.ws.open.push(id); if (!state.ws.auto) { const c = canvasSize(); const n = state.ws.open.length; state.ws.rects[id] = { x: Math.min(24 * n, Math.max(0, c.w - 560)), y: Math.min(24 * n, Math.max(0, c.h - 380)), w: Math.min(560, c.w), h: Math.min(380, c.h) }; } }
    if (focus !== false) state.ws.max = state.ws.open.length === 1 ? null : state.ws.max;
    state.table = id; wsSave();
    if (isPhone()) { go('table', id); return; } // phones get the portrait single-table view; the window workspace is a desktop feature
    setPokerMode('tables'); go('poker', 'tables');
  }
  const isPhone = () => window.matchMedia('(max-width:760px)').matches;
  function closeTable(id) {
    state.ws.open = state.ws.open.filter((x) => x !== id); delete state.ws.rects[id]; if (state.ws.max === id) state.ws.max = null;
    wsSave(); renderWorkspace();
    if (!state.ws.open.length) setPokerMode('lobby');
  }
  function canvasSize() { const c = $('#wsCanvas'); return { w: c.clientWidth || 1200, h: c.clientHeight || 700 }; }
  function tileRects() {
    const { w, h } = canvasSize(); const ids = state.ws.open; const n = ids.length; const gap = 8; const rects = {};
    if (!n) return rects;
    if (isPhone()) { const hh = Math.round(w * WS.H / WS.W) + WS.HEAD; ids.forEach((id, i) => { rects[id] = { x: 0, y: i * (hh + gap), w, h: hh }; }); return rects; }
    const cols = n === 1 ? 1 : n === 2 ? (w / h > 1.6 ? 2 : 1) : n <= 4 ? 2 : 3;
    const rows = Math.ceil(n / cols);
    const cw = Math.floor((w - gap * (cols - 1)) / cols), ch = Math.floor((h - gap * (rows - 1)) / rows);
    ids.forEach((id, i) => { const c = i % cols, r = Math.floor(i / cols); rects[id] = { x: c * (cw + gap), y: r * (ch + gap), w: cw, h: ch }; });
    return rects;
  }
  function setPokerMode(mode) {
    state.pmode = mode;
    $('#lobbyWrap').hidden = mode === 'tables';
    $('#workspace').hidden = mode !== 'tables';
    $$('#pokerMode button').forEach((b) => b.classList.toggle('is-active', b.dataset.pmode === mode));
    document.body.classList.toggle('is-workspace', mode === 'tables');
    if (mode === 'tables') renderWorkspace();
  }
  function renderWorkspace() {
    const canvas = $('#wsCanvas'); const ids = state.ws.open;
    $('#openCount').textContent = ids.length;
    $('#wsEmpty').hidden = ids.length > 0;
    $('#wsTabs').innerHTML = ids.map((id) => { const t = TABLES.find((x) => x.id === id); const mine = heroSeat(t) != null; return `<button class="ws__tab ${state.table === id ? 'is-active' : ''}" data-ws-focus="${id}" role="tab"><span class="ws__tabdot ${mine ? 'is-acting' : ''}"></span><b>${esc(t.name)}</b><small>${fmt(t.sb, t.cur)}/${fmt(t.bb, t.cur)} ${t.cur}</small><i data-action="win-close" data-win="${id}" title="Close table">${icon('close')}</i></button>`; }).join('');
    $$('.win', canvas).forEach((w) => { if (!ids.includes(w.dataset.win)) w.remove(); });
    const phone = isPhone();
    const rects = state.ws.auto || phone ? tileRects() : state.ws.rects;
    const { w: cw, h: ch } = canvasSize();
    ids.forEach((id) => {
      const t = TABLES.find((x) => x.id === id);
      let win = canvas.querySelector(`.win[data-win="${id}"]`);
      if (!win) {
        win = document.createElement('div'); win.className = 'win'; win.dataset.win = id; win.dataset.tableId = id;
        win.innerHTML = `<div class="win__head" data-drag><span class="win__title"><b>${esc(t.name)}</b><span>${fmt(t.sb, t.cur)}/${fmt(t.bb, t.cur)} ${t.cur} · ${t.seats === 2 ? 'HU' : '6-max'}</span></span><span class="win__watch muted">${icon('eye')}12</span><div class="win__tools"><button class="iconbtn" data-action="win-max" title="Maximize">${icon('maximize')}</button><button class="iconbtn" data-action="win-close" data-win="${id}" title="Close">${icon('close')}</button></div></div>
          <div class="win__body"><div class="tstage"><div class="felt" data-table-id="${id}"></div><div class="actionbar actionbar--win" data-table-id="${id}"></div></div></div><div class="win__resize" data-resize aria-hidden="true"></div>`;
        canvas.appendChild(win);
        new ResizeObserver(() => fitStage(win)).observe(win.querySelector('.win__body'));
      }
      win.querySelector('.felt').innerHTML = feltHTML(t);
      win.querySelector('.actionbar').innerHTML = actionbarHTML(t);
      win.classList.toggle('is-max', state.ws.max === id);
      win.classList.toggle('is-single', ids.length === 1);
      win.classList.toggle('is-focus', state.table === id);
      const maxBtn = win.querySelector('[data-action="win-max"]');
      maxBtn.hidden = ids.length === 1;
      maxBtn.title = state.ws.max === id ? 'Restore' : 'Maximize';
      maxBtn.innerHTML = icon(state.ws.max === id ? 'restore' : 'maximize');
      const r = phone ? rects[id] : (state.ws.max === id || ids.length === 1 ? { x: 0, y: 0, w: cw, h: ch } : (rects[id] || tileRects()[id]));
      if (!phone && state.ws.max && state.ws.max !== id) win.classList.add('is-behind'); else win.classList.remove('is-behind');
      Object.assign(win.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
      win.style.zIndex = state.table === id ? 20 : (win.style.zIndex || 1);
      fitStage(win);
    });
  }
  function fitStage(win) {
    const body = win.querySelector('.win__body'); const stage = win.querySelector('.tstage'); if (!body || !stage) return;
    const s = Math.min(body.clientWidth / WS.W, body.clientHeight / WS.H);
    stage.style.setProperty('--s', s.toFixed(4));
  }
  function focusWindow(id) { state.table = id; state.ws.z += 1; $$('#wsCanvas .win').forEach((w) => { w.classList.toggle('is-focus', w.dataset.win === id); if (w.dataset.win === id) w.style.zIndex = 20 + state.ws.z; else if (+w.style.zIndex > 20) w.style.zIndex = 1 + (+w.style.zIndex - 20); }); $$('#wsTabs .ws__tab').forEach((b) => b.classList.toggle('is-active', b.dataset.wsFocus === id)); if (state.ws.max && state.ws.max !== id) { state.ws.max = id; wsSave(); renderWorkspace(); } }
  function toggleMax(id) { if (state.ws.open.length < 2) return; state.ws.max = state.ws.max === id ? null : id; state.table = id; wsSave(); renderWorkspace(); }
  // drag + resize (pointer events). Double-tap on the title bar maximizes: detected here because
  // preventDefault() on pointerdown suppresses the compatibility dblclick event.
  (function wsPointer() {
    let drag = null, lastTap = { id: null, t: 0 };
    document.addEventListener('pointerdown', (e) => {
      const head = e.target.closest('.win__head'), grip = e.target.closest('.win__resize');
      const win = e.target.closest('.win');
      if (win) focusWindow(win.dataset.win);
      if (!win || (!head && !grip) || e.target.closest('button') || isPhone()) return;
      if (head) {
        const now = performance.now();
        if (lastTap.id === win.dataset.win && now - lastTap.t < 350 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 10) { lastTap = { id: null, t: 0 }; e.preventDefault(); toggleMax(win.dataset.win); return; }
        lastTap = { id: win.dataset.win, t: now, x: e.clientX, y: e.clientY };
      }
      if (win.classList.contains('is-single') || win.classList.contains('is-max')) return;
      e.preventDefault();
      const r = win.getBoundingClientRect(), c = $('#wsCanvas').getBoundingClientRect();
      drag = { win, mode: grip ? 'resize' : 'move', sx: e.clientX, sy: e.clientY, x: r.left - c.left, y: r.top - c.top, w: r.width, h: r.height, cw: c.width, ch: c.height };
      win.setPointerCapture && win.setPointerCapture(e.pointerId); win.classList.add('is-dragging');
    });
    document.addEventListener('pointermove', (e) => {
      if (!drag) return; const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy; const w = drag.win;
      if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
      if (!drag.moved) return;
      if (drag.mode === 'move') { const x = Math.max(0, Math.min(drag.cw - drag.w, drag.x + dx)), y = Math.max(0, Math.min(drag.ch - WS.HEAD, drag.y + dy)); w.style.left = x + 'px'; w.style.top = y + 'px'; }
      else { const nw = Math.max(WS.MIN_W, Math.min(drag.cw - drag.x, drag.w + dx)), nh = Math.max(WS.MIN_H, Math.min(drag.ch - drag.y, drag.h + dy)); w.style.width = nw + 'px'; w.style.height = nh + 'px'; fitStage(w); }
    });
    const end = () => {
      if (!drag) return; const w = drag.win; w.classList.remove('is-dragging');
      if (drag.moved) { // a plain click on the title bar keeps auto-tiling; only a real move or resize pins the window
        state.ws.auto = false; state.ws.rects[w.dataset.win] = { x: parseFloat(w.style.left), y: parseFloat(w.style.top), w: parseFloat(w.style.width), h: parseFloat(w.style.height) }; wsSave();
      }
      drag = null;
    };
    document.addEventListener('pointerup', end); document.addEventListener('pointercancel', end);
    document.addEventListener('click', (e) => { const head = e.target.closest('.win__head'); if (head && isPhone() && !e.target.closest('button')) go('table', head.closest('.win').dataset.win); });
    new ResizeObserver(() => { if (state.pmode === 'tables' && state.view === 'poker') renderWorkspace(); }).observe(document.documentElement);
  })();

  /* ---------------------------------------------------------- bet boxes (chips) */
  const CHIP_CLASS = { '0.1': 'chip--0\\.1', '1': 'chip--1', '5': 'chip--5', '10': 'chip--10', '25': 'chip--25', '100': 'chip--100', '500': 'chip--500' };
  function initBetboxes() {
    $$('[data-betbox]').forEach((box) => {
      box.dataset.total = '0';
      const strip = box.querySelector('[data-chips]');
      const vals = strip.dataset.chips.split(',');
      strip.innerHTML = vals.map((v) => `<button class="chip chip--${v}" data-chip="${v}" aria-label="${v}"><span>${v}</span></button>`).join('') +
        `<button class="chip chip--x" data-chipx="half"><span>½</span></button><button class="chip chip--x" data-chipx="x2"><span>X2</span></button><button class="chip chip--x" data-chipx="max"><span>MAX</span></button>`;
      updateBetbox(box);
    });
  }
  function betCur(box) { const panel = box.closest('.gpanel') || box.parentElement; const seg = panel.querySelector('[data-currency] .is-active'); return seg ? seg.dataset.cur : (box.querySelector('[data-bet-cur]').textContent || 'MEDAL'); }
  function updateBetbox(box) {
    const total = +box.dataset.total || 0; const cur = betCur(box);
    box.querySelector('[data-bet-total]').textContent = fmt(total, cur === 'GIFT' ? 'GRAM' : cur);
    box.querySelector('[data-bet-cur]').textContent = cur === 'GIFT' ? 'GRAM value' : cur;
    const bal = box.querySelector('[data-bal]'); if (bal) bal.textContent = state.user ? (cur === 'GRAM' || cur === 'GIFT' ? state.user.gram : state.user.medal).toLocaleString('en-US') : '—';
    const balIc = box.querySelector('.betbox__bal svg use'); if (balIc) balIc.setAttribute('href', cur === 'MEDAL' ? '#i-medal' : '#i-gram');
    const panel = box.closest('.gpanel') || box.parentElement; const win = panel.querySelector('[data-bet-win]');
    if (win) { const fee = +win.dataset.fee || 0; win.textContent = total ? `${fmt(total * 2 * (1 - fee), cur)} ${cur}` : '—'; }
  }

  /* ---------------------------------------------------------- leaders / gifts / nfts */
  const giftTile = (g, cls) => `<span class="gifttile ${cls || ''} ${g.img ? 'gifttile--img' : ''}" style="--g1:${g.g1};--g2:${g.g2}">${g.img ? `<img src="assets/${g.img}.webp" alt="">` : g.emoji}</span>`;
  function renderLeaders() {
    const b = LEADERS[state.lb]; if (!b) return;
    $('#lbTitle').textContent = b.title;
    $('#leaderList').innerHTML = leaderRows(b.rows, state.lbMode, false);
    $('#leaderBoard').hidden = state.lb === 'events';
  }
  function renderGifts() {
    const list = GIVEAWAYS.filter((g) => state.gf === 'all' || (state.gf === 'open' && g.status === 'open') || (state.gf === 'done' && g.status === 'done') || (state.gf === 'mine' && g.mine && !!state.user));
    $('#giftGrid').innerHTML = list.map((g) => `<a class="giftcard ${g.status === 'done' ? 'giftcard--done' : ''}" href="#giveaway" data-gift="${g.id}">
      ${giftTile(g)}
      <div class="giftcard__body"><b>${esc(g.name)}</b><span class="muted small">${g.rounds} rounds · ${g.unique ? 'Unique' : 'Collectible'}</span></div>
      <div class="giftcard__meta"><span>${g.status === 'done' ? `Won by <b>${esc(g.winner)}</b>` : `<b>${g.players}</b>/${g.max} in`}</span><span>${g.status === 'done' ? 'finished' : `<span data-countdown="${g.closes}"></span>`}</span></div>
      <span class="btn btn--sm ${g.status === 'done' ? 'btn--ghost' : g.mine && state.user ? 'btn--green' : 'btn--primary'}">${g.status === 'done' ? 'Results' : g.mine && state.user ? 'Participating' : `Enter · ${g.entry}`}</span>
    </a>`).join('') || `<div class="emptystate" style="grid-column:1/-1"><p>${state.gf === 'mine' && !state.user ? 'Sign in to see the giveaways you’re in.' : 'Nothing here yet.'}</p></div>`;
    $('#giftsOwned').innerHTML = NFTS.map((n) => `<a class="nft" href="#inventory">${giftTile(n)}<span class="nft__id">${n.id}</span><b>${esc(n.name)}</b><small>${n.unique ? 'Unique · ' : ''}${fmt(n.value, 'GRAM')} GRAM</small></a>`).join('');
    tickCountdowns();
  }
  function renderRooms() {
    $$('[data-roomlist]').forEach((list) => {
      const rooms = ROOMS[list.dataset.roomlist] || [];
      list.innerHTML = rooms.map((r) => `<div class="room">${avatar(r.host)}<div><b>${esc(r.host)}’s room</b><small>${esc(r.note)}</small></div><span class="pill ${r.cur === 'GRAM' ? 'pill--azure' : ''}">${icon(r.cur === 'GRAM' ? 'gram' : 'medal')}${fmt(r.bet, r.cur)} ${r.cur}</span><button class="btn btn--primary btn--sm" data-gate>Join</button></div>`).join('');
    });
  }
  function renderParticipants() {
    const names = NAMES.slice(0, 14);
    $('#giftParticipants').innerHTML = names.map((n) => avatar(n)).join('') + '<span class="more">+18</span>';
    const b = $('#participateBtn'); const g = GIVEAWAYS[0];
    b.textContent = g.mine && state.user ? 'Participating ✓' : 'Participate · 2 GRAM'; b.classList.toggle('btn--green', !!(g.mine && state.user)); b.classList.toggle('btn--azure', !(g.mine && state.user));
  }
  function renderNfts() {
    $('#nftGrid').innerHTML = NFTS.map((n, i) => `<button class="nft ${i === state.nft ? 'is-selected' : ''}" data-nft="${i}">${giftTile(n)}<span class="nft__id">${n.id}</span><b>${esc(n.name)}</b><small>${n.model} · ${fmt(n.value, 'GRAM')} GRAM</small></button>`).join('');
    const n = NFTS[state.nft];
    $('#nftDetail').innerHTML = `<div class="nftdetail__hero">${giftTile(n)}<span class="pill">Collectible ${n.id}</span></div>
      <div class="nftdetail__body"><h3>${esc(n.name)} ${n.unique ? '<span class="pill pill--pink">Unique</span>' : ''}</h3>
      <div class="availrow"><span class="pill">Floor</span><b>${fmt(n.value, 'GRAM')} GRAM</b></div>
      <dl class="kv"><dt>Model</dt><dd>${n.model}</dd><dt>Symbol</dt><dd>${n.symbol}</dd><dt>Backdrop</dt><dd>${n.backdrop}</dd></dl>
      <div class="btnrow btnrow--split"><button class="btn btn--primary" data-action="withdraw-nft">Withdraw</button><button class="btn btn--ghost" data-action="stake-nft">Use as stake</button></div>
      <a class="linkbtn" href="${urlFor('gift', n.slug)}">${icon('external')}Collectible details · t.me/nft/${esc(n.slug)}</a>
      <div class="confirm" hidden id="nftConfirm"><p class="small muted">Transfer this gift to your Telegram account? The network fee is 0.35 GRAM.</p><div class="btnrow btnrow--split"><button class="btn btn--ghost btn--sm" data-action="cancel-withdraw">Cancel</button><button class="btn btn--azure btn--sm" data-action="confirm-withdraw">Withdraw</button></div></div></div>`;
    $('#nftCount').textContent = NFTS.length;
  }

  /* ---------------------------------------------------------- Telegram gift page (t.me/nft/{slug}) ----------
     The browser never talks to Telegram. It asks our API (server/gift_api.py), which resolves the slug
     with a logged-in user session and caches the answer. API base comes from <meta name="medal-api">. */
  const API_BASE = ((document.querySelector('meta[name="medal-api"]') || {}).content || '/api').replace(/\/$/, '');
  const giftCache = new Map();
  const parseGiftSlug = (v) => { const m = String(v || '').trim().match(/(?:t\.me\/nft\/)?([A-Za-z0-9]+-\d+)\/?$/); return m ? m[1] : null; };
  async function fetchGift(slug) {
    if (giftCache.has(slug)) return giftCache.get(slug);
    const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 12000);
    try {
      const res = await fetch(`${API_BASE}/gift/${encodeURIComponent(slug)}`, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
      const ct = res.headers.get('content-type') || '';
      if (res.status === 404 && ct.includes('json')) return { status: 'notfound' };
      if (!res.ok || !ct.includes('json')) return { status: 'offline' };
      const out = { status: 'ok', data: await res.json() }; giftCache.set(slug, out); return out;
    } catch (e) { return { status: 'offline' }; } finally { clearTimeout(timer); }
  }
  function giftHero(d, slug) {
    const c = (d.attributes && d.attributes.backdrop && d.attributes.backdrop.colors) || {};
    const style = `--gc:${c.center || '#2a3a6e'};--ge:${c.edge || '#101a3a'};--gp:${c.pattern || '#ffffff'};--gt:${c.text || '#ffffff'}`;
    const img = d.images && d.images.thumb ? `<img class="gifthero__img" src="${esc(d.images.thumb)}" alt="${esc(d.title)}" onerror="this.remove()">` : `<svg class="gifthero__ph"><use href="#i-gift-fill"/></svg>`;
    return `<div class="gifthero" style="${style}" data-anim="${esc((d.images && d.images.animation) || '')}">${img}<span class="gifthero__num">#${esc(String(d.num))}</span></div>`;
  }
  function attrRow(label, a, icon_) {
    if (!a) return `<div class="giftattr"><span class="giftattr__k">${icon(icon_)}${label}</span><span class="muted">—</span></div>`;
    return `<div class="giftattr"><span class="giftattr__k">${icon(icon_)}${label}</span><span class="giftattr__v">${esc(a.name)}</span><span class="pill pill--xs" title="${esc(a.rarity_permille)}‰ of this collection">${esc(a.rarity)}</span></div>`;
  }
  function renderGift(raw) {
    const box = $('#giftPage'); const slug = parseGiftSlug(raw);
    if (!slug) { box.innerHTML = `<div class="emptystate emptystate--page"><svg><use href="#i-gift"/></svg><h3>Paste a Telegram gift link</h3><p>Links look like <code>https://t.me/nft/LootBag-7631</code>.</p></div>`; return; }
    const tgLink = `https://t.me/nft/${slug}`;
    box.innerHTML = `<div class="giftcard2 is-loading"><div class="gifthero gifthero--skeleton"></div><div class="giftcard2__body"><h1>${esc(giftTitle(slug))}</h1><p class="muted">Resolving ${esc(tgLink)}…</p></div></div>`;
    fetchGift(slug).then((r) => {
      if (state.view !== 'gift') return;
      if (r.status === 'notfound') {
        box.innerHTML = `<div class="giftcard2"><div class="gifthero" style="--gc:#3a1d26;--ge:#160a0e"><svg class="gifthero__ph"><use href="#i-warn"/></svg></div><div class="giftcard2__body"><h1>${esc(giftTitle(slug))}</h1><p class="muted">Telegram doesn’t know this link. Check the slug — collectible links look like <code>t.me/nft/LootBag-7631</code>.</p><div class="btnrow"><a class="tgbtn" href="${tgLink}" target="_blank" rel="noopener"><i><svg><use href="#i-tg-plane"/></svg></i><span>Open in Telegram anyway</span></a></div></div></div>`;
        return;
      }
      const d = r.status === 'ok' ? r.data : { slug, title: giftTitle(slug).replace(/ #\d+$/, ''), num: +slug.split('-')[1], link: tgLink, owner: null, availability_issued: null, availability_total: null, attributes: {}, gift_address: null, resell_amount: null, images: {} };
      const offline = r.status !== 'ok';
      const a = d.attributes || {};
      const owner = d.owner ? (d.owner.username ? `<a href="https://t.me/${esc(d.owner.username)}" target="_blank" rel="noopener">@${esc(d.owner.username)}</a>` : esc(d.owner.label || d.owner.name || '')) : '<span class="muted">—</span>';
      const supply = d.availability_total ? `${(+d.availability_issued).toLocaleString('en-US')} <span class="muted">/ ${(+d.availability_total).toLocaleString('en-US')}</span>` : '<span class="muted">—</span>';
      const resell = d.resell_amount && d.resell_amount.length ? d.resell_amount.map((x) => `${x.currency === 'TON' ? fmt(x.amount, 'GRAM') + ' GRAM' : Math.round(x.amount).toLocaleString('en-US') + ' ⭐'}`).join(' · ') : null;
      box.innerHTML = `
        ${offline ? `<div class="apinote">${icon('info')}<span>Gift API not connected on this host — showing the link without live details. The server in <code>server/</code> resolves it.</span></div>` : ''}
        <div class="giftcard2">
          ${giftHero(d, slug)}
          <div class="giftcard2__body">
            <div class="giftcard2__head"><h1>${esc(d.title)} <span class="muted">#${esc(String(d.num))}</span></h1>${a.model ? '<span class="pill pill--pink">Collectible</span>' : ''}</div>
            <div class="giftfacts">
              <div><span>${icon('user')}Owner</span><b>${owner}</b></div>
              <div><span>${icon('layers')}Supply</span><b>${supply}</b></div>
              ${resell ? `<div><span>${icon('tag')}On sale</span><b>${resell}</b></div>` : ''}
              ${d.value ? `<div><span>${icon('chart')}Value</span><b>${esc(String(d.value.amount))} ${esc(d.value.currency)}</b></div>` : ''}
            </div>
            <div class="giftattrs">${attrRow('Model', a.model, 'sparkle')}${attrRow('Symbol', a.pattern, 'wand')}${attrRow('Backdrop', a.backdrop, 'layers')}</div>
            ${d.gift_address ? `<div class="kvrow"><span class="muted">${icon('link')}TON address</span><b class="mono">${esc(d.gift_address.slice(0, 8))}…${esc(d.gift_address.slice(-6))}</b><button class="iconbtn" data-action="copy" data-copy="${esc(d.gift_address)}" title="Copy address"><svg><use href="#i-copy"/></svg></button></div>` : ''}
            ${a.original_details && a.original_details.sender ? `<p class="muted small">${icon('gift')} Originally sent by ${esc(a.original_details.sender.label)}${a.original_details.recipient ? ' to ' + esc(a.original_details.recipient.label) : ''}${a.original_details.message ? ` · “${esc(a.original_details.message)}”` : ''}</p>` : ''}
            <div class="btnrow giftcard2__actions">
              <a class="tgbtn" href="${esc(d.link || tgLink)}" target="_blank" rel="noopener"><i><svg><use href="#i-tg-plane"/></svg></i><span>Open in Telegram</span></a>
              <button class="btn btn--ghost" data-action="copy" data-copy="${esc(d.link || tgLink)}"><svg><use href="#i-copy"/></svg>Copy link</button>
              <button class="btn btn--primary" data-gate data-action="deposit-gift"><svg><use href="#i-wallet-fill"/></svg>Deposit to Medal</button>
            </div>
          </div>
        </div>`;
      if (!offline && d.images && d.images.animation) playGiftAnimation(box.querySelector('.gifthero'), d.images.animation);
    });
  }
  // Animated gifts ship as .tgs (gzipped Lottie). Decompress in the browser and play with lottie-web; falls back to the thumb.
  function playGiftAnimation(hero, url) {
    if (!hero || !('DecompressionStream' in window)) return;
    const load = window.lottie ? Promise.resolve() : new Promise((ok, fail) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js'; s.onload = ok; s.onerror = fail; document.head.appendChild(s); });
    load.then(() => fetch(url)).then((res) => { if (!res.ok) throw new Error('no animation'); return new Response(res.body.pipeThrough(new DecompressionStream('gzip'))).json(); })
      .then((animationData) => { const holder = document.createElement('div'); holder.className = 'gifthero__anim'; hero.appendChild(holder); window.lottie.loadAnimation({ container: holder, renderer: 'svg', loop: true, autoplay: true, animationData }); const img = hero.querySelector('.gifthero__img'); if (img) img.classList.add('is-hidden'); })
      .catch(() => { /* keep the thumbnail */ });
  }

  /* ---------------------------------------------------------- generic action feedback (replace with real game calls) */
  function actionToast(btn) {
    const label = (btn.textContent || '').trim().replace(/\s+/g, ' ');
    const box = (btn.closest('.gpanel') || document).querySelector('[data-betbox]');
    const bet = box ? (+box.dataset.total || 0) : 0;
    const cur = box ? betCur(box) : 'MEDAL';
    if (/^Deal/.test(label)) return bet ? `Dealing · ${fmt(bet, cur)} ${cur} on the table` : 'Pick a chip first.';
    if (label === 'Hit') return 'Card dealt.';
    if (label === 'Stand') return 'Standing. Dealer plays…';
    if (label === 'Double') return 'Doubled down.';
    if (/^Join round/.test(label)) return bet ? `You’re in Round #2456 with ${fmt(bet, cur)} ${cur}.` : 'Pick a chip first.';
    if (/^Join/.test(label)) return 'Joining the room…';
    if (/^Create room/.test(label)) return bet ? `Room created · ${fmt(bet, cur)} ${cur}. Waiting for an opponent…` : 'Set a bet first.';
    if (/^(Red|Green|Black)/.test(label)) return bet ? `${fmt(bet, cur)} ${cur} on ${label.split(/\s/)[0].toLowerCase()}.` : 'Pick a chip first.';
    if (label === 'GRAM') return '';
    return label ? `${label} ✓` : '';
  }

  /* ---------------------------------------------------------- menus */
  const UI_LANGS = { EN: ['gb', 'en', 'English'], RU: ['ru', 'ru', 'Русский'], ZH: ['cn', 'zh', '中文'], AR: ['sa', 'ar', 'العربية'], FA: ['ir', 'fa', 'فارسی'] };
  function setLang(code) {
    const [flag, trLang, name] = UI_LANGS[code] || UI_LANGS.EN;
    state.lang = code;
    $('#langCode').textContent = code; $('#langFlag use').setAttribute('href', '#f-' + flag);
    $$('[data-lang]').forEach((b) => b.classList.toggle('is-active', b.dataset.lang === code));
    document.documentElement.lang = trLang; document.documentElement.dir = (code === 'AR' || code === 'FA') ? 'rtl' : 'ltr';
    if (state.tr.on || code !== 'EN') { state.tr.lang = trLang; if (code !== 'EN') state.tr.on = true; applyTranslate(true); }
    try { localStorage.setItem('mp.lang', code); } catch (e) { /* ignore */ }
    toast(`Language: ${name}`, 'info');
  }
  function closeMenus() { ['#langMenu', '#userMenu', '#trMenu', '#chanMenu', '#filterMenu'].forEach((s) => { $(s).hidden = true; }); ['#langBtn', '#userBtn', '#trBtn', '#chanBtn', '#filterBtn'].forEach((s) => $(s).setAttribute('aria-expanded', 'false')); }

  /* ---------------------------------------------------------- global click handling */
  document.addEventListener('click', (e) => {
    const winEl = e.target.closest('[data-table-id]'); if (winEl && winEl.dataset.tableId) state.table = winEl.dataset.tableId;
    const t = e.target.closest('[data-action],[data-gate],[data-table],[data-gift],[data-nft],[data-chip],[data-chipx],[data-bet-clear],[data-cur],[data-chan],[data-lang],[data-trlang],[data-tab],[data-lb],[data-mode],[data-gf],[data-wt],[data-amt],[data-bi],[data-raise],[data-tvtab],[data-filter] button,[data-sort],[data-rooms] button,[data-toggle-room] button,.bo button,.langrow button,.quick button,[data-open-table],[data-pmode],[data-ws-focus]');
    if (!t) { if (!e.target.closest('.menu,.langwrap,.userwrap,.trwrap,.chanwrap,.filterwrap')) closeMenus(); return; }

    // gated actions
    if (t.hasAttribute('data-gate') || ['join', 'sit', 'quick-seat', 'participate', 'rejoin', 'claim', 'addchips', 'sitout', 'save-hand', 'withdraw-nft', 'stake-nft'].includes(t.dataset.action)) {
      if (!state.user) {
        e.preventDefault();
        if (t.dataset.action === 'join' || t.dataset.action === 'sit' || t.dataset.action === 'quick-seat') { if (t.dataset.table) state.table = t.dataset.table; state.pendingSeat = t.dataset.seat === 'auto' || t.dataset.seat == null ? null : +t.dataset.seat; state.pendingJoin = true; }
        openModal('m-login'); return;
      }
    }

    const a = t.dataset.action;
    if (a) {
      e.preventDefault();
      switch (a) {
        case 'login': openModal('m-login'); break;
        case 'do-login': simulateLogin(); break;
        case 'logout': logout(); closeMenus(); break;
        case 'wallet': if (!state.user) { openModal('m-login'); } else openModal('m-wallet'); closeMenus(); break;
        case 'connect-wallet': toast('Opening your TON wallet…', 'info'); break;
        case 'toggle-chat': setChat(!chatOpen); break;
        case 'toggle-mobilenav': document.body.classList.toggle('nav-open'); break;
        case 'dismiss-strip': { const s = $('#guestStrip'); s.hidden = true; s.dataset.dismissed = '1'; break; }
        case 'close-modal': closeModals(); break;
        case 'notes': openModal('m-notes'); break;
        case 'chat-rules': openModal('m-rules'); break;
        case 'reset-filters': Object.assign(state.lobby, { cur: 'all', stakes: 'all', size: 'all', game: 'NLH', hideFull: false, hideEmpty: false, stats: false, q: '' }); $('#fHideFull').checked = false; $('#fHideEmpty').checked = false; $('#fStats').checked = false; $('#tableSearch').value = ''; $$('[data-filter]').forEach((g) => $$('button', g).forEach((b, i) => b.classList.toggle('is-active', i === 0))); renderLobby(); break;
        case 'open-table': openTable(t.dataset.table || state.table); break;
        case 'win-close': closeTable(t.dataset.win || (t.closest('.win') || {}).dataset?.win); break;
        case 'win-max': toggleMax(t.closest('.win').dataset.win); break;
        case 'ws-tile': state.ws.auto = true; state.ws.max = null; wsSave(); renderWorkspace(); toast('Tables arranged.', 'info'); break;
        case 'join': state.table = t.dataset.table || state.table; state.pendingSeat = null; { const tb = TABLES.find((x) => x.id === state.table); if (tb.players.length === tb.seats) { openTable(state.table); } else openBuyin(); } break;
        case 'sit': state.pendingSeat = t.dataset.seat === 'auto' ? null : +t.dataset.seat; openBuyin(); break;
        case 'quick-seat': { const cur = state.lobby.cur === 'all' ? null : state.lobby.cur; const cands = TABLES.filter((x) => x.players.length < x.seats && (!cur || x.cur === cur)).sort((p, q) => q.players.length - p.players.length); if (cands.length) { state.table = cands[0].id; state.pendingSeat = null; openBuyin(); } else toast('No open seats right now.', 'info'); break; }
        case 'confirm-buyin': confirmBuyin(); break;
        case 'tv-tab': $$('[data-tvtab]').forEach((b) => b.classList.toggle('is-active', b.dataset.tvtab === t.dataset.tab)); $$('.tableside__pane').forEach((p) => p.classList.toggle('is-active', p.dataset.pane === t.dataset.tab)); break;
        case 'share': navigator.clipboard && navigator.clipboard.writeText(location.href).then(() => toast('Link copied'), () => toast('Copy the link from the address bar', 'info')); break;
        case 'sound': t.classList.toggle('is-on'); toast(t.classList.contains('is-on') ? 'Sound on' : 'Sound off', 'info'); break;
        case 'sitout': toast('You’ll sit out after this hand.', 'info'); break;
        case 'addchips': openBuyin(); break;
        case 'act': { const act = t.dataset.act; const rv = t.closest('.actionbar__user')?.querySelector('.raise-val'); toast(act === 'fold' ? 'Folded. Next hand in 6s.' : act === 'call' ? 'Called.' : `Raised to ${rv ? rv.textContent : ''}.`, 'info'); break; }
        case 'participate': GIVEAWAYS[0].mine = !GIVEAWAYS[0].mine; renderParticipants(); toast(GIVEAWAYS[0].mine ? 'You’re in. 2 GRAM reserved for round 1.' : 'Entry withdrawn. 2 GRAM returned.'); break;
        case 'rejoin': toast('Rejoin Shield bought for 1 GRAM. Active for round 2.'); break;
        case 'claim': t.disabled = true; t.textContent = 'Claimed'; state.user.medal += 50; $('#balMedal').textContent = state.user.medal.toLocaleString('en-US'); toast('+50 MEDAL. Next claim in 8 hours.'); break;
        case 'promo': { const v = $('#promoInput').value.trim(); toast(v ? `Code “${v}” sent for checking.` : 'Enter a promo code first.', 'info'); break; }
        case 'copy': { const txt = t.dataset.copy; if (navigator.clipboard) navigator.clipboard.writeText(txt).then(() => toast('Copied: ' + txt), () => toast(txt, 'info')); else toast(txt, 'info'); break; }
        case 'save-hand': toast('Hand #245 saved to your profile.'); break;
        case 'reply': { const name = t.closest('.msg').dataset.name; const text = t.closest('.msg').querySelector('.msg__text').textContent; if (!state.user) { openModal('m-login'); break; } state.replyTo = `${name}: ${text}`; $('#chatReplyName').textContent = name; $('#chatReply').hidden = false; $('#chatInput').focus(); break; }
        case 'cancel-reply': state.replyTo = null; $('#chatReply').hidden = true; break;
        case 'tr-toggle': { const txt = t.previousElementSibling; const showingOrig = txt.classList.toggle('msg__text--orig'); txt.innerHTML = fmtText(showingOrig ? t.dataset.orig : t.dataset.tr); break; }
        case 'open-translate': if (!chatOpen) setChat(true); closeMenus(); $('#trMenu').hidden = false; $('#trBtn').setAttribute('aria-expanded', 'true'); break;
        case 'withdraw-nft': $('#nftConfirm').hidden = false; break;
        case 'cancel-withdraw': $('#nftConfirm').hidden = true; break;
        case 'confirm-withdraw': $('#nftConfirm').hidden = true; toast(`${NFTS[state.nft].name} ${NFTS[state.nft].id} sent to your Telegram. Fee 0.35 GRAM.`); break;
        case 'stake-nft': toast('Gift selected as a stake. Pick Blackjack Duel → GIFT.', 'info'); break;
        case 'deposit-gift': toast('Transfer the gift to @medal in Telegram and it appears in your inventory within a minute.', 'info'); break;
        default: toast(actionToast(t), 'info');
      }
      return;
    }

    if (t.hasAttribute('data-gate')) { e.preventDefault(); const msg = actionToast(t); if (msg) toast(msg, 'info'); return; }
    if (t.dataset.openTable) { e.preventDefault(); openTable(t.dataset.openTable); return; }
    if (t.dataset.pmode) { e.preventDefault(); if (t.dataset.pmode === 'tables') go('poker', 'tables'); else go('poker'); return; }
    if (t.dataset.wsFocus) { focusWindow(t.dataset.wsFocus); return; }
    if (t.closest('tr[data-table]') && t.tagName !== 'BUTTON') { state.table = t.closest('tr').dataset.table; $$('#tableBody tr').forEach((r) => r.classList.toggle('is-selected', r.dataset.table === state.table)); renderDetail(); return; }
    if (t.dataset.gift) { /* link navigates to #giveaway */ return; }
    if (t.dataset.nft != null) { state.nft = +t.dataset.nft; renderNfts(); return; }
    if (t.dataset.chip || t.dataset.chipx) {
      const box = t.closest('[data-betbox]');
      if (!state.user) { openModal('m-login'); return; }
      let total = +box.dataset.total || 0;
      if (t.dataset.chip) total += +t.dataset.chip; else if (t.dataset.chipx === 'half') total = Math.max(0, total / 2); else if (t.dataset.chipx === 'x2') total *= 2; else total = betCur(box) === 'GRAM' ? state.user.gram : state.user.medal;
      box.dataset.total = String(total); updateBetbox(box);
      $$('.chip', box).forEach((c) => c.classList.toggle('is-active', c === t)); setTimeout(() => t.classList.remove('is-active'), 400);
      return;
    }
    if (t.hasAttribute('data-bet-clear')) { const box = t.closest('[data-betbox]'); box.dataset.total = '0'; updateBetbox(box); return; }
    if (t.dataset.cur) { const seg = t.parentElement; $$('button', seg).forEach((b) => b.classList.toggle('is-active', b === t)); const panel = seg.closest('.gpanel') || seg.parentElement; const box = panel.querySelector('[data-betbox]'); if (box) { box.dataset.total = '0'; updateBetbox(box); } return; }
    if (t.dataset.trlang) { state.tr.lang = t.dataset.trlang; if (!state.tr.on) state.tr.on = true; applyTranslate(true); return; }
    if (t.dataset.chan) { state.chan = t.dataset.chan; $$('#chanMenu [data-chan]').forEach((b) => b.classList.toggle('is-active', b === t)); $('#chanName').textContent = t.dataset.chan === 'ru' ? 'Русский' : t.dataset.chan === 'poker' ? 'Poker' : 'Global'; closeMenus(); renderChat(); return; }
    if (t.dataset.lang) { closeMenus(); setLang(t.dataset.lang, t.dataset.flag); return; }
    if (t.dataset.tab && t.closest('#lobbyTabs')) { state.lobby.tab = t.dataset.tab; $$('#lobbyTabs button').forEach((b) => b.classList.toggle('is-active', b === t)); if (t.dataset.tab === 'hu') { state.lobby.size = '2'; } else if (state.lobby.size === '2') state.lobby.size = 'all'; $$('[data-filter="size"] button').forEach((b) => b.classList.toggle('is-active', b.dataset.val === state.lobby.size)); renderLobby(); return; }
    if (t.dataset.lb) { state.lb = t.dataset.lb; $$('#leaderTabs button').forEach((b) => b.classList.toggle('is-active', b === t)); renderLeaders(); return; }
    if (t.dataset.mode) { state.lbMode = t.dataset.mode; $$('#lbMode button').forEach((b) => b.classList.toggle('is-active', b === t)); renderLeaders(); return; }
    if (t.dataset.gf) { state.gf = t.dataset.gf; $$('#giftFilters button').forEach((b) => b.classList.toggle('is-active', b === t)); renderGifts(); return; }
    if (t.dataset.wt) { $$('#walletTabs button').forEach((b) => b.classList.toggle('is-active', b === t)); $$('.walletpane').forEach((p) => p.classList.toggle('is-active', p.dataset.wpane === t.dataset.wt)); return; }
    if (t.dataset.amt) { $('#depAmount').value = t.dataset.amt; $$('.quick button', t.parentElement).forEach((b) => b.classList.toggle('is-active', b === t)); return; }
    if (t.dataset.bi) { const tb = TABLES.find((x) => x.id === state.table); const v = t.dataset.bi; $('#biAmount').value = v === 'min' ? tb.min : v === 'max' ? tb.max : (tb.cur === 'GRAM' ? +v : tb.min * (+v === 1 ? 2.5 : 4)); $$('#biQuick button').forEach((b) => b.classList.toggle('is-active', b === t)); return; }
    if (t.dataset.raise) { const tb = TABLES.find((x) => x.id === state.table); const box = t.closest('.actionbar__user'); const sl = box.querySelector('.raise-slider'); const pot = tb.bb * 11.7; const v = t.dataset.raise === 'pot' ? pot : t.dataset.raise === 'max' ? +sl.max : tb.bb * +t.dataset.raise; sl.value = Math.min(+sl.max, Math.max(+sl.min, v)); updateRaise(sl); $$('[data-raise]', box).forEach((b) => b.classList.toggle('is-active', b === t)); return; }
    if (t.dataset.tvtab) { $$('[data-tvtab]').forEach((b) => b.classList.toggle('is-active', b === t)); $$('.tableside__pane').forEach((p) => p.classList.toggle('is-active', p.dataset.pane === t.dataset.tvtab)); return; }
    if (t.closest('[data-filter]')) { if (t.disabled) return; const g = t.closest('[data-filter]'); state.lobby[g.dataset.filter === 'cur' ? 'cur' : g.dataset.filter] = t.dataset.val; $$('button', g).forEach((b) => b.classList.toggle('is-active', b === t)); if (g.dataset.filter === 'size' && t.dataset.val !== '2' && state.lobby.tab === 'hu') { state.lobby.tab = 'cash'; $$('#lobbyTabs button').forEach((b) => b.classList.toggle('is-active', b.dataset.tab === 'cash')); } renderLobby(); return; }
    if (t.dataset.sort) { if (state.lobby.sort === t.dataset.sort) state.lobby.dir *= -1; else { state.lobby.sort = t.dataset.sort; state.lobby.dir = t.dataset.sort === 'name' ? 1 : -1; } renderLobby(); return; }
    if (t.closest('[data-rooms]') || t.closest('[data-toggle-room]') || t.closest('.bo') || t.closest('.langrow') || t.closest('.quick')) {
      $$('button', t.parentElement).forEach((b) => b.classList.toggle('is-active', b === t));
      if (t.closest('[data-toggle-room]')) { const note = t.closest('.gpanel').querySelector('[data-private-note]'); if (note) note.hidden = t.classList.contains('seg--green'); }
      return;
    }
  });

  // menus
  $('#langBtn').addEventListener('click', (e) => { e.stopPropagation(); const m = $('#langMenu'); const open = m.hidden; closeMenus(); m.hidden = !open; $('#langBtn').setAttribute('aria-expanded', String(open)); });
  const menuBtn = (btnSel, menuSel) => $(btnSel).addEventListener('click', (e) => { e.stopPropagation(); const m = $(menuSel); const open = m.hidden; closeMenus(); m.hidden = !open; $(btnSel).setAttribute('aria-expanded', String(open)); });
  menuBtn('#chanBtn', '#chanMenu'); menuBtn('#filterBtn', '#filterMenu');
  $('#trBtn').addEventListener('click', (e) => { e.stopPropagation(); const m = $('#trMenu'); const open = m.hidden; closeMenus(); m.hidden = !open; $('#trBtn').setAttribute('aria-expanded', String(open)); });
  $('#trToggle').addEventListener('change', (e) => { state.tr.on = e.target.checked; applyTranslate(true); });
  $('#userBtn').addEventListener('click', (e) => { e.stopPropagation(); const m = $('#userMenu'); const open = m.hidden; closeMenus(); m.hidden = !open; $('#userBtn').setAttribute('aria-expanded', String(open)); });
  $('#scrim').addEventListener('click', () => setChat(false));
  $$('.modal').forEach((m) => m.addEventListener('click', (e) => { if (e.target === m) closeModals(); }));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeModals(); closeMenus(); document.body.classList.remove('nav-open'); } });

  // forms
  $$('[data-gift-lookup]').forEach((f) => f.addEventListener('submit', (e) => { e.preventDefault(); const slug = parseGiftSlug(f.querySelector('input').value); if (!slug) { toast('That doesn’t look like a t.me/nft link.', 'info'); return; } f.querySelector('input').value = ''; go('gift', slug); }));
  $('#chatForm').addEventListener('submit', (e) => { e.preventDefault(); if (!state.user) { openModal('m-login'); return; } sendChat($('#chatInput'), state.chan); });
  $('#tableChatForm').addEventListener('submit', (e) => { e.preventDefault(); if (!state.user) { openModal('m-login'); return; } sendChat(e.target.querySelector('input'), 'table'); });
  $('#tableSearch').addEventListener('input', (e) => { state.lobby.q = e.target.value.trim().toLowerCase(); renderLobby(); });
  $('#fHideFull').addEventListener('change', (e) => { state.lobby.hideFull = e.target.checked; renderLobby(); });
  $('#fHideEmpty').addEventListener('change', (e) => { state.lobby.hideEmpty = e.target.checked; renderLobby(); });
  $('#fStats').addEventListener('change', (e) => { state.lobby.stats = e.target.checked; renderLobby(); });
  document.addEventListener('input', (e) => { if (e.target.matches('.raise-slider')) { updateRaise(e.target); $$('[data-raise]', e.target.closest('.actionbar__user')).forEach((b) => b.classList.remove('is-active')); } });
  if (PATH_MODE) {
    $$('a[href^="#"]').forEach((a) => { const { view, param } = (() => { const p = a.getAttribute('href').slice(1).split('-'); return VIEWS.includes(p[0]) ? { view: p[0], param: p.slice(1).join('-') } : null; })() || {}; if (view) a.setAttribute('href', urlFor(view, param)); });
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="/"]'); if (!a || a.target === '_blank' || e.metaKey || e.ctrlKey) return;
      const parts = a.getAttribute('href').replace(/^\/+/, '').split('/'); if (parts[0] && !VIEWS.includes(parts[0])) return;
      e.preventDefault(); go(parts[0] || 'hub', parts.slice(1).join('/'));
    });
    window.addEventListener('popstate', route);
  } else {
    window.addEventListener('hashchange', route);
  }
  window.addEventListener('resize', () => { $('#scrim').hidden = !(chatOpen && window.innerWidth <= 1100); });

  /* ---------------------------------------------------------- boot */
  initBetboxes();
  try { const l = localStorage.getItem('mp.lang'); if (l && UI_LANGS[l]) { const [flag, trLang] = UI_LANGS[l]; state.lang = l; $('#langCode').textContent = l; $('#langFlag use').setAttribute('href', '#f-' + flag); $$('[data-lang]').forEach((b) => b.classList.toggle('is-active', b.dataset.lang === l)); document.documentElement.lang = trLang; } } catch (e) { /* ignore */ }
  applyTranslate(false);
  $('#openCount').textContent = state.ws.open.length;
  renderHub();
  renderLobby();
  renderLeaders();
  renderGifts();
  renderRooms();
  renderParticipants();
  renderNfts();
  applyAuth();
  setChat(chatOpen, true);
  tickCountdowns();
  route();
})();
