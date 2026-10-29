# Trogon Energy website

Static site, no framework or build step required to view it. Open `index.html`, or serve the folder:

```
python -m http.server 8765
```

## Pages
`index.html` · `about.html` · `solutions.html` · `projects.html` · `contact.html`

The root HTML files are **generated**. Edit the sources in `_src/` and rebuild:

```
python _src/tools/build.py
```

- `_src/pages/*.html`: page bodies
- `_src/partials/`: shared `head`, `header`, `footer`, `sprite` (icons), `map`, `cta`, inserted with `<!-- @include name -->`. The build marks the current nav link with `aria-current`.

## Assets
- `assets/css/style.css`: design system (tokens at the top, sampled from the logo: green `#00804A`, red `#E3161E`, sun `#F2E80E`, charcoal `#303030`)
- `assets/js/main.js`: reveals, split headings, counters, parallax, offer cards, savings calculator and charts, map arcs, accordion, filters, contact form (opens the visitor's email app addressed to sales@trogon.co.zw)
- `assets/img/obj-*.webp`: 3D objects rendered by `_src/tools/render3d.py` (numpy ray-marcher: panel, sun-orb, battery, two-tone ribbon). Re-render with `python _src/tools/render3d.py assets/img`
- `assets/img/zw-dots-*.svg`: dot-matrix Zimbabwe map from `_src/tools/zw_map.py` (also prints pin positions as `left/top` percentages)

## Before launch
- Most photos are **watermarked iStock comps**. License them and replace the files at the same names in `assets/img/` (WebP, hero images ~2000px wide, cards ~1200px).
- Project cards use stock imagery. Swap in real photos of each installation.
- The calculator is indicative: $0.12/kWh grid, $1.60/L diesel, 4.6 sun-hours, and rough installed costs in `main.js` (`cost = …`). Adjust these to Trogon's real pricing.
- The contact form uses `mailto:`. Connect it to a form backend if you want submissions stored.
