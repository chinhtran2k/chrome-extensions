# Table to CSV

Chrome extension. Exports web tables to CSV, TSV, JSON or Markdown — getting
merged cells right, which is where the rest of this category falls down.

## Why this exists

Every competing extension in this niche sits around 3.6 stars. The failure is
not formatting, it is `colspan` and `rowspan`: a naive extractor reads cells in
document order, so a merged cell shifts every value after it one column left.
The file opens fine. The numbers are wrong.

This builds a rectangular grid first, expanding spans into every slot they
occupy, then formats. Tests cover colspan, rowspan, and both together.

## Free vs Pro

| | Free | Pro |
|---|---|---|
| Tables per page | first one | all |
| Formats | CSV | CSV, TSV, JSON, Markdown |
| Export all at once | — | yes |

Licences are verified offline against an embedded Paddle public key. No server,
so running cost stays at zero.

## Test

```bash
npm install jsdom
node test/run.js
```

12 tests. Most are about merged cells, number formats and junk exclusion.

## Verified against real pages

Ran over a Wikipedia article: 6 tables found, every one rectangular after span
expansion, no stylesheet text in any cell.

## Files

```
manifest.json     MV3, three permissions
src/tables.js     grid building, number cleaning, four formatters
src/licence.js    offline Paddle licence verification, fails closed
src/popup.html/js UI, table picker, free/Pro gating
test/run.js       12 tests
```
