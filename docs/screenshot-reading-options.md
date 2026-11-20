# Reading screenshots: the two options we tried

The site can fill in the form from a screenshot of a profile or chat. We built two ways to read the image. **Option 2 (AI vision) is the one in use.** Option 1 is kept here so we can come back to it.

## Option 1: OCR in the browser (paused)

**How it worked:** [Tesseract.js](https://github.com/naptha/tesseract.js) 5.1.1 read the text on the user's own device (Arabic + English). Nothing was uploaded, there was no server, no API key and no cost. Dark-mode screenshots were inverted and small ones enlarged first.

**Results on three test screenshots (about 2 s each):**

| Screenshot | Result |
| --- | --- |
| Arabic chat, dark mode, asking for a code | Read well enough to catch the code request, but the username `yazan_0mar` came out as `yazan_Omar` |
| English chat, fake bank link + card number and PIN | Read almost perfectly |
| X profile promising guaranteed profits | Read well |

**Why we paused it:** wrong readings are dangerous for this tool. The trick impersonators use most is a look-alike character (`0`/`O`, `l`/`I`), and that is exactly what OCR confuses, so the identity check could be fooled. It also skipped text in coloured chat bubbles and cannot see badge colours.

**Where the code is:** commit `491c989` ("Read text from screenshots in the browser") and draft pull request #3. To bring it back:

```bash
git checkout 491c989 -- js/ocr.js tests/ocr.test.js
```

Then load `js/ocr.js` in `index.html` and use `DIGOcr.read(file, onProgress)`, which returns `{ text, accounts: { sure, maybe } }`.

**Possible future uses:** an offline fallback when the AI reader is unavailable, or a free first pass for messages only (never for usernames).

## Option 2: AI vision model (in use)

**How it works:** the website shrinks the screenshot and sends it to a small server (`server/`, a Cloudflare Worker). The server asks Claude (`claude-opus-5-5`) to transcribe it into fixed JSON: platform, exact username, a flag when any character is unclear, display name, badge colour, whether a check mark is a typed emoji, bio, stats, each message marked "them" or "me", and links. The website fills in the form with it, and the user checks it before analysing.

**Why:** it reads layout and context, copies usernames character by character and says when it is unsure, sees badge colours and fake emoji badges, and tells the other person's messages from the user's own.

**Trade-offs:** it needs a server and an API key (kept only in the server's secret settings), each screenshot costs a few cents, and the image is sent to Anthropic's API for processing. It can still make mistakes, so the user always reviews the filled-in fields.
