/*
 * Digital Identity Guard — analysis engine.
 *
 * Runs entirely in the browser (or in Node for tests). Nothing is sent to
 * any server. It combines:
 *   1. automatic checks on the username / link the user typed, and
 *   2. the warning signs the user observed and ticked,
 * then adds extra points when certain signs appear together, because a
 * combination of signs says more than any single one.
 *
 * The score is an awareness indicator built on assumed weights. It is not a
 * real probability of fraud and not a judgment about the account owner.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DIGAnalyzer = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------------------------------------------------------------- data ---

  const PLATFORMS = [
    { id: 'x', name: 'X (Twitter)', domains: ['x.com', 'twitter.com'] },
    { id: 'instagram', name: 'Instagram', domains: ['instagram.com'] },
    { id: 'facebook', name: 'Facebook', domains: ['facebook.com', 'fb.com'] },
    { id: 'tiktok', name: 'TikTok', domains: ['tiktok.com'] },
    { id: 'snapchat', name: 'Snapchat', domains: ['snapchat.com'] },
    { id: 'linkedin', name: 'LinkedIn', domains: ['linkedin.com'] },
    { id: 'youtube', name: 'YouTube', domains: ['youtube.com', 'youtu.be'] },
    { id: 'telegram', name: 'Telegram', domains: ['t.me', 'telegram.me', 'telegram.org'] },
    { id: 'threads', name: 'Threads', domains: ['threads.net', 'threads.com'] },
    { id: 'whatsapp', name: 'WhatsApp', domains: ['wa.me', 'whatsapp.com'] },
  ];

  // Brand words that scammers imitate in fake domains (min. 4 letters).
  const BRANDS = ['twitter', 'instagram', 'facebook', 'tiktok', 'snapchat',
    'linkedin', 'youtube', 'telegram', 'threads', 'whatsapp'];

  const SHORTENERS = ['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'is.gd',
    'buff.ly', 'cutt.ly', 'rb.gy', 'shorturl.at', 'tiny.cc', 'rebrand.ly', 's.id'];

  // Endings that make "something.xyz" look like a link rather than a handle.
  const LINK_TLDS = ['com', 'net', 'org', 'me', 'ly', 'co', 'io', 'gl', 'at', 'cc',
    'app', 'link', 'info', 'xyz', 'sa', 'site', 'online', 'top', 'ru', 'cn', 'be',
    'gd', 'id', 'tk', 'ml', 'ga', 'cf', 'live', 'shop', 'click'];

  // Path prefixes that come before the username on some platforms.
  const PATH_PREFIXES = ['in', 'company', 'channel', 'c', 'user', 'add', 'u', 'people'];

  // Words impersonators add to look official. Long words match anywhere,
  // short ones only as a separate part of the name (to avoid "realmadrid").
  const KEYWORDS_ANYWHERE = ['official', 'support', 'verify', 'verified',
    'verification', 'security', 'recovery', 'helpdesk', 'giveaway', 'customer',
    'service', 'moderator'];
  const KEYWORDS_TOKEN = ['real', 'team', 'help', 'admin', 'care', 'backup', 'login', 'staff'];

  // Characters that look like Latin letters but are not.
  const HOMOGLYPHS = {
    'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'у': 'y', 'х': 'x', 'і': 'i',
    'ј': 'j', 'ѕ': 's', 'ԁ': 'd', 'һ': 'h', 'к': 'k', 'м': 'm', 'т': 't', 'в': 'b',
    'н': 'h', 'ο': 'o', 'α': 'a', 'ε': 'e', 'ρ': 'p', 'ν': 'v', 'τ': 't', 'ι': 'i',
    'κ': 'k', 'υ': 'u', 'χ': 'x', 'ɡ': 'g', 'ℓ': 'l',
  };
  const LEET = { '0': 'o', '1': 'l', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b',
    '@': 'a', '$': 's', '!': 'i', '|': 'l' };

  const HOMOGLYPH_RE = /[Ͱ-ϿЀ-ӿԀ-ԯɡℓ]/;
  const INVISIBLE_RE = /[­​-‏‪-‮⁠-⁤﻿]/g;

  // ------------------------------------------------------------- weights ---

  // Signs the user observes and ticks (same weights as the prototype).
  const MANUAL = {
    new_account: 20,
    unusual_activity: 25,
    suspicious_username: 20,
    suspicious_photo: 20,
    sensitive_request: 15,
  };

  // Automatic findings.
  const AUTO = {
    lookalike_name: 30,   // same as the expected name once look-alike characters are mapped
    similar_name: 25,     // one or two characters away from the expected name
    contains_name: 20,    // expected name plus extra words (e.g. "_support")
    name_mismatch: 15,    // nothing like the account the user expected
    homoglyph: 25,        // Cyrillic/Greek letters that look Latin
    invisible_chars: 25,  // hidden zero-width characters
    keyword: 15,          // "official", "support", "verify"...
    many_digits: 10,
    odd_separators: 5,
    random_string: 10,
    lookalike_domain: 30, // e.g. instagrarn.com, instagram-login.net
    punycode_domain: 25,  // xn-- domains (often look-alike letters)
    ip_host: 25,
    shortener: 15,
    unknown_domain: 10,
    insecure_link: 5,
  };

  // Each finding belongs to a group. A group is capped so the same underlying
  // sign (e.g. "the name looks fake") is not counted twice.
  const GROUP_OF = {
    suspicious_username: 'identity', lookalike_name: 'identity', similar_name: 'identity',
    contains_name: 'identity', name_mismatch: 'identity', homoglyph: 'identity',
    invisible_chars: 'identity', keyword: 'identity', many_digits: 'identity',
    odd_separators: 'identity', random_string: 'identity',
    lookalike_domain: 'link', punycode_domain: 'link', ip_host: 'link',
    shortener: 'link', unknown_domain: 'link', insecure_link: 'link',
    new_account: 'behavior', unusual_activity: 'behavior',
    suspicious_photo: 'profile',
    sensitive_request: 'contact',
  };
  const GROUP_CAPS = { identity: 40, link: 35, behavior: 45, profile: 20, contact: 15 };

  // Extra points when signs appear together.
  const PATTERNS = [
    {
      id: 'impersonation_scam', points: 15,
      when: (h) => h.sensitive_request && (h.suspicious_username || h.lookalike_name ||
        h.similar_name || h.contains_name || h.homoglyph || h.invisible_chars || h.keyword),
    },
    {
      id: 'phishing_link', points: 15,
      when: (h) => h.sensitive_request && (h.lookalike_domain || h.punycode_domain ||
        h.ip_host || h.shortener),
    },
    { id: 'fake_profile', points: 10, when: (h) => h.new_account && h.suspicious_photo },
    { id: 'bot_like', points: 10, when: (h) => h.new_account && h.unusual_activity },
  ];

  const LEVELS = { medium: 30, high: 60 };

  // ------------------------------------------------------------- helpers ---

  function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      }
      prev = cur;
    }
    return prev[b.length];
  }

  function cleanName(s) {
    return String(s || '').normalize('NFKC').replace(INVISIBLE_RE, '')
      .trim().replace(/^@+/, '').toLowerCase();
  }

  // Reduce a name to its "visual skeleton" so look-alikes compare equal:
  // "Yazan_0mar", "yazan.omar" and "уazanomar" (Cyrillic у) -> "yazanomar".
  function skeleton(s) {
    let out = '';
    for (const ch of cleanName(s)) out += HOMOGLYPHS[ch] || LEET[ch] || ch;
    return out.replace(/[._\-\s]/g, '')
      .replace(/rn/g, 'm').replace(/vv/g, 'w').replace(/i/g, 'l');
  }

  function looksLikeLink(s) {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) return true;
    if (/^www\./i.test(s)) return true;
    const host = s.split(/[/?#]/)[0];
    if (!/^[^\s@]+\.[a-z]{2,}$/i.test(host)) return false;
    if (s.includes('/')) return true;
    const tld = host.split('.').pop().toLowerCase();
    return LINK_TLDS.includes(tld);
  }

  function stripHostPrefix(host) {
    return host.replace(/^(www|m|mobile|web)\./, '');
  }

  function platformFor(host) {
    return PLATFORMS.find((p) => p.domains.some((d) => host === d || host.endsWith('.' + d))) || null;
  }

  /** Work out whether the input is a link or a handle, and pull out the parts. */
  function parseAccount(input) {
    const raw = String(input || '').trim();
    const result = { raw, kind: 'handle', url: null, host: null, platform: null,
      username: '', scheme: null };
    if (!raw) return result;

    if (raw.startsWith('@') || !looksLikeLink(raw)) {
      result.username = raw.replace(/^@+/, '').replace(/\s+/g, '');
      return result;
    }

    result.kind = 'link';
    const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw);
    let url;
    try {
      url = new URL(hasScheme ? raw : 'https://' + raw);
    } catch (e) {
      result.kind = 'invalid';
      return result;
    }
    result.url = url;
    result.scheme = hasScheme ? url.protocol.replace(':', '') : null;
    result.host = stripHostPrefix(url.hostname.toLowerCase());
    const platform = platformFor(result.host);
    result.platform = platform ? platform.name : null;

    if (platform) {
      const segs = url.pathname.split('/').filter(Boolean).map((s) => {
        try { return decodeURIComponent(s); } catch (e) { return s; }
      });
      while (segs.length > 1 && PATH_PREFIXES.includes(segs[0].toLowerCase())) segs.shift();
      if (segs.length) result.username = segs[0].replace(/^@+/, '');
    }
    return result;
  }

  // ---------------------------------------------------------- the checks ---

  function checkUsername(name) {
    const found = [];
    const clean = cleanName(name);
    const original = String(name).normalize('NFKC');

    if (HOMOGLYPH_RE.test(original)) found.push({ id: 'homoglyph' });
    if (new RegExp(INVISIBLE_RE.source).test(String(name))) found.push({ id: 'invisible_chars' });

    const tokens = clean.split(/[._\-\d]+/).filter(Boolean);
    const kw = KEYWORDS_ANYWHERE.find((k) => clean.includes(k)) ||
      KEYWORDS_TOKEN.find((k) => tokens.includes(k));
    const brand = BRANDS.find((b) => clean.includes(b));
    if (kw || brand) found.push({ id: 'keyword', params: { kw: kw || brand } });

    const digits = (clean.match(/\d/g) || []).length;
    if (/\d{4,}$/.test(clean) || digits >= 5) found.push({ id: 'many_digits' });

    const seps = (clean.match(/[._\-]/g) || []).length;
    if (/[._\-]{2,}/.test(clean) || seps >= 3) found.push({ id: 'odd_separators' });

    const letters = clean.replace(/[^a-z]/g, '');
    const vowels = (letters.match(/[aeiouy]/g) || []).length;
    if (/[bcdfghjklmnpqrstvwxz]{5,}/.test(letters) ||
        (letters.length >= 8 && vowels / letters.length < 0.2)) {
      found.push({ id: 'random_string' });
    }
    return found;
  }

  function compareWithExpected(name, expected) {
    const a = cleanName(name);
    const b = cleanName(expected);
    if (!a || !b) return null;
    if (a === b) return { id: 'expected_match' };
    const sa = skeleton(a);
    const sb = skeleton(b);
    if (sa === sb) return { id: 'lookalike_name', params: { expected: b } };
    const minLen = Math.min(sa.length, sb.length);
    const d = levenshtein(sa, sb);
    if (minLen >= 4 && d <= (minLen >= 8 ? 2 : 1)) return { id: 'similar_name', params: { expected: b } };
    if (sb.length >= 4 && sa.includes(sb)) return { id: 'contains_name', params: { expected: b } };
    return { id: 'name_mismatch', params: { expected: b } };
  }

  function checkLink(parsed) {
    const found = [];
    if (parsed.kind !== 'link') return found;
    if (parsed.scheme === 'http') found.push({ id: 'insecure_link' });
    if (parsed.platform) return found;

    const host = parsed.host;
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith('[')) {
      found.push({ id: 'ip_host' });
      return found;
    }
    if (SHORTENERS.includes(host)) {
      found.push({ id: 'shortener' });
      return found;
    }
    if (host.split('.').some((l) => l.startsWith('xn--'))) found.push({ id: 'punycode_domain' });

    let imitated = null;
    for (const token of host.split(/[.\-]/)) {
      if (token.length < 4) continue;
      const sk = skeleton(token);
      imitated = BRANDS.find((b) => {
        const bs = skeleton(b);
        return sk.includes(bs) || levenshtein(sk, bs) <= (b.length >= 7 ? 2 : 1);
      });
      if (imitated) break;
    }
    if (imitated) {
      const p = PLATFORMS.find((x) => x.domains.some((d) => d.startsWith(imitated)));
      found.push({ id: 'lookalike_domain', params: { platform: p ? p.name : imitated } });
    } else if (!found.length) {
      found.push({ id: 'unknown_domain', params: { host } });
    }
    return found;
  }

  // ----------------------------------------------------------- analysis ---

  /**
   * @param {{account: string, expected?: string, manual?: string[]}} input
   */
  function analyze(input) {
    const parsed = parseAccount(input.account);
    const expectedParsed = input.expected ? parseAccount(input.expected) : null;
    const expectedName = expectedParsed ? (expectedParsed.username || '') : '';

    const findings = [];
    const checks = [];
    const notes = [];

    if (parsed.username) {
      const nameFound = checkUsername(parsed.username);
      findings.push(...nameFound);
      const ids = nameFound.map((f) => f.id);
      ['homoglyph', 'invisible_chars', 'keyword', 'many_digits', 'odd_separators', 'random_string']
        .forEach((id) => checks.push({ id, flagged: ids.includes(id) }));

      if (expectedName) {
        const cmp = compareWithExpected(parsed.username, expectedName);
        if (cmp && cmp.id === 'expected_match') {
          notes.push({ id: 'expected_match' });
          checks.push({ id: 'expected', flagged: false });
        } else if (cmp) {
          findings.push(cmp);
          checks.push({ id: 'expected', flagged: true });
        }
      }
    }

    if (parsed.kind === 'link') {
      const linkFound = checkLink(parsed);
      findings.push(...linkFound);
      checks.push({ id: 'domain', flagged: linkFound.some((f) => f.id !== 'insecure_link') });
      if (parsed.scheme) checks.push({ id: 'https', flagged: linkFound.some((f) => f.id === 'insecure_link') });
    }

    const factors = [];
    findings.forEach((f) => {
      factors.push({ id: f.id, source: 'auto', group: GROUP_OF[f.id], points: AUTO[f.id], params: f.params || {} });
    });
    (input.manual || []).forEach((id) => {
      if (MANUAL[id] == null) return;
      factors.push({ id, source: 'manual', group: GROUP_OF[id], points: MANUAL[id], params: {} });
    });

    // Sum per group, then apply the caps.
    const groupRaw = {};
    factors.forEach((f) => { groupRaw[f.group] = (groupRaw[f.group] || 0) + f.points; });
    const caps = [];
    let score = 0;
    Object.keys(groupRaw).forEach((g) => {
      const capped = Math.min(groupRaw[g], GROUP_CAPS[g]);
      if (capped < groupRaw[g]) caps.push({ group: g, cap: GROUP_CAPS[g], raw: groupRaw[g] });
      score += capped;
    });

    // Combinations.
    const has = {};
    factors.forEach((f) => { has[f.id] = true; });
    PATTERNS.forEach((p) => {
      if (p.when(has)) {
        factors.push({ id: p.id, source: 'pattern', group: 'pattern', points: p.points, params: {} });
        score += p.points;
      }
    });

    score = Math.min(100, score);
    const level = score >= LEVELS.high ? 'high' : score >= LEVELS.medium ? 'medium' : 'low';

    return { parsed, expectedName, factors, caps, checks, notes, score, level };
  }

  return {
    analyze, parseAccount, checkUsername, checkLink, compareWithExpected,
    skeleton, levenshtein,
    MANUAL, AUTO, GROUP_CAPS, PATTERNS, LEVELS,
  };
});
