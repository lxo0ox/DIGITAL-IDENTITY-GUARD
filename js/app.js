/* Digital Identity Guard — page behaviour (navigation, language, form, report). */
(function () {
  'use strict';

  const A = window.DIGAnalyzer;
  const G = window.DIGGuard;
  const DIR = window.DIGDirectory || { orgs: [] };
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
    // Values are wrapped in Unicode isolates so "@name" or a link keeps its direction inside Arabic text.
    if (params) s = s.replace(/\{(\w+)\}/g, (m, k) => (params[k] != null ? '\u2068' + params[k] + '\u2069' : m));
    return s;
  }

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (k === 'text') node.textContent = v;
      else node.setAttribute(k, v);
    });
    (children || []).forEach((c) => c != null && node.append(c));
    return node;
  }

  // User-entered or Latin text, isolated so it reads correctly inside Arabic.
  const bdi = (text) => el('bdi', { class: 'code', text });
  const platformName = (id) => (A.PLATFORMS.find((p) => p.id === id) || { name: id || '' }).name;
  const orgName = (org) => (org ? org.name[lang] || org.name.en : '');
  const handleText = (h) => '@' + String(h || '').replace(/^@+/, '');

  // ------------------------------------------------------- language ---

  function fillOrgList() {
    const list = $('orgs');
    list.replaceChildren();
    DIR.orgs.forEach((org) => list.append(el('option', { value: orgName(org) })));
  }

  function applyLanguage() {
    const html = document.documentElement;
    html.lang = lang;
    html.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.title = t('meta.title');
    document.querySelectorAll('[data-i18n]').forEach((n) => { n.textContent = t(n.dataset.i18n); });
    document.querySelectorAll('[data-i18n-ph]').forEach((n) => { n.placeholder = t(n.dataset.i18nPh); });
    $('lang').setAttribute('lang', lang === 'ar' ? 'en' : 'ar');
    if ($('account-error').textContent) $('account-error').textContent = t('scan.errorEmpty');
    fillOrgList();
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

  // ------------------------------------------------------- examples ---

  const EXAMPLES = {
    1: { account: 'https://www.instagram.com/yazan_0mar', claim: () => 'https://www.instagram.com/yazan_omar',
      badge: 'none', messages: () => t('ex.1.msg'), manual: ['new_account'] },
    2: { account: 'https://x.com/Bank_Support_KSA1', claim: () => t('ex.2.claim'),
      badge: 'blue', messages: () => t('ex.2.msg'), manual: [] },
    3: { account: 'https://www.tiktok.com/@daily.profit.sa', claim: () => '',
      badge: 'none', messages: () => t('ex.3.msg'), manual: ['new_account', 'suspicious_photo'] },
  };

  document.querySelectorAll('[data-example]').forEach((b) => b.addEventListener('click', () => {
    const ex = EXAMPLES[b.dataset.example];
    $('scan-form').reset();
    clearShots();
    $('account').value = ex.account;
    $('claim').value = ex.claim();
    $('messages').value = ex.messages();
    document.querySelector(`input[name=badge][value=${ex.badge}]`).checked = true;
    ex.manual.forEach((m) => { document.querySelector(`#checks input[value=${m}]`).checked = true; });
    $('scan-form').requestSubmit();
  }));

  // --------------------------------------------------------- report ---

  function item(cls, title, desc, extra) {
    return el('li', { class: cls }, [
      el('span', { class: 'f-title' }, [title, extra || null]),
      el('span', { class: 'f-desc', text: desc }),
    ]);
  }

  function renderIdentity(r) {
    const id = r.identity;
    const box = $('r-identity');
    box.replaceChildren();
    const key = 'id.' + id.status + '.' + id.reason;
    const params = {
      org: orgName(id.org),
      platform: platformName((id.match && id.match.platform) || r.parsed.platformId),
      handle: id.match ? handleText(id.match.handle) : '',
      text: id.claim && id.claim.text ? id.claim.text : '',
    };
    const cls = { official: 'ok', not_official: 'bad', unconfirmed: 'warn', none: 'info' }[id.status];
    box.append(el('div', { class: 'status status-' + cls }, [
      el('b', { text: t(key, params) }),
      el('p', { text: t(key + '.d', params) }),
    ]));

    const org = id.org;
    if (org) {
      const accounts = G.sourcedAccounts(org);
      if (accounts.length) {
        const ul = el('ul', { class: 'official-list' });
        accounts.forEach((a) => ul.append(el('li', {}, [
          platformName(a.platform) + ': ', bdi(handleText(a.handle)), ' · ',
          el('a', { href: a.source, target: '_blank', rel: 'noopener noreferrer', text: t('sec.source') }),
        ])));
        box.append(el('p', { class: 'muted', text: t('sec.officialList') }), ul);
      }
      if (org.website) {
        box.append(el('p', { class: 'muted' }, [t('sec.website') + ' ',
          el('a', { href: org.website, target: '_blank', rel: 'noopener noreferrer' }, [bdi(org.website.replace(/^https?:\/\//, ''))])]));
      }
    }
  }

  function renderBadge(r) {
    const sec = $('r-badge-sec');
    const box = $('r-badge');
    box.replaceChildren();
    if (!r.badge) { sec.classList.add('hidden'); return; }
    sec.classList.remove('hidden');
    const b = r.badge;
    const desc = b.id === 'badge_none' ? t(b.warn ? 'b.badge_none.org' : 'b.badge_none.person') : t('b.' + b.id + '.d');
    box.append(el('div', { class: 'status status-' + (b.warn ? 'warn' : 'info') }, [
      el('b', { text: t('b.' + b.id) }), el('p', { text: desc }),
    ]));
    if (b.id !== 'badge_none') box.append(el('p', { class: 'muted', text: t('b.tip') }));
  }

  function renderMessages(r) {
    const list = $('r-messages');
    list.replaceChildren();
    const order = { decisive: 0, strong: 1, weak: 2 };
    const fs = r.messages.findings.slice().sort((a, b) => order[a.severity] - order[b.severity]);
    if (!lastInput.messages) {
      list.append(el('li', { class: 'sev-none' }, [el('span', { class: 'f-desc', text: t('m.empty') })]));
      return;
    }
    if (!fs.length) {
      list.append(el('li', { class: 'sev-none' }, [el('span', { class: 'f-desc', text: t('m.none') })]));
      return;
    }
    fs.forEach((f) => {
      const li = item('sev-' + f.severity, t('m.' + f.id, f.params), t('m.' + f.id + '.d', f.params),
        el('span', { class: 'f-src', text: t('sev.' + f.severity) }));
      li.append(el('blockquote', { dir: 'auto', text: '«' + f.quote + '»' }));
      list.append(li);
    });
  }

  function renderSignals(r) {
    const list = $('r-signals');
    list.replaceChildren();
    const fs = r.signals.factors.filter((f) => f.source !== 'pattern');
    if (!fs.length) list.append(el('li', { class: 'sev-none' }, [el('span', { class: 'f-desc', text: t('s.none') })]));
    fs.forEach((f) => list.append(item('src-' + f.source, t('f.' + f.id, f.params), t('f.' + f.id + '.d', f.params),
      el('span', { class: 'f-src', text: t('src.' + f.source) }))));

    const checks = $('auto-checks');
    checks.replaceChildren();
    r.signals.checks.forEach((c) => {
      checks.append(el('li', { class: c.flagged ? 'flag' : 'ok', text: (c.flagged ? '⚠️ ' : '✅ ') + t('checkname.' + c.id) }));
    });
    $('checks-block').classList.toggle('hidden', !r.signals.checks.length);
  }

  function renderReport(r) {
    $('verdict').className = 'verdict verdict-' + r.level;
    $('v-title').textContent = t('v.' + r.level);
    $('v-desc').textContent = t('v.' + r.level + '.d');
    $('v-action').textContent = t('v.' + r.level + '.a');
    const notes = $('v-notes');
    notes.replaceChildren();
    r.notes.forEach((n) => notes.append(el('p', { class: 'note', text: t('note.' + n) })));

    const dl = $('detected');
    dl.replaceChildren();
    const row = (k, v) => dl.append(el('dt', { text: k }), el('dd', {}, [v]));
    row(t('report.type'), t('report.type.' + r.parsed.kind));
    if (r.parsed.kind === 'link') row(t('report.platform'), r.parsed.platform ? bdi(r.parsed.platform) : t('report.platformUnknown'));
    if (r.parsed.username) row(t('report.username'), bdi(handleText(r.parsed.username)));

    renderIdentity(r);
    renderBadge(r);
    renderMessages(r);
    renderSignals(r);
  }

  // ---------------------------------------------------- screenshots ---

  const V = window.DIGVision;
  const shotUrls = [];
  let shotQueue = Promise.resolve();

  function appendText(text) {
    const box = $('messages');
    box.value = box.value.trim() ? box.value.trim() + '\n\n' + text : text;
  }

  function showCandidates(accounts) {
    const wrap = $('shot-cands');
    accounts.forEach((acc) => {
      if (!acc || [...wrap.children].some((b) => b.dataset.value === acc)) return;
      const b = el('button', { type: 'button', class: 'chip', 'data-value': acc }, [bdi(acc)]);
      b.addEventListener('click', () => {
        $('account').value = acc;
        $('account').dispatchEvent(new Event('input'));
        $('account').focus();
      });
      wrap.append(b);
    });
    $('shot-found').classList.toggle('hidden', !wrap.children.length);
  }

  function summary(r, form) {
    const dl = el('dl', { class: 'shot-dl' });
    const row = (k, v) => dl.append(el('dt', { text: t(k) }), el('dd', {}, [v]));
    row('shot.platform', r.platform === 'unknown' ? t('report.platformUnknown') : bdi(platformName(r.platform)));
    if (r.account.username) row('shot.username', bdi(handleText(r.account.username)));
    const badge = ['none', 'blue', 'gold', 'grey'].includes(r.badge) ? t('badge.' + r.badge) : t('shot.badgeUnclear');
    row('shot.badge', badge);
    row('shot.messages', String(form.fromThem));
    return dl;
  }

  function readShot(file) {
    const url = URL.createObjectURL(file);
    shotUrls.push(url);
    const status = el('span', { class: 'shot-status', text: t('shot.reading') });
    const bar = el('div', { class: 'shot-bar busy' }, [el('div')]);
    const info = el('div', { class: 'shot-info' }, [el('span', { class: 'shot-name', text: file.name || 'screenshot' }), status, bar]);
    const li = el('li', { class: 'shot' }, [el('img', { src: url, alt: '' }), info]);
    $('shot-list').append(li);

    if (!/^image\//.test(file.type)) {
      status.textContent = t('shot.notImage');
      li.classList.add('shot-failed');
      bar.remove();
      return;
    }

    // One screenshot at a time, in the order they were added.
    shotQueue = shotQueue.then(async () => {
      try {
        const r = await V.read(file);
        const form = V.toForm(r);
        bar.remove();
        status.textContent = t('shot.done');
        li.classList.add('shot-ok');
        info.append(summary(r, form));
        if (r.account.username_uncertain) info.append(el('p', { class: 'shot-warn', text: t('shot.uncertain') }));
        if (r.unclear) info.append(el('p', { class: 'muted', text: t('shot.unclear', { text: r.unclear }) }));
        if (r.badge_is_emoji) info.append(el('p', { class: 'shot-warn', text: t('shot.emojiBadge') }));

        if (form.account) {
          if (!$('account').value.trim()) $('account').value = form.account;
          showCandidates([form.account]);
        }
        if (form.badge) {
          const radio = document.querySelector(`input[name=badge][value=${form.badge}]`);
          if (radio) radio.checked = true;
        }
        if (form.text) appendText(form.text);
      } catch (e) {
        bar.remove();
        status.textContent = t('shot.err.' + (e.code || 'other'));
        li.classList.add('shot-failed');
      }
    });
  }

  function addFiles(files) {
    if (!V.enabled()) return;
    [...files].slice(0, 6).forEach(readShot);
  }

  if (!V.enabled()) {
    $('shots').disabled = true;
    $('drop').classList.add('off');
    $('drop').append(el('p', { class: 'shot-off', 'data-i18n': 'shot.off', text: t('shot.off') }));
  }

  $('shots').addEventListener('change', (e) => {
    addFiles(e.target.files);
    e.target.value = '';
  });

  const drop = $('drop');
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => {
    e.preventDefault();
    if (V.enabled()) drop.classList.add('drag');
  }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, () => drop.classList.remove('drag')));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer && e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  });

  // Paste a screenshot straight from the clipboard while on the scan page.
  document.addEventListener('paste', (e) => {
    if ($('scan').classList.contains('hidden') || !e.clipboardData) return;
    const images = [...e.clipboardData.files].filter((f) => /^image\//.test(f.type));
    if (!images.length || !V.enabled()) return;
    e.preventDefault();
    addFiles(images);
  });

  function clearShots() {
    shotUrls.splice(0).forEach((u) => URL.revokeObjectURL(u));
    $('shot-list').replaceChildren();
    $('shot-cands').replaceChildren();
    $('shot-found').classList.add('hidden');
  }

  // ------------------------------------------------------- form flow ---

  let lastInput = {};

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

    lastInput = {
      account,
      claim: $('claim').value.trim(),
      badge: (document.querySelector('input[name=badge]:checked') || {}).value,
      messages: $('messages').value.trim(),
      manual: [...document.querySelectorAll('#checks input:checked')].map((c) => c.value),
    };
    lastResult = G.analyze(lastInput);

    $('report').classList.remove('hidden');
    renderReport(lastResult);
    $('report').focus({ preventScroll: true });
    $('report').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  $('account').addEventListener('input', () => {
    if ($('account').value.trim()) {
      $('account-error').textContent = '';
      $('account').removeAttribute('aria-invalid');
    }
  });

  $('reset').addEventListener('click', () => {
    $('scan-form').reset();
    clearShots();
    lastResult = null;
    lastInput = {};
    $('report').classList.add('hidden');
    $('account').focus();
    window.scrollTo({ top: $('scan').offsetTop, behavior: 'smooth' });
  });

  applyLanguage();
  show('home');
})();
