# 🛡️ Digital Identity Guard · حارس الهوية الرقمية

An awareness tool that answers two questions about an unfamiliar social-media account:

1. **Is this account really who it claims to be?**
2. **Is it trying to scam me?**

Student project – Ebdaa 2026 · Yazan Omar Alzahrani · Mohannad Ali Alghamdi

## Run it

Open `index.html` in any browser. There is no build step and no server: every check runs in the browser and nothing you type is sent anywhere. The site never contacts Instagram, X or any other platform.

## How a check works

The user enters the account (link or @username) and, optionally, who it claims to be, the verification badge they see, the messages it sent, and anything they noticed.

| Check | What it does | File |
| --- | --- | --- |
| **Identity** | Compares the account with the organisation's official accounts (from the directory) or with the real account's link the user pastes. A match only counts on the **same platform**. Catches look-alikes such as `yazan_0mar` vs `yazan_omar`. | `js/guard.js` |
| **Badge** | Explains what the badge means on that platform. On X, blue = paid subscription, gold = verified organisation, grey = government. On Instagram/Facebook, blue can be Meta Verified (paid). | `js/guard.js` |
| **Messages** | Arabic and English. Requests for a verification code, password, PIN or card details are *decisive*. Money requests, threats, urgency, prizes, investment offers, "my new number", moving to WhatsApp, and dangerous links are warning signs. A genuine SMS that says "do not share this code" is not flagged. | `js/messages.js` |
| **Supporting signs** | Look-alike letters, hidden characters, official-sounding words, imitation domains, shortened links, plus the signs the user ticked. Context only. | `js/analyzer.js` |

### Result levels (most serious first)

| Level | When |
| --- | --- |
| 🚨 Scam behaviour detected | Asks for a code, password or card details, or uses a phishing link |
| ⛔ Not the official account | Claims to be someone, but is not their official account |
| ⚠️ Several warning signs | Several message or profile warning signs together |
| ✅ Official account | Matches the official account on the same platform, nothing else wrong |
| 🟢 No warning signs found | Nothing found, which is not proof the account is safe |

## The official accounts directory

`js/official-accounts.js` lists organisations people often get impersonated as (banks, government, telecom). **The account lists start empty on purpose.** A wrong handle there would tell users that a scam account is official, so:

1. Open the organisation's **own website** (the address in the file).
2. Find its social-media links, usually the icons at the bottom of the page.
3. Add each one with the page you found it on and the date:

```js
accounts: [
  { platform: 'x', handle: 'ExampleBank', source: 'https://www.example.com.sa/en/contact', checked: '2026-11-20' },
],
```

Accounts without a `source` are ignored. Never copy handles from search results, news articles or other directories. Re-check the list before presenting the project, because organisations do change their handles.

Until an organisation's accounts are added, users can still confirm an account by pasting the official link from the organisation's website into "Who does it claim to be?".

## Files

| Path | Purpose |
| --- | --- |
| `index.html` | Page structure |
| `css/style.css` | Styles (RTL/LTR, mobile) |
| `js/analyzer.js` | Username and link checks |
| `js/messages.js` | Message scam analyser |
| `js/official-accounts.js` | Official accounts directory |
| `js/guard.js` | Identity and badge checks, final result |
| `js/i18n.js` | Arabic and English text |
| `js/app.js` | Navigation, language switch, examples, report |
| `tests/` | Tests for the checks |
| `docs/` | Project methodology document |

## Tests

```bash
node --test
```
