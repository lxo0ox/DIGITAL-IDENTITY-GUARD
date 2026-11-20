/*
 * Digital Identity Guard — read text from screenshots, inside the browser.
 *
 * Uses Tesseract.js (open-source OCR). The image never leaves the device:
 * only the OCR engine and the Arabic/English language files are downloaded,
 * once, the first time a screenshot is used (about 5 MB, then cached).
 */
(function (root) {
  'use strict';

  // Pinned version. The engine and language files it fetches are pinned by it too.
  const SCRIPT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
  const MAX_PIXELS = 8e6;

  let scriptPromise = null;
  let workerPromise = null;
  let logger = null;

  function loadScript() {
    if (root.Tesseract) return Promise.resolve();
    if (!scriptPromise) {
      scriptPromise = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = SCRIPT_URL;
        s.crossOrigin = 'anonymous';
        s.onload = resolve;
        s.onerror = () => { scriptPromise = null; reject(new Error('Could not load the OCR engine')); };
        document.head.append(s);
      });
    }
    return scriptPromise;
  }

  async function getWorker() {
    await loadScript();
    if (!workerPromise) {
      workerPromise = root.Tesseract.createWorker(['ara', 'eng'], 1, {
        logger: (m) => { if (logger) logger(m); },
      }).catch((e) => { workerPromise = null; throw e; });
    }
    return workerPromise;
  }

  /**
   * Prepare the image for OCR: enlarge small screenshots, convert to grey,
   * and turn dark-mode screenshots (light text on dark) into dark-on-light.
   */
  async function toCanvas(file) {
    const bmp = await createImageBitmap(file);
    const scale = Math.max(Math.min(2, Math.sqrt(MAX_PIXELS / (bmp.width * bmp.height))), 0.25);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    const g = canvas.getContext('2d', { willReadFrequently: true });
    g.imageSmoothingQuality = 'high';
    g.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    if (bmp.close) bmp.close();

    const img = g.getImageData(0, 0, canvas.width, canvas.height);
    const d = img.data;
    let sum = 0;
    for (let i = 0; i < d.length; i += 4) {
      const y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      d[i] = d[i + 1] = d[i + 2] = y;
      sum += y;
    }
    if (sum / (d.length / 4) < 110) {
      for (let i = 0; i < d.length; i += 4) d[i] = d[i + 1] = d[i + 2] = 255 - d[i];
    }
    g.putImageData(img, 0, 0);
    return canvas;
  }

  /** Join lines that belong to the same paragraph (chat bubble), drop empty ones. */
  function tidy(text) {
    return String(text || '').replace(/\r/g, '').replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, '')
      .split(/\n\s*\n/)
      .map((p) => p.replace(/\s*\n\s*/g, ' ').replace(/[ \t]+/g, ' ').trim())
      .filter((p) => p.replace(/[^\p{L}\p{N}]/gu, '').length >= 2)
      .join('\n');
  }

  /**
   * Accounts found in the text, to offer as "the account".
   * `sure`: profile links and @usernames. `maybe`: lines that look like a
   * username (e.g. the name at the top of a chat), offered but never auto-filled.
   */
  function findAccounts(text) {
    const sure = [];
    const maybe = [];
    const add = (list, v) => { if (v && !sure.includes(v) && !maybe.includes(v)) list.push(v); };
    const linkRe = /(?:https?:\/\/)?(?:www\.)?(?:instagram\.com|x\.com|twitter\.com|tiktok\.com|facebook\.com|snapchat\.com|t\.me|threads\.net|linkedin\.com\/in)\/@?[A-Za-z0-9._-]{2,40}/gi;
    (text.match(linkRe) || []).forEach((l) => add(sure, l.replace(/[.,]+$/, '')));
    const handleRe = /(^|[^\w@])@([A-Za-z0-9_.]{2,30})/g;
    let m;
    while ((m = handleRe.exec(text))) add(sure, '@' + m[2].replace(/\.+$/, ''));
    text.split('\n').forEach((line, i) => {
      const w = line.trim();
      const single = /^[A-Za-z0-9._]{3,30}$/.test(w);
      if (single && (/[._\d]/.test(w) || i === 0)) add(maybe, '@' + w);
    });
    return { sure: sure.slice(0, 6), maybe: maybe.slice(0, 3) };
  }

  /**
   * Read one screenshot.
   * @param {File|Blob} file
   * @param {(stage: 'loading'|'reading', progress: number) => void} onProgress
   * @returns {Promise<{text: string, accounts: {sure: string[], maybe: string[]}}>}
   */
  async function read(file, onProgress) {
    const canvas = await toCanvas(file);
    logger = (m) => {
      if (!onProgress) return;
      if (m.status === 'recognizing text') onProgress('reading', m.progress || 0);
      else onProgress('loading', m.progress || 0);
    };
    try {
      onProgress && onProgress('loading', 0);
      const worker = await getWorker();
      const { data } = await worker.recognize(canvas);
      const text = tidy(data.text);
      return { text, accounts: findAccounts(tidy(data.text.replace(/\n/g, '\n\n'))) };
    } finally {
      logger = null;
    }
  }

  root.DIGOcr = { read, tidy, findAccounts };
})(typeof self !== 'undefined' ? self : this);
