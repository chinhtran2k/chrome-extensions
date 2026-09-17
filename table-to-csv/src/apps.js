/**
 * Web apps whose grids are not HTML tables.
 *
 * Google Sheets, Airtable and their kind draw cells on a canvas or in virtual
 * divs, and only the rows currently on screen exist in the DOM at all. Reading
 * that DOM does not produce a partial export — it produces a wrong one, which
 * is worse, because nothing looks broken.
 *
 * Where the app publishes a proper export endpoint, use that instead.
 */

const APPS = [
  {
    id: "google-sheets",
    name: "Google Sheets",
    match: /^https:\/\/docs\.google\.com\/spreadsheets\/d\/([A-Za-z0-9_-]+)/,
    // Google's own CSV export: complete data, correct types, no scraping.
    exportUrl(url) {
      const id = url.match(this.match)[1];
      const gid = (url.match(/[#&?]gid=(\d+)/) || [, "0"])[1];
      return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
    },
    note: "Reading the page would give you only the rows currently on screen. "
        + "This uses Google's own export instead, so you get the whole sheet.",
  },
  {
    id: "google-docs",
    name: "Google Docs",
    match: /^https:\/\/docs\.google\.com\/document\/d\/([A-Za-z0-9_-]+)/,
    exportUrl(url) {
      const id = url.match(this.match)[1];
      return `https://docs.google.com/document/d/${id}/export?format=txt`;
    },
    note: "Google Docs renders its own layout. This uses Google's export instead.",
  },
  {
    id: "airtable",
    name: "Airtable",
    match: /^https:\/\/airtable\.com\//,
    exportUrl: null,
    note: "Airtable draws its grid in virtual rows, so the page holds only what "
        + "is on screen. Use Airtable's own menu: ⋯ → Download CSV.",
  },
  {
    id: "notion",
    name: "Notion",
    match: /^https:\/\/(www\.)?notion\.(so|site)\//,
    exportUrl: null,
    note: "Notion databases are not HTML tables. Use Notion's own menu: "
        + "⋯ → Export → CSV.",
  },
];

function detectApp(url) {
  return APPS.find(app => app.match.test(url || "")) || null;
}
