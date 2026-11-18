/*
 * Digital Identity Guard — combines every check into one evidence-based result.
 *
 *   1. Identity:  is this the official account of who it claims to be?
 *   2. Badge:     what the verification badge the user sees actually means.
 *   3. Messages:  is it asking for codes, passwords, card details or money?
 *   4. Signals:   name/link checks and the signs the user ticked (context only).
 *
 * Result levels, most serious first:
 *   scam          scam behaviour detected (asks for a code/password/card, or a phishing link)
 *   not_official  it is NOT the official account it claims to be
 *   warning       several warning signs
 *   official      matches the official account, and nothing else is wrong
 *   clear         no warning signs found (which is not proof of safety)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./analyzer.js'), require('./messages.js'), require('./official-accounts.js'));
  } else {
    root.DIGGuard = factory(root.DIGAnalyzer, root.DIGMessages, root.DIGDirectory);
  }
})(typeof self !== 'undefined' ? self : this, function (A, M, defaultDirectory) {
  'use strict';

  const DANGEROUS_LINK = ['lookalike_domain', 'punycode_domain', 'ip_host'];

  /** Accounts that can be trusted: those with a source on the organisation's website. */
  function sourcedAccounts(org) {
    return (org.accounts || []).filter((a) => a && a.handle && a.platform && a.source);
  }

  function findOrg(text, directory) {
    const n = M.normalize(text).trim();
    if (n.length < 2) return null;
    let best = null;
    directory.orgs.forEach((org) => {
      const names = [org.name.ar, org.name.en, ...(org.aliases || [])].map((x) => M.normalize(x).trim());
      names.forEach((name) => {
        if (!name) return;
        const exact = name === n;
        // Whole words only, so "zainab_99" does not match "zain".
        const partial = (n.length >= 3 && (' ' + name + ' ').includes(' ' + n + ' ')) ||
          (name.length >= 3 && (' ' + n + ' ').includes(' ' + name + ' '));
        if (exact || partial) {
          const rank = exact ? 2 : 1;
          if (!best || rank > best.rank) best = { org, rank };
        }
      });
    });
    return best ? best.org : null;
  }

  /** What did the user type in "who does it claim to be?" */
  function parseClaim(claim, directory) {
    const raw = String(claim || '').trim();
    if (!raw) return { kind: 'none' };
    const asAccount = A.parseAccount(raw);
    // An @username, a profile link, or something that can only be a username
    // (Latin letters with "_", "." or digits) counts as "the real account".
    const clearlyHandle = /^[a-z0-9._]+$/i.test(raw) && /[._\d]/.test(raw);
    if ((raw.startsWith('@') || asAccount.kind === 'link' || clearlyHandle) && asAccount.username) {
      return { kind: 'account', account: asAccount };
    }
    const org = findOrg(raw, directory);
    if (org) return { kind: 'org', org };
    return { kind: 'unknown_org', text: raw };
  }

  function sameHandle(a, b) {
    return A.cleanName(a) === A.cleanName(b);
  }

  /** Look for the account among all official accounts (exact or look-alike). */
  function scanDirectory(parsed, directory) {
    const exact = [];
    const imitations = [];
    directory.orgs.forEach((org) => {
      sourcedAccounts(org).forEach((acc) => {
        if (sameHandle(parsed.username, acc.handle)) {
          exact.push({ org, acc });
          return;
        }
        const cmp = A.compareWithExpected(parsed.username, acc.handle);
        if (cmp && ['lookalike_name', 'similar_name', 'contains_name'].includes(cmp.id)) {
          imitations.push({ org, acc, how: cmp.id });
        }
      });
    });
    return { exact, imitations };
  }

  function checkIdentity(parsed, claimText, directory) {
    const claim = parseClaim(claimText, directory);
    const out = { claim, status: 'none', reason: null, org: null, official: [], match: null };
    if (!parsed.username) {
      out.status = claim.kind === 'none' ? 'none' : 'unconfirmed';
      out.reason = 'no_username';
      return out;
    }
    const dir = scanDirectory(parsed, directory);

    // --- The user named an organisation.
    if (claim.kind === 'org') {
      const org = claim.org;
      out.org = org;
      out.official = sourcedAccounts(org);
      const onPlatform = out.official.filter((a) => a.platform === parsed.platformId);
      const hit = out.official.find((a) => sameHandle(a.handle, parsed.username));
      if (hit && parsed.platformId && hit.platform === parsed.platformId) {
        return Object.assign(out, { status: 'official', reason: 'directory', match: hit });
      }
      if (hit && !parsed.platformId) {
        return Object.assign(out, { status: 'unconfirmed', reason: 'no_platform', match: hit });
      }
      if (onPlatform.length) {
        const imit = dir.imitations.find((i) => i.org === org);
        return Object.assign(out, { status: 'not_official', reason: imit ? 'imitation' : 'different', match: imit ? imit.acc : null });
      }
      if (!parsed.platformId && out.official.length) {
        const imit = dir.imitations.find((i) => i.org === org);
        if (imit) return Object.assign(out, { status: 'not_official', reason: 'imitation', match: imit.acc });
        return Object.assign(out, { status: 'unconfirmed', reason: 'no_platform' });
      }
      return Object.assign(out, { status: 'unconfirmed', reason: out.official.length ? 'not_on_platform' : 'not_listed' });
    }

    // --- The user gave the real account (e.g. the link from the official website).
    if (claim.kind === 'account') {
      const real = claim.account;
      out.match = { handle: real.username, platform: real.platformId };
      const cmp = A.compareWithExpected(parsed.username, real.username);
      const bothPlatforms = parsed.platformId && real.platformId;
      if (cmp && cmp.id === 'expected_match') {
        if (bothPlatforms && parsed.platformId === real.platformId) return Object.assign(out, { status: 'official', reason: 'claim' });
        if (bothPlatforms) return Object.assign(out, { status: 'unconfirmed', reason: 'platform_differs' });
        return Object.assign(out, { status: 'unconfirmed', reason: 'same_name_no_platform' });
      }
      if (cmp && ['lookalike_name', 'similar_name', 'contains_name'].includes(cmp.id)) {
        return Object.assign(out, { status: 'not_official', reason: 'imitation_of_claim', how: cmp.id });
      }
      return Object.assign(out, { status: 'not_official', reason: 'different_from_claim' });
    }

    // --- No organisation from our list was named: still look for official accounts.
    const exactSame = dir.exact.find((e) => parsed.platformId && e.acc.platform === parsed.platformId);
    if (exactSame) return Object.assign(out, { status: 'official', reason: 'directory', org: exactSame.org, match: exactSame.acc });
    if (dir.imitations.length) {
      const imit = dir.imitations[0];
      return Object.assign(out, { status: 'not_official', reason: 'imitation', org: imit.org, match: imit.acc,
        official: sourcedAccounts(imit.org) });
    }
    if (claim.kind === 'unknown_org') return Object.assign(out, { status: 'unconfirmed', reason: 'unknown_org' });
    return out;
  }

  /** Explain the badge the user sees, for the platform the account is on. */
  function checkBadge(platformId, badge, claimsOrg) {
    if (!badge || badge === 'unsure') return null;
    const meta = ['instagram', 'facebook', 'threads'];
    let id;
    let warn = false;
    if (badge === 'none') {
      id = 'badge_none';
      warn = !!claimsOrg;
    } else if (platformId === 'x') {
      id = 'badge_x_' + badge;            // blue = paid, gold = organisation, grey = government
      warn = badge === 'blue' && !!claimsOrg;
    } else if (meta.includes(platformId)) {
      id = badge === 'blue' ? 'badge_meta_blue' : 'badge_unexpected';
      warn = badge !== 'blue';
    } else if (platformId === 'tiktok') {
      id = badge === 'blue' ? 'badge_tiktok_blue' : 'badge_unexpected';
      warn = badge !== 'blue';
    } else {
      id = 'badge_generic';
    }
    return { id, warn };
  }

  /**
   * @param {{account: string, claim?: string, badge?: string, messages?: string, manual?: string[]}} input
   * @param {object} [directory] defaults to the built-in official accounts directory
   */
  function analyze(input, directory) {
    directory = directory || defaultDirectory || { orgs: [] };
    const signals = A.analyzeSignals({ account: input.account, manual: input.manual || [] });
    const parsed = signals.parsed;
    const identity = checkIdentity(parsed, input.claim, directory);
    const claimsOrg = identity.claim.kind === 'org' || identity.claim.kind === 'unknown_org' ||
      (identity.status === 'not_official' && identity.reason === 'imitation');
    const badge = checkBadge(parsed.platformId, input.badge, claimsOrg);
    const messages = M.analyzeMessages(input.messages || '');

    const accountLinkDanger = signals.factors.some((f) => DANGEROUS_LINK.includes(f.id));
    const msgSigns = messages.strongCount + messages.weakCount;

    let level;
    if (messages.decisive || accountLinkDanger) level = 'scam';
    else if (identity.status === 'not_official') level = 'not_official';
    else if (
      messages.strongCount >= 2 ||
      (messages.strongCount >= 1 && msgSigns >= 2) ||
      messages.weakCount >= 3 ||
      signals.score >= 40 ||
      (badge && badge.warn && (signals.score >= 20 || msgSigns >= 1))
    ) level = 'warning';
    else if (identity.status === 'official') level = 'official';
    else level = 'clear';

    // A few things that are worth saying alongside the level.
    const notes = [];
    if (level === 'scam' && identity.status === 'official') notes.push('official_but_scam');
    if (level === 'clear' && identity.status === 'unconfirmed') notes.push('clear_but_unconfirmed');
    if (level === 'clear' && !input.messages) notes.push('no_messages');
    if (level === 'clear' && signals.score > 0) notes.push('some_signals');

    return { level, identity, badge, messages, signals, parsed, notes };
  }

  return { analyze, checkIdentity, checkBadge, parseClaim, findOrg, sourcedAccounts };
});
