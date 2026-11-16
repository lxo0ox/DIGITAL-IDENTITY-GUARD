/* Digital Identity Guard — page behaviour (navigation, language, report). */
(function () {
  'use strict';

  const A = window.DIGAnalyzer;
  const STRINGS = window.DIGStrings;
  const $ = (id) => document.getElementById(id);
  const PAGES = ['home', 'scan', 'about', 'tips'];

  let lang = 'ar';
  let lastResult = null;

  try {
    const saved = localStorage.getItem('dig-lang');
    if (saved === 'ar' || saved === 'en') lang = saved;
  } catch (e) { /* storage unavailable: keep default */ }

  function t(key, params) {
    let s = STRINGS[lang][key];
    if (s == null) s = STRINGS.ar[key] != null ? STRINGS.ar[key] : key;
    if (params) s = s.replace(/\{(\w+)\}/g, (m, k) => (params[k] != null ? params[k] : m));
    return s;
  }

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (k === 'text') node.textContent = v;
      else node.setAttribute(k, v);
    });
    (children || []).forEach((c) => node.append(c));
    return node;
  }

  // Wrap user-entered or Latin text so it reads correctly inside Arabic sentences.
  function bdi(text) {
    return el('bdi', { class: 'code', text });
  }

  // ------------------------------------------------------- language ---

  function applyLanguage() {
    const html = document.documentElement;
    html.lang = lang;
    html.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.title = t('meta.title');
    document.querySelectorAll('[data-i18n]').forEach((n) => { n.textContent = t(n.dataset.i18n); });
    document.querySelectorAll('[data-i18n-ph]').forEach((n) => { n.placeholder = t(n.dataset.i18nPh); });
    document.querySelectorAll('[data-pts]').forEach((n) => { n.textContent = '+' + A.MANUAL[n.dataset.pts]; });
    $('lang').setAttribute('lang', lang === 'ar' ? 'en' : 'ar');
    if (!$('account-error').hidden && $('account-error').textContent) $('account-error').textContent = t('scan.errorEmpty');
    if (lastResult) renderReport(lastResult);
  }

  $('lang').addEventListener('click', () => {
    lang = lang === 'ar' ? 'en' : 'ar';
    try { localStorage.setItem('dig-lang', lang); } catch (e) { /* ignore */ }
    applyLanguage();
  });

  // ----------------------------------------------------- navigation ---

  function show(page) {
    if (!PAGES.includes(page)) page = 'home';
    PAGES.forEach((p) => $(p).classList.toggle('hidden', p !== page));
    document.querySelectorAll('[data-page]').forEach((b) => {
      const on = b.dataset.page === page;
      b.classList.toggle('active', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
  }

  document.querySelectorAll('[data-page]').forEach((b) => b.addEventListener('click', () => show(b.dataset.page)));
  $('start').addEventListener('click', () => {
    show('scan');
    $('account').focus();
  });

  // --------------------------------------------------------- report ---

  const COLORS = { low: '#19b7a5', medium: '#d6a342', high: '#dc6262' };

  function factorItem(f, cls) {
    const title = el('span', { class: 'f-title' }, [
      t('f.' + f.id, f.params),
      el('span', { class: 'f-src', text: t('src.' + f.source) }),
    ]);
    const pts = el('span', { class: 'f-pts', text: f.points ? '+' + f.points : '' });
    const desc = el('span', { class: 'f-desc', text: t('f.' + f.id + '.d', f.params) });
    return el('li', { class: cls || 'src-' + f.source }, [title, pts, desc]);
  }

  function renderReport(r) {
    $('score').textContent = r.score + '%';
    $('score').className = 'result level-' + r.level;
    $('bar').style.width = r.score + '%';
    $('bar').style.background = COLORS[r.level];
    $('meter').setAttribute('aria-valuenow', r.score);
    $('risk').textContent = t('report.level', { level: t('level.' + r.level) });
    $('risk').className = 'level-' + r.level;

    // What was recognised.
    const dl = $('detected');
    dl.replaceChildren();
    const row = (k, v) => dl.append(el('dt', { text: k }), el('dd', {}, [v]));
    row(t('report.type'), t('report.type.' + r.parsed.kind));
    if (r.parsed.kind === 'link') {
      row(t('report.platform'), r.parsed.platform ? bdi(r.parsed.platform) : t('report.platformUnknown'));
    }
    if (r.parsed.username) row(t('report.username'), bdi('@' + r.parsed.username));

    // Reasons: patterns first (strongest), then automatic, then the user's own.
    const order = { pattern: 0, auto: 1, manual: 2 };
    const sorted = r.factors.slice().sort((a, b) => order[a.source] - order[b.source] || b.points - a.points);
    const list = $('factors');
    list.replaceChildren();
    r.notes.forEach((n) => list.append(factorItem({ id: n.id, source: 'auto', points: 0, params: {} }, 'src-note')));
    sorted.forEach((f) => list.append(factorItem(f)));
    if (!sorted.length) list.append(el('li', { class: 'src-note' }, [el('span', { class: 'f-desc', text: t('report.none') })]));

    const caps = $('caps');
    caps.replaceChildren();
    r.caps.forEach((c) => caps.append(el('p', { class: 'cap-note', text: t('report.capNote', { group: t('group.' + c.group), cap: c.cap, raw: c.raw }) })));

    // Automatic checks that ran.
    const checks = $('auto-checks');
    checks.replaceChildren();
    r.checks.forEach((c) => {
      checks.append(el('li', { class: c.flagged ? 'flag' : 'ok', text: (c.flagged ? '⚠️ ' : '✅ ') + t('checkname.' + c.id) }));
    });
    $('checks-block').classList.toggle('hidden', !r.checks.length);

    $('advice').textContent = t('advice.' + r.level);
  }

  // ------------------------------------------------------- form flow ---

  $('scan-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const account = $('account').value.trim();
    if (!account) {
      $('account-error').textContent = t('scan.errorEmpty');
      $('account').setAttribute('aria-invalid', 'true');
      $('account').focus();
      return;
    }
    $('account-error').textContent = '';
    $('account').removeAttribute('aria-invalid');

    const manual = [...document.querySelectorAll('#checks input:checked')].map((c) => c.value);
    lastResult = A.analyze({ account, expected: $('expected').value.trim(), manual });

    // Reset the bar first so it animates from 0 on every run.
    $('bar').style.width = '0';
    $('report').classList.remove('hidden');
    requestAnimationFrame(() => {
      renderReport(lastResult);
      $('report').focus({ preventScroll: true });
      $('report').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  $('account').addEventListener('input', () => {
    if ($('account').value.trim()) {
      $('account-error').textContent = '';
      $('account').removeAttribute('aria-invalid');
    }
  });

  $('reset').addEventListener('click', () => {
    $('scan-form').reset();
    lastResult = null;
    $('report').classList.add('hidden');
    $('bar').style.width = '0';
    $('score').textContent = '0%';
    $('meter').setAttribute('aria-valuenow', 0);
    $('account').focus();
  });

  applyLanguage();
  show('home');
})();
