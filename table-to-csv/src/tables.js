/**
 * Table extraction.
 *
 * The reason the existing tools in this niche sit at 3.6 stars is not Markdown
 * syntax or file encoding — it is merged cells. A table that uses colspan or
 * rowspan (which most real report tables do) comes out of a naive extractor
 * with rows of different lengths and values under the wrong headers, and the
 * spreadsheet it lands in is quietly wrong.
 *
 * This builds a real grid first, expanding every span, and only then formats.
 */

function textOf(el) {
  if (!el) return "";
  // textContent happily returns the contents of <style> and <script>, which is
  // how stylesheet rules end up inside a spreadsheet cell.
  let node = el;
  if (el.querySelector && el.querySelector("style, script, noscript")) {
    node = el.cloneNode(true);
    for (const junk of node.querySelectorAll("style, script, noscript")) junk.remove();
  }
  return ((node.innerText ?? node.textContent) || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isHidden(el) {
  if (el.hasAttribute("hidden") || el.getAttribute("aria-hidden") === "true") return true;
  const s = window.getComputedStyle(el);
  return s.display === "none" || s.visibility === "hidden";
}

/**
 * Expand a table into a rectangular grid, resolving colspan and rowspan.
 * Returns { grid, headerRows }.
 */
function toGrid(table) {
  const rows = Array.from(table.rows || []);
  const grid = [];
  // Cells still occupying rows below, keyed by column index.
  const carry = new Map();

  rows.forEach((tr, r) => {
    if (!grid[r]) grid[r] = [];
    let c = 0;
    const placed = grid[r];

    const takeSlot = () => {
      while (placed[c] !== undefined) c++;
      return c;
    };

    // First, drop in anything spanning down from an earlier row.
    for (const [col, entry] of carry) {
      if (entry.remaining > 0) {
        for (let i = 0; i < entry.colspan; i++) placed[col + i] = entry.text;
        entry.remaining--;
        if (entry.remaining === 0) carry.delete(col);
      }
    }

    for (const cell of Array.from(tr.cells || [])) {
      const col = takeSlot();
      const colspan = Math.max(1, Math.min(Number(cell.colSpan) || 1, 200));
      const rowspan = Math.max(1, Math.min(Number(cell.rowSpan) || 1, 500));
      const text = textOf(cell);
      for (let i = 0; i < colspan; i++) placed[col + i] = text;
      if (rowspan > 1) carry.set(col, { text, colspan, remaining: rowspan - 1 });
      c = col + colspan;
    }
  });

  const width = Math.max(0, ...grid.map(r => r.length));
  const rect = grid.map(r => {
    const out = r.slice();
    for (let i = 0; i < width; i++) if (out[i] === undefined) out[i] = "";
    return out;
  });

  // Header rows: any leading row made entirely of <th>.
  let headerRows = 0;
  for (const tr of rows) {
    const cells = Array.from(tr.cells || []);
    if (cells.length && cells.every(c => c.tagName === "TH")) headerRows++;
    else break;
  }
  if (!headerRows && table.tHead && table.tHead.rows.length) headerRows = table.tHead.rows.length;

  return { grid: rect, headerRows };
}

/** Strip currency symbols and thousands separators so spreadsheets see a number. */
function cleanNumber(value) {
  const raw = (value || "").trim();
  if (!raw) return raw;
  // Any letter at all means this is a label, not a figure. "Q1 2026" and
  // "12 units" must survive untouched, or the spreadsheet silently lies.
  if (/\p{L}/u.test(raw)) return raw;
  if (!/^[^\d]{0,3}-?[\d.,\s]+%?$/.test(raw)) return raw;
  let s = raw.replace(/[^\d.,-]/g, "");
  if (!s || !/\d/.test(s)) return raw;

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    // Whichever appears last is the decimal separator.
    if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (lastComma > -1) {
    // A single comma with exactly two digits after it is a decimal comma.
    s = /,\d{1,2}$/.test(s) ? s.replace(",", ".") : s.replace(/,/g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) ? String(n) : raw;
}

function findTables(doc, minCells = 4) {
  const out = [];
  for (const table of Array.from(doc.querySelectorAll("table"))) {
    if (isHidden(table)) continue;
    // Skip layout tables without discarding narrow but real ones: a single
    // row of one cell is a wrapper; two rows of one column is data.
    const cells = table.querySelectorAll("td, th").length;
    const rowCount = (table.rows || []).length;
    if (cells < 2 || rowCount < 2) continue;
    if (cells < minCells && rowCount < 3) continue;
    // Skip tables that only wrap another table.
    if (table.querySelector("table") && cells < 12) continue;
    const { grid, headerRows } = toGrid(table);
    if (!grid.length || !grid[0].length) continue;
    out.push({
      grid,
      headerRows,
      rows: grid.length,
      cols: grid[0].length,
      caption: textOf(table.caption) || nearestHeading(table),
    });
  }
  return out;
}

function nearestHeading(table) {
  let node = table.previousElementSibling;
  let hops = 0;
  while (node && hops < 4) {
    if (/^H[1-6]$/.test(node.tagName)) return textOf(node).slice(0, 80);
    node = node.previousElementSibling;
    hops++;
  }
  const parentHeading = table.parentElement &&
    table.parentElement.querySelector("h1, h2, h3, h4");
  return parentHeading ? textOf(parentHeading).slice(0, 80) : "";
}

// --- formatters ----------------------------------------------------------

function csvEscape(v, delimiter) {
  const s = v == null ? "" : String(v);
  return /["\n\r]|^\s|\s$/.test(s) || s.includes(delimiter) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCSV(grid, opts) {
  const d = opts.delimiter || ",";
  const rows = opts.cleanNumbers
    ? grid.map(r => r.map(cleanNumber))
    : grid;
  // A BOM is what makes Excel open UTF-8 correctly instead of mangling accents.
  const bom = opts.bom ? "﻿" : "";
  return bom + rows.map(r => r.map(v => csvEscape(v, d)).join(d)).join("\r\n") + "\r\n";
}

function toJSON(grid, headerRows, opts) {
  if (!grid.length) return "[]";
  const header = headerRows > 0 ? grid[headerRows - 1] : grid[0].map((_, i) => `col${i + 1}`);
  const body = grid.slice(headerRows > 0 ? headerRows : 1);
  const seen = new Map();
  const keys = header.map((h, i) => {
    let key = (h || `col${i + 1}`).trim() || `col${i + 1}`;
    const n = (seen.get(key) || 0) + 1;
    seen.set(key, n);
    return n > 1 ? `${key}_${n}` : key;
  });
  const out = body.map(r => {
    const o = {};
    keys.forEach((k, i) => {
      const v = r[i] ?? "";
      o[k] = opts.cleanNumbers ? cleanNumber(v) : v;
    });
    return o;
  });
  return JSON.stringify(out, null, 2);
}

function toMarkdown(grid, headerRows, opts) {
  if (!grid.length) return "";
  const rows = opts.cleanNumbers ? grid.map(r => r.map(cleanNumber)) : grid;
  const esc = v => String(v ?? "").replace(/\|/g, "\\|");
  const head = rows[headerRows > 0 ? headerRows - 1 : 0].map(esc);
  const body = rows.slice(headerRows > 0 ? headerRows : 1).map(r => r.map(esc));
  let md = `| ${head.join(" | ")} |\n| ${head.map(() => "---").join(" | ")} |\n`;
  for (const r of body) md += `| ${r.join(" | ")} |\n`;
  return md;
}

function format(table, opts) {
  if (opts.format === "json") return toJSON(table.grid, table.headerRows, opts);
  if (opts.format === "markdown") return toMarkdown(table.grid, table.headerRows, opts);
  if (opts.format === "tsv") return toCSV(table.grid, { ...opts, delimiter: "\t", bom: false });
  return toCSV(table.grid, opts);
}

function scanTables(opts) {
  const tables = findTables(document);
  return {
    count: tables.length,
    title: document.title,
    url: (window.location || {}).href || "",
    tables: tables.map((t, i) => ({
      index: i,
      rows: t.rows,
      cols: t.cols,
      caption: t.caption,
      preview: t.grid.slice(0, 3).map(r => r.slice(0, 4)),
    })),
  };
}

function exportTable(index, opts) {
  const tables = findTables(document);
  const table = tables[index];
  if (!table) return null;
  return {
    text: format(table, opts),
    rows: table.rows,
    cols: table.cols,
    caption: table.caption,
  };
}
