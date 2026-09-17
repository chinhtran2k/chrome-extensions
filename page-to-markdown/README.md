# Page to Markdown

Chrome extension. Converts the current web page to clean Markdown — article
only, no navigation, cookie banners or footers — for pasting into AI tools.

## Load it locally (no fee)

1. Open `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. **Load unpacked** → pick this folder
4. Pin the extension and open any article

Nothing about this step costs money. The $5 Chrome Web Store fee applies only
when publishing publicly.

## Test

```bash
npm install jsdom      # once
node test/run.js
```

## Measured

| Page | HTML | Markdown | Saved |
|---|---|---|---|
| Wikipedia article | 249,097 chars | 44,183 | 82% |
| Wikipedia GDP list | 676,676 chars | 11,856 | 98% |
| Long blog post | 131,975 chars | 20,595 | 84% |
| VnExpress article | — | 5,295 | — |
| VnExpress homepage | 260,027 chars | 7,195 (listing mode) | — |

## Design notes

**Listing pages need different handling.** A news homepage has no article to
find. Scoring it the usual way picks the single biggest story and throws away
the other forty headlines — and the user cannot tell anything went missing.
Detection uses two signals: how little of the page the chosen block covers, and
whether the page is mostly linked headings with little prose. Either one
switches to listing mode, which returns every headline with its link.

**Finding the article matters more than the Markdown.** Running a converter over
`document.body` is what makes most of these tools useless: you get the whole
page chrome. `findMainContent` scores candidate blocks by text length, paragraph
count and link density — navigation is nearly all link text, articles are not.

**No server, ever.** All conversion happens in the page. That keeps running cost
at zero regardless of user count, and means there is no data to leak.

**Minimal permissions.** `activeTab`, `scripting`, `storage`. No host
permissions, so the extension cannot read any page until the user clicks.

## Files

```
manifest.json        MV3, three permissions
src/extract.js       content extraction + Markdown conversion
src/popup.html/js    UI, options, token counter
src/background.js    keyboard shortcut handler
test/run.js          10 tests, mostly about junk removal
STORE-LISTING.md     copy-paste fields for publishing
```
