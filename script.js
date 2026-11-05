/* ===== Тоқтағул Алина — электронды портфолио: кітап сияқты парақ аудару =====
   • Компьютерде — ашық кітап (екі бет қатар), телефонда — бір бет.
   • Беттің кез келген бос жерін басу / → пернесі / солға сипау  → келесі бет.
   • ‹ батыр­масы / ← пернесі / оңға сипау                          → алдыңғы бет.
   • «☰ Мазмұны» арқылы кез келген бетке бірден өту (беттер қатарымен аударылады).
   JavaScript істемесе, style.css ішіндегі CSS-only нұсқа жұмыс істей береді.     */
(function () {
  'use strict';

  var root = document.documentElement;
  var book = document.querySelector('.book');
  if (!book) return;
  var pages = Array.prototype.filter.call(book.children, function (el) {
    return el.classList && el.classList.contains('page');
  });
  if (!pages.length) return;
  root.classList.add('js');

  var N = pages.length;                       // барлық бет (мұқабасымен) = 24
  var ids = pages.map(function (p) { return p.id; });
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var spreadMQ = window.matchMedia('(min-width: 900px) and (min-aspect-ratio: 23/20)');

  var mode = '';           // 'spread' (екі бет) | 'single' (бір бет)
  var leaves = [];         // { el, front, back, i, prog, anim }
  var target = 0;          // аударылған парақтар саны (қалаған күй)
  var curPage = 0;         // ағымдағы бет индексі (0 = мұқаба)
  var backCover = null;
  var rafId = 0;
  var suppressUntil = 0;

  var FLIP_MS = 950, MULTI_MS = 800;

  /* ---------- көмекші функциялар ---------- */
  function ease(u) { return u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2; }
  function maxState() { return mode === 'spread' ? Math.ceil((N - 1) / 2) + 0 : N - 1; }
  function pageToState(p) { return mode === 'spread' ? Math.ceil(p / 2) : p; }
  function stateToPage(s) {
    if (mode === 'spread') return s === 0 ? 0 : Math.min(2 * s, N - 1);
    return s;
  }
  function idxOf(id) { return ids.indexOf(id); }

  /* ---------- кітапты құру ---------- */
  function build() {
    var i, leaf, front, back, blank;
    pages.forEach(function (p) { p.classList.remove('lt', 'rt', 'bk'); p.style.visibility = ''; p.style.removeProperty('--shade'); });
    book.textContent = '';
    leaves = [];
    book.setAttribute('data-mode', mode);

    if (mode === 'spread') {
      backCover = document.createElement('div');
      backCover.className = 'backcover';
      backCover.innerHTML = '<div class="bc-frame"><span>ЭЛЕКТРОНДЫ ПОРТФОЛИО</span><b>Тоқтағул Алина</b>' +
        '<button type="button" data-goto="cover">↺ Мұқабаға оралу</button></div>' +
        '<button type="button" class="toc-btn toc-abs" data-toc aria-haspopup="dialog">☰ Мазмұны</button>';
      book.appendChild(backCover);
      for (i = 0; i * 2 < N; i++) {
        leaf = document.createElement('div');
        leaf.className = 'leaf';
        front = pages[2 * i]; back = pages[2 * i + 1] || null;
        front.classList.add('rt'); leaf.appendChild(front);
        if (back) { back.classList.add('lt', 'bk'); leaf.appendChild(back); }
        book.appendChild(leaf);
        leaves.push({ el: leaf, front: front, back: back, i: i, prog: 0, anim: null, fv: '', bv: '' });
      }
    } else {
      backCover = null;
      for (i = 0; i < N; i++) {
        leaf = document.createElement('div');
        leaf.className = 'leaf';
        front = pages[i]; front.classList.add('rt'); leaf.appendChild(front);
        blank = document.createElement('div');
        blank.className = 'page lt bk blank';
        blank.setAttribute('aria-hidden', 'true');
        leaf.appendChild(blank);
        book.appendChild(leaf);
        leaves.push({ el: leaf, front: front, back: blank, i: i, prog: 0, anim: null, fv: '', bv: '' });
      }
    }
  }

  /* ---------- күйді қолдану ---------- */
  function applyLeafTransform(L) {
    var a = -180 * L.prog;
    L.el.style.transform = L.prog === 0 ? '' : 'rotateY(' + a.toFixed(2) + 'deg)';
  }

  function setShade(el, v) {
    if (!el) return;
    var cur = el._shade || 0;
    if (Math.abs(cur - v) < 0.004 && !(v === 0 && cur !== 0)) return;
    el._shade = v;
    el.style.setProperty('--shade', v.toFixed(3));
  }

  function layout() {
    var n = leaves.length, i, L, topL = -1, topR = -1, castR = 0, castL = 0;
    for (i = 0; i < n; i++) {
      L = leaves[i];
      var moving = !!L.anim;
      if (!moving) {
        if (L.prog >= 1) topL = i;
        else if (topR === -1) topR = i;
      }
    }
    for (i = 0; i < n; i++) {
      L = leaves[i];
      if (L.prog > 0 && L.prog < 1) {
        var t = L.prog;
        if (t < .5) castR = Math.max(castR, Math.sin(Math.PI * 2 * t));
        else castL = Math.max(castL, Math.sin(Math.PI * 2 * (1 - t)));
      }
    }
    for (i = 0; i < n; i++) {
      L = leaves[i];
      var mv = !!L.anim;
      var z;
      if (mv) z = 1000 + (L.prog < .5 ? n - i : i);
      else z = (L.prog >= 1 ? i : n - i) + 1;
      L.el.style.zIndex = z;
      L.el.classList.toggle('moving', mv);
      var show = mv || i === topL || i === topR;
      L.el.style.visibility = show ? 'visible' : 'hidden';
      // әр беттің өз беті ғана көрінеді (Tab пернесі көрінбейтін сілтемеге түспейді)
      var fv, bv;
      if (mv) { fv = 'visible'; bv = 'visible'; }
      else if (L.prog >= 1) { fv = 'hidden'; bv = 'visible'; }
      else { fv = 'visible'; bv = 'hidden'; }
      if (L.fv !== fv) { L.front.style.visibility = fv; L.fv = fv; }
      if (L.back && L.bv !== bv) { L.back.style.visibility = bv; L.bv = bv; }
      // көлеңкелер
      var sf = 0, sb = 0;
      if (L.prog > 0 && L.prog < 1) {
        var s = Math.sin(Math.PI * L.prog) * .65;
        if (L.prog < .5) sf = s; else sb = s;
      } else if (!mv) {
        if (i === topR) sf = castR * .9;
        if (i === topL) sb = castL * .9;
      }
      setShade(L.front, sf);
      setShade(L.back, sb);
    }
    // артқы мұқаба тек кітаптың соңында (немесе соңғы парақ аударылып жатқанда) көрінеді
    if (backCover && n) backCover.style.visibility = leaves[n - 1].prog > 0 ? 'visible' : 'hidden';
  }

  function updateShift(animate) {
    if (mode !== 'spread') { book.style.removeProperty('--shift'); return; }
    if (!animate) { book.classList.add('nt'); }
    book.style.setProperty('--shift', target === 0 ? '-25%' : '0%');
    if (!animate) { void book.offsetWidth; book.classList.remove('nt'); }
  }

  /* ---------- анимация ---------- */
  function tick(now) {
    var busy = false;
    for (var i = 0; i < leaves.length; i++) {
      var L = leaves[i], A = L.anim;
      if (!A) continue;
      if (now < A.start) { busy = true; continue; }
      var u = A.dur <= 0 ? 1 : Math.min(1, (now - A.start) / A.dur);
      L.prog = A.from + (A.to - A.from) * ease(u);
      if (u >= 1) { L.prog = A.to; L.anim = null; } else busy = true;
      applyLeafTransform(L);
    }
    layout();
    rafId = busy ? requestAnimationFrame(tick) : 0;
  }

  function flipLeaf(L, goal, delay, dur) {
    if (L.anim && L.anim.to === goal) return;
    var distance = Math.abs(goal - L.prog);
    if (reduce) { L.prog = goal; L.anim = null; applyLeafTransform(L); return; }
    L.anim = { from: L.prog, to: goal, start: performance.now() + delay, dur: dur * Math.max(.35, distance) };
  }

  function setTarget(s, instant) {
    var max = maxState();
    s = Math.max(0, Math.min(max, s));
    var prev = target;
    target = s;
    var changed = [], i;
    if (s > prev) { for (i = prev; i < s; i++) changed.push(i); }
    else if (s < prev) { for (i = prev - 1; i >= s; i--) changed.push(i); }
    var many = changed.length > 1;
    var gap = many ? Math.min(110, 1100 / changed.length) : 0;
    changed.forEach(function (idx, k) {
      var L = leaves[idx];
      if (!L) return;
      if (instant) { L.prog = idx < s ? 1 : 0; L.anim = null; applyLeafTransform(L); }
      else flipLeaf(L, idx < s ? 1 : 0, k * gap, many ? MULTI_MS : FLIP_MS);
    });
    // аралықта өтіп кеткен парақтар да дұрыс жағында тұруы керек
    leaves.forEach(function (L, idx) {
      var want = idx < s ? 1 : 0;
      if (!L.anim && L.prog !== want) { L.prog = want; applyLeafTransform(L); }
    });
    updateShift(!instant);
    layout();
    markToc();
    if (!rafId && !instant) rafId = requestAnimationFrame(tick);
  }

  /* ---------- навигация ---------- */
  function syncHash() {
    var id = ids[curPage];
    if (id && history.replaceState) {
      try { history.replaceState(null, '', '#' + id); } catch (e) { /* file:// кейбір браузерде */ }
    }
  }
  function next() { if (target < maxState()) { setTarget(target + 1); curPage = stateToPage(target); syncHash(); } }
  function prev() { if (target > 0) { setTarget(target - 1); curPage = stateToPage(target); syncHash(); } }
  function goToPage(p, instant) {
    if (p < 0 || p >= N) return;
    var s = pageToState(p);
    curPage = p;
    if (s === target) {
      var sheet = pages[p].querySelector('.sheet');
      if (sheet && sheet.scrollTo) sheet.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
      markToc(); syncHash(); return;
    }
    setTarget(s, !!instant);
    syncHash();
  }
  function goToId(id) { var p = idxOf(id); if (p >= 0) goToPage(p); }

  /* ---------- мазмұн (☰ Мазмұны) ---------- */
  var toc = document.getElementById('toc');
  var tocBack = document.getElementById('toc-backdrop');
  var tocClose = document.getElementById('toc-close');
  var tocRows = toc ? Array.prototype.slice.call(toc.querySelectorAll('.toc-row')) : [];
  var tocOpener = null, tocOpen = false;

  function visiblePages() {
    if (mode === 'spread') {
      if (target === 0) return [0];
      var r = [2 * target - 1];
      if (2 * target <= N - 1) r.push(2 * target);
      return r;
    }
    return [target];
  }
  function markToc() {
    if (!tocRows.length) return;
    var vis = visiblePages();
    tocRows.forEach(function (row) {
      var p = parseInt(row.getAttribute('data-page'), 10);
      var on = vis.indexOf(p) !== -1;
      row.classList.toggle('cur', on);
      if (on) row.setAttribute('aria-current', 'page'); else row.removeAttribute('aria-current');
    });
  }
  function openToc(opener) {
    if (!toc || tocOpen) return;
    tocOpener = opener || null; tocOpen = true;
    toc.hidden = false; tocBack.hidden = false;
    void toc.offsetWidth;
    toc.classList.add('open'); tocBack.classList.add('open');
    markToc();
    var cur = toc.querySelector('.toc-row.cur');
    if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'center' });
    (cur || tocClose).focus({ preventScroll: true });
  }
  function closeToc(restoreFocus) {
    if (!toc || !tocOpen) return;
    tocOpen = false;
    toc.classList.remove('open'); tocBack.classList.remove('open');
    setTimeout(function () { if (!tocOpen) { toc.hidden = true; tocBack.hidden = true; } }, 260);
    if (restoreFocus !== false && tocOpener && document.contains(tocOpener) && tocOpener.offsetParent !== null) {
      try { tocOpener.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    }
  }
  if (toc) {
    tocClose.addEventListener('click', function () { closeToc(); });
    tocBack.addEventListener('click', function () { closeToc(); });
    toc.addEventListener('click', function (e) {
      var row = e.target.closest('.toc-row');
      if (!row) return;
      e.preventDefault();
      var p = parseInt(row.getAttribute('data-page'), 10);
      closeToc(false);
      setTimeout(function () { goToPage(p); }, 180);
    });
  }

  /* ---------- оқиғалар ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t.closest) return;
    var tb = t.closest('[data-toc]');
    if (tb) { e.preventDefault(); e.stopPropagation(); openToc(tb); return; }
    var gb = t.closest('[data-goto]');
    if (gb) { e.preventDefault(); goToId(gb.getAttribute('data-goto')); return; }

    // ескі «☰ Мәзір» панелі
    var ma = t.closest('.menuPanel a[href^="#"]');
    if (ma) {
      e.preventDefault();
      var cb = document.getElementById('menu-toggle'); if (cb) cb.checked = false;
      goToId(ma.getAttribute('href').slice(1));
      return;
    }
    if (!t.closest('.book')) return;

    // кітап ішіндегі ішкі сілтемелер (плиткалар, ‹ ›, «Байланысу», «← қайту»)
    var a = t.closest('a[href^="#"]');
    if (a) { e.preventDefault(); goToId(a.getAttribute('href').slice(1)); return; }

    // басқа интерактивті элементтер парақ аударуға қатыспайды
    if (t.closest('a,button,input,textarea,select,label,summary,[data-noflip]')) return;
    if (Date.now() < suppressUntil) return;
    if (t.classList && t.classList.contains('sheet') && e.offsetX >= t.clientWidth) return; // айналдыру жолағы
    var sel = window.getSelection && window.getSelection();
    if (sel && String(sel).length > 0) return;                                              // мәтін белгіленген
    next();
  });

  document.addEventListener('keydown', function (e) {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    if (tocOpen) {
      if (e.key === 'Escape') { e.preventDefault(); closeToc(); }
      else if (e.key === 'Tab') {
        var f = [tocClose].concat(tocRows), idx = f.indexOf(document.activeElement);
        e.preventDefault();
        f[(idx + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
      }
      return;
    }
    var cb = document.getElementById('menu-toggle');
    if (cb && cb.checked) { if (e.key === 'Escape') cb.checked = false; return; }
    var tag = (document.activeElement && document.activeElement.tagName) || '';
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag) && document.activeElement.type !== 'checkbox') return;
    if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
    else if (e.key === 'Home') { e.preventDefault(); goToPage(0); }
    else if (e.key === 'End') { e.preventDefault(); goToPage(N - 1); }
  });

  // сенсорлы экран: солға сипау — келесі, оңға сипау — алдыңғы бет
  var sx = 0, sy = 0, st = 0, tracking = false;
  book.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse') return;
    tracking = true; sx = e.clientX; sy = e.clientY; st = Date.now();
  });
  book.addEventListener('pointerup', function (e) {
    if (!tracking) return;
    tracking = false;
    var dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5 && Date.now() - st < 900) {
      suppressUntil = Date.now() + 400;
      if (dx < 0) next(); else prev();
    }
  });
  book.addEventListener('pointercancel', function () { tracking = false; });

  // сыртқы URL хэші өзгерсе (қолмен жазылса)
  window.addEventListener('hashchange', function () {
    var id = location.hash.slice(1), p = idxOf(id);
    if (p >= 0 && p !== curPage) goToPage(p);
  });

  /* ---------- режимді таңдау (екі бет / бір бет) ---------- */
  function setup(first) {
    var want = spreadMQ.matches ? 'spread' : 'single';
    if (want === mode && !first) return;
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    mode = want;
    build();
    target = 0;
    var s = pageToState(curPage);
    // барлық парақты лезде қою
    target = s;
    leaves.forEach(function (L, idx) { L.prog = idx < s ? 1 : 0; L.anim = null; applyLeafTransform(L); });
    updateShift(false);
    layout();
    markToc();
  }
  var rt;
  function onModeChange() { clearTimeout(rt); rt = setTimeout(function () { setup(false); }, 120); }
  if (spreadMQ.addEventListener) spreadMQ.addEventListener('change', onModeChange);
  else if (spreadMQ.addListener) spreadMQ.addListener(onModeChange);

  // бастапқы бет (URL хэшінен)
  var startIdx = idxOf(location.hash.slice(1));
  curPage = startIdx >= 0 ? startIdx : 0;
  setup(true);

  // PWA: офлайн жұмыс және телефонға орнату
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
})();
