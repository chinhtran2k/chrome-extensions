# Chrome Web Store listing

## Name
```
Table to CSV — Merged Cells Done Right
```

## Short description (132 max)
```
Export any web table to CSV, Excel, JSON or Markdown. Handles merged cells correctly, so your spreadsheet is not quietly wrong.
```

## Category
`Productivity` → `Workflow & Planning`

## Detailed description
```
Most table exporters break on the tables people actually need: the ones with
merged cells. A colspan or a rowspan turns into rows of different lengths and
values sitting under the wrong headers — and because the file still opens, the
mistake is easy to miss until a number is already in a report.

This extension builds a proper grid first, expanding every merged cell, and only
then writes the file. Every row comes out the same width, every value under the
header it belongs to.

WHAT IT DOES
• Finds every real table on the page and skips layout tables
• Expands colspan and rowspan so the output is always rectangular
• Cleans numbers for spreadsheets: $1,234.56 and €1.234,56 both become 1234.56
• Leaves labels alone — "Q1 2026" and "12 units" are not numbers
• Writes UTF-8 with a BOM so Excel opens accents correctly
• Never lets stylesheet or script text leak into a cell

FREE
Export the first table on any page as CSV.

PRO
Every table on the page, in one click. TSV, JSON and Markdown as well as CSV.
One payment, no subscription.

PRIVACY
Everything runs inside your browser. No server, no account, no analytics, no
data leaves your machine. The extension asks only for "activeTab", so it cannot
read a page until you click the button.
```

## Permission justifications
- **activeTab** — `Reads the current page only when the user clicks the extension, in order to find its tables.`
- **scripting** — `Runs the table extraction code inside the page the user asked to export.`
- **storage** — `Remembers the user's export options and licence key.`

Data collection: **none.** Remote code: **no.**

## Before publishing
1. Put your Paddle checkout URL in `BUY_URL` at the top of `src/popup.js`
2. Put your Paddle public key in `PADDLE_PUBLIC_KEY` in `src/licence.js`

Until the public key is set, `activate()` accepts nothing — it fails closed
rather than handing out free Pro.
