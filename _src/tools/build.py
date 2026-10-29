"""Assembles _src/pages/*.html into the site root.

Replaces <!-- @include name --> with _src/partials/name.html and marks the
current page's nav links with aria-current="page".
Usage: python _src/tools/build.py
"""
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[2]
SRC = ROOT / '_src'


def build():
    partials = {p.stem: p.read_text(encoding='utf-8') for p in (SRC / 'partials').glob('*.html')}
    for page in sorted((SRC / 'pages').glob('*.html')):
        html = page.read_text(encoding='utf-8')
        html = re.sub(r'<!-- @include (\w+) -->', lambda m: partials[m.group(1)], html)
        html = html.replace(f'<a href="{page.name}">', f'<a href="{page.name}" aria-current="page">')
        (ROOT / page.name).write_text(html, encoding='utf-8')
        print('built', page.name)


if __name__ == '__main__':
    build()
