#!/usr/bin/env python3
"""Build the deployable files at the repo root from src/.

Edit src/index.html, src/styles.css, src/app.js, then run:  python3 tools/build.py

repo root          index.html / styles.css / app.js with root-absolute paths (so /table/t2 and /gift/… load assets),
                   404.html (copy of index.html: boots the app on hosts that serve 404.html for unknown paths)
dist/preview.html  single-file preview with relative paths (double-click to open locally; hash routing) — git-ignored
"""
import os, re, shutil

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(REPO, 'src')
html = open(os.path.join(SRC, 'index.html'), encoding='utf-8').read()
css = open(os.path.join(SRC, 'styles.css'), encoding='utf-8').read()
js = open(os.path.join(SRC, 'app.js'), encoding='utf-8').read()

head = re.search(r'<!--BUILD:HEAD-START-->(.*?)<!--BUILD:HEAD-END-->', html, re.S).group(1).strip()
body = re.search(r'<!--BUILD:BODY-START-->(.*?)<!--BUILD:BODY-END-->', html, re.S).group(1).strip()


def absolutize(text):
    """Relative 'assets/…' references → root-absolute '/assets/…' (markup, CSS url(), JS template strings)."""
    return (text.replace('href="styles.css"', 'href="/styles.css"').replace('src="app.js"', 'src="/app.js"')
                .replace('src="assets/', 'src="/assets/')
                .replace('href="assets/', 'href="/assets/')
                .replace('url("assets/', 'url("/assets/')
                .replace("url('assets/", "url('/assets/")
                .replace('src=\\"assets/', 'src=\\"/assets/'))


# 1. deploy files at the repo root
for name, text in (('index.html', html), ('styles.css', css), ('app.js', js)):
    open(os.path.join(REPO, name), 'w', encoding='utf-8').write(absolutize(text))
open(os.path.join(REPO, '404.html'), 'w', encoding='utf-8').write(absolutize(html))

# 2. single-file local preview (relative paths, hash routing)
dist = os.path.join(REPO, 'dist')
os.makedirs(dist, exist_ok=True)
preview = html.replace('<link rel="stylesheet" href="styles.css">', f'<style>\n{css}\n</style>').replace('<script src="app.js"></script>', f'<script>\n{js}\n</script>')
open(os.path.join(dist, 'preview.html'), 'w', encoding='utf-8').write(preview)
_da = os.path.join(dist, 'assets')
shutil.rmtree(_da, ignore_errors=True)
shutil.copytree(os.path.join(REPO, 'assets'), _da)
print('wrote index.html, styles.css, app.js, 404.html at the repo root ·', len(html) // 1024, 'KB html ·', 'dist/preview.html')
