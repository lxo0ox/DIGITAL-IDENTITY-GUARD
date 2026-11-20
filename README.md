# 🛡️ Digital Identity Guard · حارس الهوية الرقمية

An awareness tool that answers two questions about an unfamiliar social-media account:

1. **Is this account really who it claims to be?**
2. **Is it trying to scam me?**

Student project – Ebdaa 2026 · Yazan Omar Alzahrani · Mohannad Ali Alghamdi

## Run it

Open `index.html` in any browser. There is no build step. Every check runs in the browser and nothing you type is sent anywhere. The site never contacts Instagram, X or any other platform.

The one exception is the optional **screenshot reader**: when it is switched on, a screenshot the user chooses is sent to the project's server to be read by an AI model. See [Screenshot reader](#screenshot-reader).

## How a check works

The user enters the account (link or @username) and, optionally, who it claims to be, the verification badge they see, the messages it sent, and anything they noticed.

**Screenshots:** instead of typing, the user can choose, drag or paste (Ctrl+V) a screenshot of the profile or chat. The AI reader fills in the account, the badge and the other person's messages (the user's own replies are left out), and warns when any letter of the username is unclear. The user checks the fields before analysing.

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
| `js/config.js` | Site settings: the screenshot reader's address (nothing secret) |
| `js/vision.js` | Sends a screenshot to the reader and turns the reply into form values |
| `server/` | The screenshot reader: a Cloudflare Worker that calls the Claude API |
| `js/i18n.js` | Arabic and English text |
| `js/app.js` | Navigation, language switch, examples, report |
| `tests/` | Tests for the checks |
| `docs/` | Project methodology document, and notes on the screenshot-reading options |

## Screenshot reader

`server/` is a small Cloudflare Worker. The website sends it one screenshot; it asks Claude (`claude-opus-5-5`) to transcribe what is visible into fixed JSON and sends that back. It never decides whether something is a scam: the website's own checks do that. Why we chose this over in-browser OCR is in [docs/screenshot-reading-options.md](docs/screenshot-reading-options.md).

**The API key is never in this repo or the website.** It is stored only as a secret in Cloudflare.

### Switching it on (one time, on your computer)

You need [Node.js](https://nodejs.org) 20 or newer, a free [Cloudflare](https://dash.cloudflare.com/sign-up) account and an [Anthropic Console](https://console.anthropic.com) account.

1. **Create an API key** in the Anthropic Console (API Keys → Create key). Also set a **monthly spend limit** in the Console's limits/billing settings. This is the real protection against unexpected bills.
2. **Deploy the reader:**
   ```bash
   cd server
   npm install
   npx wrangler login                          # opens the browser to sign in to Cloudflare
   npx wrangler secret put ANTHROPIC_API_KEY   # paste the key when asked; it is not shown or saved locally
   npx wrangler deploy
   ```
   The last command prints the reader's address, like `https://dig-screenshot-reader.<name>.workers.dev`.
3. **Connect the website:** put that address in `js/config.js` (`readerUrl`) and commit it. The address is not secret.

If the site is served from somewhere other than `https://lxo0ox.github.io`, add that address to `ALLOWED_ORIGINS` in `server/wrangler.toml` and deploy again.

### Cost and limits

- Each screenshot is one Claude request. With `EFFORT = "high"` (in `server/wrangler.toml`) it costs roughly a few US cents. Check the real numbers in the Console's usage page after a few tries. `medium` is cheaper and faster.
- The reader only answers requests from the addresses in `ALLOWED_ORIGINS`, accepts images up to 5 MB, and allows each visitor 10 screenshots a minute. A script could still call it directly, so keep the Console spend limit on.
- Screenshots are sent to Anthropic's API for processing. The reader itself stores nothing.

## Tests

```bash
node --test                  # website checks and the reader's request handling
cd server && npm test        # the reader only
```

The reader's tests replace Claude with a fixed reply, so they need no API key.
