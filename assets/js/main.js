/* Trogon Energy: interactions */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const svgNS = 'http://www.w3.org/2000/svg';

  /* ---------- header ---------- */
  const header = $('.site-header');
  let lastY = 0;
  const onScroll = () => {
    const y = scrollY;
    header?.classList.toggle('is-scrolled', y > 24);
    header?.classList.toggle('is-hidden', y > 400 && y > lastY && !document.body.classList.contains('menu-open'));
    lastY = y;
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const menuBtn = $('.menu-btn');
  const setMenu = open => {
    document.body.classList.toggle('menu-open', open);
    menuBtn?.setAttribute('aria-expanded', open);
    $('.mobile-menu')?.setAttribute('aria-hidden', !open);
  };
  menuBtn?.addEventListener('click', () => setMenu(!document.body.classList.contains('menu-open')));
  $$('.mobile-menu a').forEach(a => a.addEventListener('click', () => setMenu(false)));
  addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });

  /* ---------- split headings: each <br>-separated segment becomes a masked line ---------- */
  $$('.split').forEach(h => {
    h.innerHTML = h.innerHTML.split(/<br\s*\/?>/i)
      .map((seg, i) => `<span class="line"><span style="--i:${i}">${seg.trim()}</span></span>`).join('');
  });

  /* ---------- reveal on scroll ---------- */
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      en.target.classList.add('is-in');
      io.unobserve(en.target);
    });
  }, { threshold: .18, rootMargin: '0px 0px -6% 0px' });
  const revealables = $$('[data-reveal], .img-reveal, .split, .pkg, .step, [data-observe]');
  revealables.forEach(el => io.observe(el));
  // observers can miss elements carried past the viewport by a flick or the End key
  let sweepQueued = false;
  addEventListener('scroll', () => {
    if (sweepQueued) return;
    sweepQueued = true;
    requestAnimationFrame(() => {
      sweepQueued = false;
      revealables.forEach(el => {
        if (!el.classList.contains('is-in') && el.getBoundingClientRect().top < innerHeight) { el.classList.add('is-in'); io.unobserve(el); }
      });
    });
  }, { passive: true });

  /* ---------- counters ---------- */
  const countIO = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      const el = en.target, end = +el.dataset.count, dur = 1800, t0 = performance.now();
      const tick = t => {
        const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 4);
        el.textContent = Math.round(end * e).toLocaleString();
        if (k < 1) requestAnimationFrame(tick);
      };
      reduce ? (el.textContent = end.toLocaleString()) : requestAnimationFrame(tick);
      countIO.unobserve(el);
    });
  }, { threshold: .6 });
  $$('[data-count]').forEach(el => countIO.observe(el));

  /* ---------- offer cards: one active at a time ---------- */
  $$('.offer-grid').forEach(grid => {
    const cards = $$('.offer-card', grid);
    const set = c => cards.forEach(x => x.classList.toggle('is-active', x === c));
    cards.forEach(c => { c.addEventListener('mouseenter', () => set(c)); c.addEventListener('focusin', () => set(c)); });
  });

  /* ---------- hero carousel: photo, last word of the h1 and the glass card move together ---------- */
  const heroCard = $('.hero-card');
  if (heroCard) {
    const imgs = $$('.hero-media img'), words = $$('.rot-w'), slides = $$('.gc-slide', heroCard), dots = $$('.gc-dots button', heroCard);
    const MS = 6500;
    heroCard.style.setProperty('--gc-ms', MS + 'ms');
    let cur = 0, timer = null;
    const show = n => {
      cur = (n + slides.length) % slides.length;
      [imgs, words, slides].forEach(set => set.forEach((el, i) => el.classList.toggle('is-on', i === cur)));
      slides.forEach((s, i) => { s.toggleAttribute('inert', i !== cur); s.setAttribute('aria-hidden', i !== cur); });
      dots.forEach((d, i) => { d.classList.toggle('is-on', i === cur); d.classList.toggle('is-done', i < cur); d.setAttribute('aria-selected', i === cur); });
    };
    const stop = () => { clearInterval(timer); timer = null; heroCard.classList.add('is-paused'); };
    const play = () => { if (reduce || timer) return; heroCard.classList.remove('is-paused'); timer = setInterval(() => show(cur + 1), MS); };
    dots.forEach((d, i) => d.addEventListener('click', () => { stop(); show(i); play(); }));
    heroCard.addEventListener('mouseenter', stop);
    heroCard.addEventListener('mouseleave', play);
    heroCard.addEventListener('focusin', stop);
    new IntersectionObserver(([en]) => en.isIntersecting ? play() : stop()).observe($('.hero-frame'));
    document.addEventListener('visibilitychange', () => document.hidden ? stop() : play());
    if (reduce) heroCard.classList.add('is-paused');
  }

  /* ---------- touch: mirror hover while crossing the middle of the screen ---------- */
  if (matchMedia('(hover: none)').matches) {
    const mid = new IntersectionObserver(entries => entries.forEach(en => en.target.classList.toggle('is-inview', en.isIntersecting)),
      { rootMargin: '-38% 0px -38% 0px' });
    $$('.service-item, .offer-card, .aud-card, .proj-card, .value, .pkg, .bite-wrap, .link-arrow').forEach(el => mid.observe(el));
  }

  /* ---------- parallax ---------- */
  const par = $$('.parallax img');
  if (par.length && !reduce) {
    const run = () => {
      const vh = innerHeight;
      par.forEach(img => {
        const r = img.parentElement.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) return;
        const p = (r.top + r.height / 2 - vh / 2) / vh;
        img.style.transform = `translateY(${p * -6}%) scale(1.14)`;
      });
    };
    addEventListener('scroll', () => requestAnimationFrame(run), { passive: true });
    run();
  }

  /* ---------- accordion ---------- */
  $$('.acc-item button').forEach(b => b.addEventListener('click', () => {
    const item = b.closest('.acc-item'), open = !item.classList.contains('is-open');
    $$('.acc-item', item.parentElement).forEach(i => { i.classList.remove('is-open'); $('button', i).setAttribute('aria-expanded', 'false'); });
    item.classList.toggle('is-open', open);
    b.setAttribute('aria-expanded', open);
  }));

  /* ---------- project filters ---------- */
  $$('.filters').forEach(f => {
    const list = $(f.dataset.target);
    $$('button', f).forEach(b => b.addEventListener('click', () => {
      $$('button', f).forEach(x => x.setAttribute('aria-pressed', x === b));
      const k = b.dataset.filter;
      $$('[data-cat]', list).forEach(c => c.classList.toggle('is-hidden', k !== 'all' && !c.dataset.cat.includes(k)));
    }));
  });

  /* ---------- map: arcs from HQ + list/pin sync ---------- */
  $$('.map-canvas').forEach(map => {
    const svg = $('.map-arcs', map), hq = $('.pin--hq', map);
    if (svg && hq) {
      const pt = el => [parseFloat(el.style.left) * 8.4, parseFloat(el.style.top) * 7.94];
      const [hx, hy] = pt(hq);
      $$('.pin[data-id]:not(.pin--hq):not(.pin--cover)', map).forEach((p, i) => {
        const [x, y] = pt(p);
        const mx = (hx + x) / 2, my = (hy + y) / 2 - Math.hypot(x - hx, y - hy) * .35;
        const path = document.createElementNS(svgNS, 'path');
        path.setAttribute('d', `M${hx},${hy} Q${mx},${my} ${x},${y}`);
        path.style.animationDelay = `${-i * 3}s`;
        svg.appendChild(path);
      });
    }
    const list = $(`[data-map="${map.id}"]`);
    if (!list) return;
    const activate = id => {
      $$('.pin', map).forEach(p => p.classList.toggle('is-active', p.dataset.id === id));
      $$('button', list).forEach(b => b.classList.toggle('is-active', b.dataset.id === id));
    };
    $$('button', list).forEach(b => { b.addEventListener('mouseenter', () => activate(b.dataset.id)); b.addEventListener('focus', () => activate(b.dataset.id)); b.addEventListener('click', () => activate(b.dataset.id)); });
    $$('.pin button', map).forEach(b => b.addEventListener('click', () => activate(b.parentElement.dataset.id)));
  });

  /* ---------- savings calculator + charts ---------- */
  const calc = $('#calc');
  if (calc) {
    const bill = $('#bill'), fuel = $('#fuel'), segBtns = $$('.seg button', calc);
    let type = 'home';
    const LOAD = {   // hourly share of daily consumption, 24 values each
      home: [2, 1.5, 1.5, 1.5, 2, 4, 6, 6, 4, 3, 3, 3, 3.5, 3, 3, 3.5, 4.5, 6.5, 8, 8, 7, 5.5, 4, 3],
      business: [1.5, 1.5, 1.5, 1.5, 1.5, 2, 3.5, 6, 7.5, 7.5, 7.5, 7.5, 7, 7.5, 7.5, 7, 6, 4, 2.5, 2, 1.5, 1.5, 1.5, 1.5],
      farm: [1, 1, 1, 1, 1, 1.5, 3, 5, 7, 8.5, 9, 9.5, 9.5, 9, 8.5, 7, 5, 3, 2.5, 2, 1.5, 1, 1, 1]
    };
    const NIGHT = { home: .35, business: .25, farm: .15 };
    const SIZES = [3, 5, 8, 10, 12, 15, 20, 30, 40, 50];
    const fmt = n => '$' + Math.round(n).toLocaleString();
    const paint = r => r.style.setProperty('--p', ((r.value - r.min) / (r.max - r.min)) * 100 + '%');

    const W = 560, H = 230, P = { l: 34, r: 8, t: 10, b: 24 };
    const day = $('#chartDay'), cash = $('#chartCash');

    function update() {
      const b = +bill.value, f = +fuel.value;
      $('#billOut').textContent = fmt(b);
      $('#fuelOut').textContent = fmt(f);
      paint(bill); paint(fuel);
      const kwhDay = b / 0.12 / 30 + (f / 1.6) * 3 / 30;          // ZESA about $0.12/kWh; diesel about $1.60/L at 3 kWh/L
      const kwp = Math.max(1.6, kwhDay / 4.6);                     // ~4.6 usable peak-sun hours
      const kva = SIZES.find(s => s >= kwp * 1.05) || SIZES.at(-1);
      const batt = Math.max(5, Math.round(kwhDay * NIGHT[type] / 2.5) * 2.5);
      const panels = Math.ceil(kwp * 1000 / 550);
      const cost = kwp * 600 + batt * 280 + kva * 90 + 500;      // installed USD, indicative
      const yearly = (b + f) * 12 * .85;
      const payback = cost / yearly;
      $('#kSize').textContent = kva + ' kVA';
      $('#kPanels').textContent = panels + ' × 550W';
      $('#kBatt').textContent = batt + ' kWh';
      $('#kPay').textContent = payback.toFixed(1) + ' yrs';
      $('#kSave').textContent = fmt(yearly / 12) + '/mo';
      drawDay(kwp, kwhDay, batt);
      drawCash(cost, yearly);
    }

    function el(name, attrs, parent) {
      const n = document.createElementNS(svgNS, name);
      for (const k in attrs) n.setAttribute(k, attrs[k]);
      parent && parent.appendChild(n);
      return n;
    }
    function frame(svg, maxY, unit, xLabels) {
      svg.innerHTML = '';
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      const defs = el('defs', {}, svg);
      defs.innerHTML = `<linearGradient id="gSun" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f5d90a" stop-opacity=".55"/><stop offset="1" stop-color="#f5d90a" stop-opacity="0"/></linearGradient>
        <linearGradient id="gBatt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#00a35e" stop-opacity=".55"/><stop offset="1" stop-color="#00a35e" stop-opacity=".02"/></linearGradient>`;
      const g = el('g', { class: 'grid' }, svg);
      for (let i = 0; i <= 4; i++) {
        const y = P.t + (H - P.t - P.b) * i / 4;
        el('line', { x1: P.l, x2: W - P.r, y1: y, y2: y }, g);
        const t = el('text', { x: 0, y: y + 3 }, svg);
        t.textContent = (maxY * (1 - i / 4)).toFixed(maxY < 10 ? 1 : 0) + unit;
      }
      xLabels.forEach(([x, s]) => { const t = el('text', { x, y: H - 6, 'text-anchor': 'middle' }, svg); t.textContent = s; });
    }
    function drawDay(kwp, kwhDay, batt) {
      const sun = Array.from({ length: 25 }, (_, h) => { const x = (h - 12.5) / 3.4; return h < 6 || h > 19 ? 0 : kwp * .82 * Math.exp(-x * x); });
      const loadShape = LOAD[type], sum = loadShape.reduce((a, b) => a + b, 0);
      const load = [...loadShape, loadShape[0]].map(v => v / sum * kwhDay);
      // battery state of charge (kWh): charge from surplus, discharge to cover deficit
      let soc = batt * .35; const socs = [];
      for (let h = 0; h <= 24; h++) { soc = Math.min(batt, Math.max(batt * .1, soc + (sun[h] - load[h]) * .92)); socs.push(soc); }
      const maxY = Math.max(...sun, ...load) * 1.15;
      const maxB = batt;
      const sx = h => P.l + (W - P.l - P.r) * h / 24, sy = v => P.t + (H - P.t - P.b) * (1 - v / maxY), sb = v => P.t + (H - P.t - P.b) * (1 - v / maxB * .55);
      frame(day, maxY, '', [[sx(0), '00'], [sx(6), '06'], [sx(12), '12'], [sx(18), '18'], [sx(24), '24']]);
      const line = (arr, f) => arr.map((v, h) => `${h ? 'L' : 'M'}${sx(h).toFixed(1)},${f(v).toFixed(1)}`).join('');
      el('path', { class: 'area-batt', d: line(socs, sb) + `L${sx(24)},${H - P.b}L${sx(0)},${H - P.b}Z` }, day);
      el('path', { class: 'area-sun', d: line(sun, sy) + `L${sx(24)},${H - P.b}L${sx(0)},${H - P.b}Z` }, day);
      const ls = el('path', { class: 'line-sun draw', d: line(sun, sy) }, day);
      el('path', { class: 'line-load', d: line(load, sy) }, day);
      el('circle', { class: 'tip-dot', cx: sx(12.5), cy: sy(kwp * .82), r: 6 }, day);
      ls.style.setProperty('--len', Math.ceil(ls.getTotalLength()));
      $('#peakOut').textContent = (kwp * .82).toFixed(1) + ' kW peak';
    }
    function drawCash(cost, yearly) {
      const yrs = 10, vals = Array.from({ length: yrs + 1 }, (_, y) => -cost + yearly * y * Math.pow(.995, y));
      const max = Math.max(...vals), min = Math.min(...vals), span = max - min;
      const sx = i => P.l + 6 + (W - P.l - P.r - 12) * i / (yrs + 1), bw = (W - P.l - P.r) / (yrs + 1) * .62;
      const sy = v => P.t + (H - P.t - P.b) * (1 - (v - min) / span);
      frame(cash, max / 1000, 'k', vals.map((_, i) => [sx(i) + bw / 2, 'Y' + i]));
      // relabel y axis to span min..max
      $$('text', cash).slice(0, 5).forEach((t, i) => { t.textContent = ((max - span * i / 4) / 1000).toFixed(0) + 'k'; });
      el('line', { class: 'zero', x1: P.l, x2: W - P.r, y1: sy(0), y2: sy(0) }, cash);
      let paid = false;
      vals.forEach((v, i) => {
        const y0 = sy(0), y1 = sy(v);
        let cls = 'bar' + (v >= 0 ? ' pos' : '');
        if (v >= 0 && !paid) { cls = 'bar pay'; paid = true; }
        el('rect', { class: cls, x: sx(i), width: bw, y: Math.min(y0, y1), height: Math.max(2, Math.abs(y1 - y0)), rx: 4 }, cash);
      });
      $('#tenOut').textContent = fmt(vals.at(-1)) + ' net by year 10';
    }

    segBtns.forEach(b => b.addEventListener('click', () => {
      segBtns.forEach(x => x.setAttribute('aria-pressed', x === b));
      type = b.dataset.type; update();
    }));
    [bill, fuel].forEach(r => r.addEventListener('input', update));
    update();
  }

  /* ---------- standalone charts on inner pages ---------- */
  $$('[data-chart="soc"]').forEach(svg => {
    const W = 560, H = 220;
    const soc = [62, 55, 49, 44, 40, 37, 36, 40, 52, 66, 79, 90, 97, 100, 100, 99, 95, 86, 74, 66, 60, 56, 52, 48, 45];
    const sx = h => 34 + (W - 42) * h / 24, sy = v => 10 + (H - 34) * (1 - v / 100);
    const d = soc.map((v, h) => `${h ? 'L' : 'M'}${sx(h)},${sy(v)}`).join('');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.innerHTML = `<defs><linearGradient id="gSoc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#00a35e" stop-opacity=".5"/><stop offset="1" stop-color="#00a35e" stop-opacity="0"/></linearGradient></defs>
      <g class="grid">${[0, 25, 50, 75, 100].map(v => `<line x1="34" x2="${W - 8}" y1="${sy(v)}" y2="${sy(v)}"/><text x="0" y="${sy(v) + 3}">${v}%</text>`).join('')}</g>
      <rect x="${sx(0)}" y="10" width="${sx(6) - sx(0)}" height="${H - 34}" fill="rgba(227,22,30,.12)"/><rect x="${sx(18)}" y="10" width="${sx(22) - sx(18)}" height="${H - 34}" fill="rgba(227,22,30,.12)"/>
      <text x="${sx(3)}" y="24" text-anchor="middle" style="fill:#ff8a8e">grid off</text><text x="${sx(20)}" y="24" text-anchor="middle" style="fill:#ff8a8e">grid off</text>
      <path d="${d}L${sx(24)},${H - 24}L${sx(0)},${H - 24}Z" fill="url(#gSoc)"/>
      <path class="line-sun draw" style="--len:900;stroke:#3ddc84" d="${d}"/>
      ${[0, 6, 12, 18, 24].map(h => `<text x="${sx(h)}" y="${H - 6}" text-anchor="middle">${String(h).padStart(2, '0')}:00</text>`).join('')}`;
  });

  /* ---------- contact form: opens the visitor's email app with the enquiry ---------- */
  const form = $('#quoteForm');
  form?.addEventListener('submit', e => {
    e.preventDefault();
    const d = new FormData(form);
    const needs = d.getAll('need').join(', ') || 'Not specified';
    const body = `Name: ${d.get('name')}\nPhone: ${d.get('phone')}\nEmail: ${d.get('email')}\nLocation: ${d.get('location')}\nProperty: ${d.get('property')}\nInterested in: ${needs}\n\n${d.get('message')}`;
    location.href = `mailto:sales@trogon.co.zw?subject=${encodeURIComponent('Site survey request: ' + d.get('name'))}&body=${encodeURIComponent(body)}`;
    $('.form-status', form).textContent = 'Opening your email app. You can also WhatsApp us on +263 77 730 7437.';
  });

  $$('[data-year]').forEach(el => (el.textContent = new Date().getFullYear()));
})();
