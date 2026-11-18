/*
 * Digital Identity Guard — directory of official accounts.
 *
 * RULE: only add a handle after you have seen it linked from the
 * organisation's OWN website (usually the icons at the bottom of the page).
 * Every account needs:
 *   platform  one of: x, instagram, facebook, tiktok, snapchat, linkedin,
 *             youtube, telegram, threads, whatsapp
 *   handle    the username exactly as in the link, without "@"
 *   source    the page on the organisation's website where you found the link
 *   checked   the date you checked it (YYYY-MM-DD)
 *
 * Accounts without a `source` are ignored by the app. A wrong handle here
 * would tell users that a scam account is official, so never guess, and never
 * copy handles from search results, news articles or other directories.
 *
 * Example:
 *   accounts: [
 *     { platform: 'x', handle: 'ExampleBank', source: 'https://www.example.com.sa/en/contact', checked: '2026-11-20' },
 *   ],
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DIGDirectory = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  return {
    orgs: [
      // ---- Government and regulators
      { id: 'sama', type: 'government', website: 'https://www.sama.gov.sa',
        name: { ar: 'البنك المركزي السعودي (ساما)', en: 'Saudi Central Bank (SAMA)' },
        aliases: ['sama', 'ساما', 'البنك المركزي', 'saudi central bank', 'مؤسسه النقد'], accounts: [] },
      { id: 'moi', type: 'government', website: 'https://www.moi.gov.sa',
        name: { ar: 'وزارة الداخلية', en: 'Ministry of Interior' },
        aliases: ['moi', 'الداخليه', 'وزاره الداخليه', 'ministry of interior'], accounts: [] },
      { id: 'absher', type: 'government', website: 'https://www.absher.sa',
        name: { ar: 'أبشر', en: 'Absher' },
        aliases: ['absher', 'ابشر'], accounts: [] },
      { id: 'moh', type: 'government', website: 'https://www.moh.gov.sa',
        name: { ar: 'وزارة الصحة', en: 'Ministry of Health' },
        aliases: ['moh', 'الصحه', 'وزاره الصحه', 'ministry of health'], accounts: [] },
      { id: 'nca', type: 'government', website: 'https://nca.gov.sa',
        name: { ar: 'الهيئة الوطنية للأمن السيبراني', en: 'National Cybersecurity Authority (NCA)' },
        aliases: ['nca', 'الامن السيبراني', 'national cybersecurity authority'], accounts: [] },
      { id: 'zatca', type: 'government', website: 'https://zatca.gov.sa',
        name: { ar: 'هيئة الزكاة والضريبة والجمارك', en: 'Zakat, Tax and Customs Authority (ZATCA)' },
        aliases: ['zatca', 'الزكاه', 'الجمارك', 'الضريبه', 'customs'], accounts: [] },
      { id: 'spl', type: 'company', website: 'https://splonline.com.sa',
        name: { ar: 'البريد السعودي | سبل', en: 'Saudi Post | SPL' },
        aliases: ['spl', 'سبل', 'البريد', 'البريد السعودي', 'saudi post'], accounts: [] },

      // ---- Banks
      { id: 'alrajhi', type: 'bank', website: 'https://www.alrajhibank.com.sa',
        name: { ar: 'مصرف الراجحي', en: 'Al Rajhi Bank' },
        aliases: ['alrajhi', 'al rajhi', 'الراجحي', 'راجحي'], accounts: [] },
      { id: 'snb', type: 'bank', website: 'https://www.alahli.com',
        name: { ar: 'البنك الأهلي السعودي', en: 'Saudi National Bank (SNB)' },
        aliases: ['snb', 'الاهلي', 'البنك الاهلي', 'saudi national bank', 'alahli'], accounts: [] },
      { id: 'riyad', type: 'bank', website: 'https://www.riyadbank.com',
        name: { ar: 'بنك الرياض', en: 'Riyad Bank' },
        aliases: ['riyad bank', 'riyadbank', 'بنك الرياض'], accounts: [] },
      { id: 'alinma', type: 'bank', website: 'https://www.alinma.com',
        name: { ar: 'مصرف الإنماء', en: 'Alinma Bank' },
        aliases: ['alinma', 'الانماء', 'انماء'], accounts: [] },

      // ---- Telecom
      { id: 'stc', type: 'company', website: 'https://www.stc.com.sa',
        name: { ar: 'إس تي سي', en: 'stc' },
        aliases: ['stc', 'اس تي سي', 'الاتصالات السعوديه'], accounts: [] },
      { id: 'mobily', type: 'company', website: 'https://www.mobily.com.sa',
        name: { ar: 'موبايلي', en: 'Mobily' },
        aliases: ['mobily', 'موبايلي'], accounts: [] },
      { id: 'zain', type: 'company', website: 'https://sa.zain.com',
        name: { ar: 'زين السعودية', en: 'Zain KSA' },
        aliases: ['zain', 'زين'], accounts: [] },
    ],
  };
});
