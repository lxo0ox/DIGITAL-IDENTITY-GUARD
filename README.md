# 🛡️ Digital Identity Guard · حارس الهوية الرقمية

An awareness tool that helps people spot the warning signs of fake and impersonating social-media accounts, and explains *why* each sign matters.

Student project – Ebdaa 2026 · Yazan Omar Alzahrani · Mohannad Ali Alghamdi

## Run it

Open `index.html` in any browser. There is no build step and no server: all analysis runs in the browser and nothing you type is sent anywhere.

## How the check works

1. **Automatic checks** on the username or link you enter:
   - look-alike letters from other alphabets (e.g. Cyrillic `у` instead of `y`) and hidden zero-width characters
   - words that pretend to be official (`official`, `support`, `verify`, platform names…)
   - long digit runs, unusual separators, random-looking strings
   - comparison with the real account you expected: catches `yazan_0mar` vs `yazan_omar`, `rn` vs `m`, one-letter differences and extra suffixes
   - links: imitation domains (`instagrarn.com`, `instagram-login.net`), `xn--` domains, IP addresses, URL shorteners, non-https links
2. **Your observations**: account age, activity, photo, requests for sensitive data (same weights as the original prototype).
3. **Combined signs**: extra points when certain signs appear together (e.g. a suspicious name **and** a request for a password).
4. **Group caps** stop the same underlying sign from being counted twice.

The report lists every reason with its points. The percentage is a trial indicator built on assumed weights, not a real probability of fraud.

## Files

| Path | Purpose |
| --- | --- |
| `index.html` | Page structure |
| `css/style.css` | Styles (RTL/LTR, mobile) |
| `js/analyzer.js` | Analysis engine (no DOM, also runs in Node) |
| `js/i18n.js` | Arabic and English text |
| `js/app.js` | Navigation, language switch, report rendering |
| `tests/analyzer.test.js` | Engine tests |

## Tests

```bash
node --test
```
