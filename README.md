# Medal — сайт / website (v21)

Лендинг Medal на новом дизайне: 3D-фишки, собирающиеся в логотип, освещение, печатание текста,
повторные появления блоков, TGS-кот. Плюс всё, что было на действующем сайте medal.app:
EN/RU с автоопределением языка, манифест «Where the Winner Went», лайтбокс скриншотов,
определение Telegram, SEO/OG/JSON-LD, 404, заголовки безопасности для Netlify — и мобильная версия.

English notes are at the bottom.

## Быстрый просмотр

```sh
npm run build
npm start
```

Откройте http://127.0.0.1:4173/ (Node.js 18+, npm-зависимостей нет). Остановить сервер: Ctrl+C.
Если порт занят, задайте переменную `PORT`.

`dist/` — готовый сайт из нескольких файлов. На Netlify достаточно перетащить папку `dist/`
(или zip с её содержимым). `_headers`, `404.html`, `site.webmanifest`, `robots.txt`, `sitemap.xml`
создаются сборкой.

## Структура

- `src/i18n.cjs` — все тексты EN/RU. Ключи должны совпадать в обоих словарях; сборка предупредит,
  если в RU чего-то нет (тогда покажется английский текст, но никогда — «сырой» id).
- `src/theme.css` — токены: цвета, шрифты, единица `--u` (1px при ширине 1920, с clamp для
  планшетов и телефонов).
- `src/page.css` — раскладка и компоненты; в конце — правила для узких экранов.
- `src/page.js` — прокрутка, печатание текста, появления, переключение языка, лайтбокс,
  уведомление «документы закрыты», манифест, Telegram-режим, кот.
- `src/scene.js` — 3D-фишки, реакция на курсор, освещение и переход в логотип. Фишки собираются
  там, где CSS расположил SVG-логотип, поэтому макет можно двигать без правки сцены.
- `src/logo-points.json` — точки логотипа.
- `scripts/build.cjs` — разметка страницы и сборка `dist/`. Ссылки, версия кеша (`VERSION`) и
  флаг полосы «More ways to play» (`SHOW_STORE_STRIP`) — в начале файла.
- `scripts/serve.cjs` — локальный сервер для `dist/`.
- `assets/` — иконки и SVG, скриншоты (`img/screen-*` для коллажа, `img/shot-*` для лайтбокса),
  QR, OG-картинка, кот (`anim/cat.tgs` + `cat.json` как запасной вариант), шрифт Inter
  (`fonts/InterVariable-subset.woff2` — латиница + кириллица, 91 КБ; оригинал рядом).
- `vendor/` — Three.js и Lottie.

## Правила по текстам (из брифа проекта)

- Английская версия может нести заявление «not-for-profit»; русская остаётся проще
  («Игровое мини-приложение в Telegram»).
- По-русски: «Фишки Medal», «Платная ставка», «Карточные игры» (никогда «Дурак»).
- Экономика — только как цель («Цель: 90–95% …»).
- Документы остаются закрытыми, пока их не опубликуют (кнопки показывают уведомление).

## Как менять

- Тексты: `src/i18n.cjs`, затем `npm run build`.
- Ссылки (Telegram, канал, соцсети, почта): `LINKS` в `scripts/build.cjs`.
- Список «Что уже доступно / Дальше»: `LIVE_ITEMS`, `COMING_ITEMS` там же.
- Встроенный скрипт в `<head>` (определение Telegram) подписан хешем в `_headers`; сборка
  пересчитывает его сама.
- Отправляя обновление, увеличьте `VERSION` — суффикс `?v=N` сбрасывает кеш CSS/JS/OG.
- Новые скриншоты: проверьте, что на них нет пользовательских названий розыгрышей и ников.

## English notes

- `npm run build` renders `dist/` (multi-file, Netlify-ready: drag-drop the folder); `npm start`
  serves it at http://127.0.0.1:4173/. Node 18+, no dependencies.
- Copy lives in `src/i18n.cjs` (EN + RU, keys must match). Links, the cache-busting `VERSION`
  and the optional store strip are at the top of `scripts/build.cjs`.
- Layout: desktop keeps the designer's 1920-px composition (everything scales with `--u`);
  below 1024 px the page reflows, with phone rules at 760/520 px. The 3D intro runs in a lighter
  mode on phones and has a safety net: if the finale never completes, the logo appears and
  scrolling is released after 6 s.
- The inline `<head>` script is hashed into the CSP in `_headers` by the build.
- `?lang=ru` / `?lang=en` force a language; the choice is remembered; otherwise the browser
  language decides.
