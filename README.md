# Chrome extensions

Two browser extensions, built around the same idea: take what a web page
actually contains and hand it over in a form you can use — without the
navigation, the cookie banners or the footers.

Both run entirely inside the browser. No server, no account, no analytics, and
no data leaves your machine.

---

## Page to Markdown — Clean Copy for AI

Converts the current page to clean Markdown, ready to paste into ChatGPT,
Claude or any other AI tool.

Measured on real pages, with the default settings:

| Page | HTML | Markdown | Saved |
|---|---|---|---|
| Wikipedia article | 249,097 chars | 16,019 | **94%** |
| Long blog post | 131,975 chars | 20,533 | **84%** |

**Two modes, chosen automatically.** On an article it converts the article. On a
homepage or index it returns every headline with its link and summary, rather
than picking one story and silently dropping the other forty.

- Headings, lists, tables and code blocks preserved; code fences keep their language
- Live token estimate, so you know the cost before you paste
- Optional front matter with title, source URL and date
- Citation markers stripped — they are noise in an AI paste
- Keyboard shortcut: `Ctrl+Shift+M` / `Cmd+Shift+M`

[→ page-to-markdown/](page-to-markdown/)

---

## Table to CSV — Merged Cells Done Right

Exports web tables to CSV, TSV, JSON or Markdown.

**The problem it actually solves is merged cells.** A naive extractor reads
cells in document order, so one `colspan` shifts every value after it a column
to the left. The file still opens. The numbers are wrong, and nothing looks
broken.

This builds a rectangular grid first, expanding every span into the slots it
occupies, and only then formats.

- `$1,234.56` and `€1.234,56` both become `1234.56`; `Q1 2026` and `N/A` are left alone
- UTF-8 BOM so Excel opens accented text correctly
- Stylesheet and script text never reaches a cell
- Detects Google Sheets, Google Docs, Airtable and Notion, whose grids are not
  HTML tables, and routes to the app's own export instead of scraping a wrong answer

[→ table-to-csv/](table-to-csv/)

---

## Install from source

```bash
git clone https://github.com/chinhtran2k/chrome-extensions.git
```

Then in Chrome: `chrome://extensions` → enable **Developer mode** →
**Load unpacked** → pick either folder.

## Tests

```bash
npm install jsdom
node page-to-markdown/test/run.js    # 13 tests
node table-to-csv/test/run.js        # 16 tests
```

Most tests cover the failure modes that make this category of extension
unreliable: page furniture leaking into the output, merged cells shifting
columns, numbers silently reformatted, stylesheet text landing in a spreadsheet.

## Contact

Found a page that converts badly? Open an issue with the URL — that is the most
useful thing you can send.

- **Issues:** https://github.com/chinhtran2k/chrome-extensions/issues
- **LinkedIn:** https://www.linkedin.com/in/tr%E1%BA%A7n-ch%C3%ADnh-43b905289/
- **Telegram:** https://t.me/nobin_2k

## Licence

MIT
