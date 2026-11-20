/*
 * Digital Identity Guard — send a screenshot to the project's reader
 * (server/, a Cloudflare Worker that asks Claude to transcribe it).
 *
 * The image is shrunk first: Claude reads images up to about 1568 px on the
 * long side, so anything bigger only costs more upload time.
 */
(function (root) {
  'use strict';

  const MAX_SIDE = 1568;
  const MAX_BYTES = 4.5 * 1024 * 1024;

  function readerUrl() {
    const url = (root.DIG_CONFIG && root.DIG_CONFIG.readerUrl) || '';
    return url.replace(/\/+$/, '');
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(',')[1]);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
  }

  const toBlob = (canvas, type, quality) => new Promise((resolve) => canvas.toBlob(resolve, type, quality));

  /** Resize to at most MAX_SIDE px. PNG keeps small text sharp; JPEG if PNG is too big. */
  async function prepare(file) {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    const g = canvas.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    if (bmp.close) bmp.close();
    let blob = await toBlob(canvas, 'image/png');
    let type = 'image/png';
    if (!blob || blob.size > MAX_BYTES) {
      blob = await toBlob(canvas, 'image/jpeg', 0.92);
      type = 'image/jpeg';
    }
    return { media_type: type, data: await blobToBase64(blob) };
  }

  /**
   * @param {File|Blob} file
   * @returns {Promise<object>} the transcription (see SCHEMA in server/reader.js)
   * @throws {Error} with .code = rate_limited | busy | refused | too_long | image_too_large | bad_image | network | other
   */
  async function read(file) {
    const url = readerUrl();
    if (!url) throw Object.assign(new Error('off'), { code: 'off' });
    const image = await prepare(file);
    const body = JSON.stringify(Object.assign(image, { lang: document.documentElement.lang === 'en' ? 'en' : 'ar' }));
    let res;
    try {
      res = await fetch(url + '/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    } catch (e) {
      throw Object.assign(new Error('network'), { code: 'network' });
    }
    let payload = null;
    try { payload = await res.json(); } catch (e) { /* not JSON */ }
    if (res.ok && payload && payload.result) return payload.result;
    const err = payload && payload.error;
    const code = {
      rate_limited: 'rate_limited', busy: 'busy', refused: 'refused', too_long: 'too_long',
      image_too_large: 'image_too_large', bad_image: 'bad_image', image_rejected: 'bad_image',
    }[err] || 'other';
    throw Object.assign(new Error(err || 'HTTP ' + res.status), { code });
  }

  // Profile address for a username on a platform, so the identity check can compare platforms.
  const PROFILE_URL = {
    instagram: (u) => 'https://www.instagram.com/' + u,
    x: (u) => 'https://x.com/' + u,
    tiktok: (u) => 'https://www.tiktok.com/@' + u,
    snapchat: (u) => 'https://www.snapchat.com/add/' + u,
    facebook: (u) => 'https://www.facebook.com/' + u,
    threads: (u) => 'https://www.threads.net/@' + u,
    telegram: (u) => 'https://t.me/' + u,
    youtube: (u) => 'https://www.youtube.com/@' + u,
    linkedin: (u) => 'https://www.linkedin.com/in/' + u,
  };

  /** Turn a transcription into values for the form. */
  function toForm(r) {
    const user = String(r.account.username || '').replace(/^@+/, '').trim();
    let account = '';
    if (r.account.profile_link) account = r.account.profile_link.trim();
    else if (user && PROFILE_URL[r.platform]) account = PROFILE_URL[r.platform](user);
    else if (user) account = '@' + user;

    let badge = null;
    if (r.badge_is_emoji) badge = 'none';
    else if (['none', 'blue', 'gold', 'grey'].includes(r.badge)) badge = r.badge;

    // Only what the other account wrote: the phone owner's own replies are not evidence.
    const parts = [];
    if (r.bio) parts.push(r.bio.trim());
    r.messages.filter((m) => m.from !== 'me').forEach((m) => { if (m.text.trim()) parts.push(m.text.trim()); });
    const joined = parts.join('\n');
    r.links.forEach((l) => { if (l && !joined.includes(l)) parts.push(l); });

    return {
      account,
      badge,
      text: parts.join('\n'),
      fromThem: r.messages.filter((m) => m.from !== 'me').length,
    };
  }

  root.DIGVision = { read, toForm, enabled: () => !!readerUrl() };
})(typeof self !== 'undefined' ? self : this);
