/*
 * Digital Identity Guard — message scam analyser (Arabic + English).
 *
 * Reads the messages an account sent and looks for what scammers ask for and
 * how they pressure people. A sentence only counts as a *request* for a code,
 * password or card details when it also contains a request verb ("send",
 * "ارسل"...), and sentences that warn the user ("do not share the code") are
 * ignored, so a genuine bank SMS is not flagged as a scam.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./analyzer.js'));
  else root.DIGMessages = factory(root.DIGAnalyzer);
})(typeof self !== 'undefined' ? self : this, function (A) {
  'use strict';

  /** Normalise Arabic spelling variants, digits and diacritics so patterns match. */
  function normalize(s) {
    return String(s || '').normalize('NFKC')
      .replace(/[\u064B-\u0652\u0670\u0640]/g, '')        // diacritics, tatweel
      .replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
      .replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
      .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660))
      .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6F0))
      .toLowerCase();
  }

  const rx = (list) => new RegExp(list.map(normalize).join('|'), 'i');

  // A sentence asking the user to do or give something.
  const REQUEST = rx([
    'ارسل', 'ابعث', 'عطني', 'عطيني', 'اعطني', 'اعطيني', 'زودني', 'زودنا', 'شاركني', 'شاركنا',
    'اكتب', 'حط ', 'ادخل', 'وش ', 'ايش ', 'قول لي', 'قولي', 'صور لي', 'صورلي', 'نحتاج', 'احتاج',
    'محتاجين', 'نبي ', 'ابي ', 'يرجي', 'الرجاء', 'قم ب', 'حدث ', 'تحديث', 'اكد ', 'تاكيد',
    '\\b(send|give|share|forward|tell|provide|confirm|verify|enter|type|reply|update|need|what is|what\'s)\\b',
  ]);

  // A sentence that warns the user instead of asking (typical of genuine SMS).
  const WARNING_TEXT = rx([
    'لا تشارك', 'لا تعطي', 'لا ترسل', 'لا تفصح', 'لا تعط', 'لن نطلب', 'لا نطلب', 'يحذر', 'احذر',
    '\\b(do not|don\'t|never) (share|give|send|disclose)\\b', '\\bwe will never ask\\b',
  ]);

  // Categories. `needsRequest`: only counts when the sentence also asks for it.
  // `severity`: 'decisive' means scam behaviour on its own; 'strong' and 'weak'
  // are warning signs that matter more when combined.
  const CATEGORIES = [
    { id: 'otp', severity: 'decisive', needsRequest: true, re: rx([
      'رمز (ال)?(تحقق|تفعيل|دخول|التاكيد|سري لمره)', 'كود (ال)?(تحقق|تفعيل|التاكيد)?',
      '(الرمز|الكود|الرقم) (اللي|الي|الذي) (وصلك|جاك|وصل|ارسل)', 'الرمز', 'رساله (ال)?تحقق',
      '\\b(otp|one[- ]time (pass)?code|verification code|security code|activation code|login code|\\d[- ]digit code)\\b',
      // "a code", "the code"... but not promo/discount/QR codes
      '(?<!(promo|discount|coupon|qr|zip|postal|referral|invite) )\\bcodes?\\b',
    ]) },
    { id: 'password', severity: 'decisive', needsRequest: true, re: rx([
      'كلمه (ال)?(مرور|سر)', 'باسورد', 'باسوورد', '(ال)?رقم (ال)?سري', 'رقمك السري', '(ال)?رمز (ال)?سري',
      '\\bpass(word|code)\\b', '\\bpin( code| number)?\\b',
    ]) },
    { id: 'card', severity: 'decisive', needsRequest: true, re: rx([
      'رقم (ال)?بطاق', 'بيانات (ال)?بطاق', 'معلومات (ال)?بطاق', 'تاريخ (ال)?انتهاء', '(ال)?ثلاث ارقام', 'cvv', 'cvc',
      '\\bcard (number|details|info(rmation)?)\\b', '\\bexpir(y|ation) date\\b', '\\b(online )?banking (login|password|details)\\b',
    ]) },
    { id: 'money', severity: 'strong', needsRequest: false, re: rx([
      'حول(ي)? (لي|مبلغ|المبلغ)', 'تحويل (مبلغ|المبلغ|رسوم)', 'حواله', 'ادفع', 'دفع (ال)?رسوم', 'سداد (ال)?(رسوم|مبلغ)',
      'رسوم (ال)?(شحن|توصيل|جمارك|الجمارك|تسجيل|تفعيل|استلام)', 'بطاق(ه|ات) (شحن|سوا|ايتونز|هدايا|قوقل)',
      'ايتونز', 'بيتكوين', 'بتكوين', 'عملات رقميه', 'كريبتو', 'usdt', 'سلفني', 'سلفه', 'ايبان',
      '\\b(transfer|wire|send) (me )?(the )?(money|funds|payment|amount|\\$|sar|riyals?)\\b',
      '\\b(pay|payment of) (a |the )?(small )?(fee|fees|charge)\\b', '\\b(delivery|customs|processing|release|registration|activation) fee\\b',
      '\\bgift ?cards?\\b', '\\bitunes\\b', '\\b(bitcoin|btc|usdt|crypto(currency)?)\\b', '\\biban\\b', '\\blend me\\b',
    ]) },
    { id: 'personal_id', severity: 'strong', needsRequest: true, re: rx([
      'رقم (ال)?هويه', 'الهويه الوطنيه', 'صوره (ال)?هويه', '(رقم )?(ال)?اقامه', 'تاريخ (ال)?ميلاد', 'رقم (ال)?جواز',
      'السجل المدني', 'بيانات(ك)? الشخصيه', 'رقم (ال)?حساب(ك)?', 'سيلفي',
      '\\b(national id|id number|iqama|passport (number|copy)|date of birth|personal (details|information)|photo of your id|selfie)\\b',
    ]) },
    { id: 'threat', severity: 'strong', needsRequest: false, re: rx([
      'سيتم (ايقاف|تعليق|اغلاق|حظر|الغاء|تجميد)', '(ايقاف|تعليق|اغلاق|حظر|تجميد) (حسابك|بطاقتك|خدماتك|الحساب|البطاقه)',
      'حسابك (موقوف|معلق|مهدد|مقفل)', 'غرامه', 'مخالفه', 'قضيه', 'بلاغ ضدك',
      '\\byour (account|card|profile) (will be|has been|is) (suspended|locked|blocked|closed|deactivated|frozen|disabled)\\b',
      '\\b(legal action|arrest|penalty|violation|copyright (strike|infringement))\\b',
    ]) },
    { id: 'urgency', severity: 'weak', needsRequest: false, re: rx([
      'فورا', 'حالا', 'بسرعه', 'عاجل', 'ضروري', 'خلال \\d+ (ساعه|ساعات|دقيقه|دقائق)', 'اخر فرصه', 'قبل فوات', 'اليوم فقط', 'لا تتاخر',
      '\\b(urgent(ly)?|immediately|right now|asap|within \\d+ (hours?|minutes?)|last chance|final notice|today only|act now)\\b',
    ]) },
    { id: 'prize', severity: 'weak', needsRequest: false, re: rx([
      'ربحت', 'فزت', 'جائزه', 'الفائز', 'سحب (على|ال)', 'هديه مجانيه', 'مجانا', 'استلام (ال)?جائزه',
      '\\b(congratulations|you( have|\'ve)? won|winner|prize|giveaway|free gift|claim (your )?(reward|prize))\\b',
    ]) },
    { id: 'investment', severity: 'strong', needsRequest: false, re: rx([
      'ارباح (مضمونه|يوميه)', 'ربح (يومي|مضمون)', 'دخل (يومي|اضافي)', 'استثمار', 'استثمر', 'تداول', 'محفظه استثماريه',
      'عمل من (ال)?(بيت|منزل)', 'وظيفه (عن بعد|من المنزل)', 'راتب يومي', 'تسويق بالعموله', 'مهام (بسيطه|يوميه)', 'لايكات مقابل',
      '\\b(guaranteed (profits?|returns?)|daily (profit|income|returns?)|invest(ment|ing)?|trading|forex|work from home|easy money|part[- ]time job|earn \\$?\\d+)\\b',
    ]) },
    { id: 'new_number', severity: 'strong', needsRequest: false, re: rx([
      'رقمي الجديد', 'هذا رقمي', 'غيرت رقمي', 'جوالي (خرب|تعطل|ضاع|انسرق)', 'حسابي الجديد', 'حسابي (القديم )?(انسرق|انهكر|تهكر)',
      '\\b(my new (number|phone|account)|lost my phone|(old|other) account (was )?hacked)\\b',
    ]) },
    { id: 'move_platform', severity: 'weak', needsRequest: false, re: rx([
      'واتساب', 'واتس', 'تيليجرام', 'تلقرام', 'تليجرام', 'كلمني (على|خاص)', 'تواصل (معي|معنا) (على|عبر|خاص)', 'رابط (ال)?قروب',
      '\\b(whatsapp|telegram|text me (on|at)|dm me|contact me (on|at|via))\\b',
    ]) },
    { id: 'authority', severity: 'weak', needsRequest: false, re: rx([
      'البنك', 'مصرف', 'ابشر', 'وزاره', 'الجوازات', 'البريد', 'سبل', 'شحنتك', 'طردك', 'الشحنه', 'الجمارك', 'ساما',
      'البنك المركزي', 'الشرطه', 'النيابه', 'خدمه العملاء', 'الدعم الفني', 'فريق الدعم', 'فريق (ال)?حمايه',
      '\\b(bank|absher|ministry|customs|police|your (parcel|package|shipment)|delivery attempt|customer (service|support|care)|support team|security team|meta support|instagram (support|team))\\b',
    ]) },
    { id: 'secrecy', severity: 'weak', needsRequest: false, re: rx([
      'لا تخبر', 'لا تقول لاحد', 'لا تعلم احد', 'بيني وبينك', 'لا احد يدري',
      '\\b(don\'t tell anyone|keep (this|it) (secret|between us))\\b',
    ]) },
  ];

  const URL_RE = /\b((?:https?:\/\/|www\.)[^\s<>"'،]+|[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*\.(?:com|net|org|sa|me|ly|co|io|gl|at|cc|app|link|info|xyz|site|online|top|ru|cn|be|gd|id|tk|ml|ga|cf|live|shop|click)(?:\/[^\s<>"'،]*)?)/gi;

  function splitSentences(text) {
    return String(text || '').split(/(?<=[.!?؟\n])\s*|\n+/).map((s) => s.trim()).filter(Boolean);
  }

  function shorten(s, max) {
    return s.length > max ? s.slice(0, max - 1) + '…' : s;
  }

  /**
   * @param {string} text the messages the account sent
   * @returns {{findings: Array, links: Array, decisive: boolean, strongCount: number, weakCount: number}}
   */
  function analyzeMessages(text) {
    const findings = [];
    const seen = new Set();
    const sentences = splitSentences(text);

    sentences.forEach((sentence) => {
      const norm = normalize(sentence);
      const warns = WARNING_TEXT.test(norm);
      const asks = REQUEST.test(norm);
      CATEGORIES.forEach((c) => {
        if (seen.has(c.id)) return;
        if (!c.re.test(norm)) return;
        if (c.needsRequest && (!asks || warns)) {
          // A mention without a request (e.g. a genuine OTP SMS) is only a weak sign.
          if (c.id === 'otp' && !warns && !seen.has('otp_mention')) {
            seen.add('otp_mention');
            findings.push({ id: 'otp_mention', severity: 'weak', quote: shorten(sentence, 160) });
          }
          return;
        }
        seen.add(c.id);
        findings.push({ id: c.id, severity: c.severity, quote: shorten(sentence, 160) });
      });
    });
    if (seen.has('otp')) {
      const i = findings.findIndex((f) => f.id === 'otp_mention');
      if (i >= 0) findings.splice(i, 1);
    }

    // Links inside the messages.
    const links = [];
    const raw = String(text || '').match(URL_RE) || [];
    [...new Set(raw)].slice(0, 10).forEach((u) => {
      const parsed = A.parseAccount(u.replace(/[).,!?؟]+$/, ''));
      if (parsed.kind !== 'link') return;
      const found = A.checkLink(parsed);
      links.push({ url: u, host: parsed.host, platform: parsed.platform, findings: found });
    });
    const dangerous = ['lookalike_domain', 'punycode_domain', 'ip_host'];
    links.forEach((l) => {
      l.findings.forEach((f) => {
        const id = dangerous.includes(f.id) ? 'dangerous_link' : f.id === 'insecure_link' ? null : 'risky_link';
        if (!id || seen.has(id + l.host)) return;
        seen.add(id + l.host);
        findings.push({ id, severity: id === 'dangerous_link' ? 'decisive' : 'strong', quote: l.url,
          params: Object.assign({ host: l.host }, f.params || {}), reason: f.id });
      });
    });

    return {
      findings,
      links,
      decisive: findings.some((f) => f.severity === 'decisive'),
      strongCount: findings.filter((f) => f.severity === 'strong').length,
      weakCount: findings.filter((f) => f.severity === 'weak').length,
    };
  }

  return { analyzeMessages, normalize, splitSentences, CATEGORIES };
});
