/**
 * Page → Markdown.
 *
 * Two jobs, and the first one is what most converters skip: decide which part
 * of the page is the article. Running a converter over document.body hands the
 * user a wall of navigation, cookie banners and footer links — which is exactly
 * what makes a paste into an AI tool expensive and inaccurate.
 */

const BLOCK_TAGS = new Set([
  "NAV", "HEADER", "FOOTER", "ASIDE", "FORM", "DIALOG", "MENU",
  "SCRIPT", "STYLE", "NOSCRIPT", "SVG", "CANVAS", "IFRAME", "TEMPLATE",
  "BUTTON", "INPUT", "SELECT", "TEXTAREA", "AUDIO", "VIDEO",
]);

// Class/id fragments that reliably mark page furniture rather than content.
const JUNK_PATTERN = new RegExp([
  "nav", "menu", "sidebar", "side-bar", "footer", "header", "banner",
  "cookie", "consent", "gdpr", "popup", "modal", "overlay", "toast",
  "advert", "\\bads?\\b", "sponsor", "promo", "newsletter", "subscribe",
  "social", "share", "related", "recommend", "comment", "disqus",
  "breadcrumb", "pagination", "skip-link", "screen-reader", "sr-only",
  "toolbar", "widget", "paywall", "signup", "login",
].join("|"), "i");

const CONTENT_SELECTORS = [
  "article", "main", '[role="main"]', "[itemprop='articleBody']",
  ".post-content", ".article-content", ".entry-content", ".markdown-body",
  "#content", ".content",
];

/** innerText is rendering-dependent and absent in some contexts; fall back. */
function textOf(el) {
  return (el && (el.innerText ?? el.textContent)) || "";
}

function isHidden(el) {
  if (el.hasAttribute("hidden") || el.getAttribute("aria-hidden") === "true") return true;
  const style = window.getComputedStyle(el);
  return style.display === "none" || style.visibility === "hidden" || style.opacity === "0";
}

function looksLikeJunk(el) {
  const marker = `${el.className || ""} ${el.id || ""}`;
  if (typeof marker !== "string") return false;
  return JUNK_PATTERN.test(marker);
}

/** Density of text vs links — navigation blocks are almost all link text. */
function linkDensity(el) {
  const text = textOf(el).trim().length;
  if (!text) return 1;
  let linkText = 0;
  for (const a of el.querySelectorAll("a")) linkText += textOf(a).length;
  return linkText / text;
}

function scoreCandidate(el) {
  const text = textOf(el).trim();
  if (text.length < 200) return -1;
  const paragraphs = el.querySelectorAll("p").length;
  const density = linkDensity(el);
  // Long text, many paragraphs, few links.
  return text.length * (1 - density) + paragraphs * 120;
}

/** Pick the element most likely to hold the article. */
function findMainContent(doc) {
  let best = null;
  let bestScore = 0;

  for (const selector of CONTENT_SELECTORS) {
    for (const el of doc.querySelectorAll(selector)) {
      if (isHidden(el)) continue;
      const score = scoreCandidate(el);
      if (score > bestScore) { best = el; bestScore = score; }
    }
  }

  // Nothing semantic matched — fall back to scoring every sizeable block.
  if (!best) {
    for (const el of doc.querySelectorAll("div, section, td")) {
      if (isHidden(el) || looksLikeJunk(el)) continue;
      const score = scoreCandidate(el);
      if (score > bestScore) { best = el; bestScore = score; }
    }
  }

  return best || doc.body;
}

// Citation markers like [1] or [n 2] are split across several elements on
// wiki-style pages, which leaves stray brackets on their own lines — and they
// are noise in an AI paste regardless.
const CITATION_SELECTORS = [
  "sup.reference", "sup.Template-Fact", ".mw-ref", ".reference",
  ".footnote-ref", "a.footnote", "[role='doc-noteref']",
].join(", ");

/**
 * Listing pages — a news homepage, a blog index, a search result — have no
 * single article to find. Scoring them the usual way picks the one biggest
 * story and silently throws away the other forty headlines, which is worse
 * than useless: the user cannot tell anything is missing.
 */
function collectHeadlines(doc) {
  const items = [];
  const seen = new Set();

  for (const heading of doc.querySelectorAll("h1, h2, h3, h4")) {
    if (isHidden(heading)) continue;
    const link = heading.matches("a") ? heading : heading.querySelector("a")
      || (heading.parentElement && heading.parentElement.closest("a"));
    const title = textOf(heading).trim();
    if (title.length < 12 || title.length > 200) continue;

    const href = link && link.getAttribute("href");
    const url = href && !href.startsWith("javascript:") ? absolute(href) : null;
    const key = url || title;
    if (seen.has(key)) continue;
    seen.add(key);

    // A short lead paragraph often sits right after the headline.
    let summary = "";
    const container = heading.closest("article, li, .item-news, .thumb-art, div") || heading.parentElement;
    if (container) {
      const p = container.querySelector("p");
      if (p) {
        const text = textOf(p).trim();
        if (text.length > 40 && text !== title) summary = text.slice(0, 300);
      }
    }
    items.push({ title, url, summary });
  }
  return items;
}

/** Text length of the page's body, used to judge how much a candidate covers. */
function bodyTextLength(doc) {
  return textOf(doc.body).length;
}

function cleanClone(root) {
  const clone = root.cloneNode(true);
  for (const cite of Array.from(clone.querySelectorAll(CITATION_SELECTORS))) cite.remove();
  for (const el of Array.from(clone.querySelectorAll("*"))) {
    if (BLOCK_TAGS.has(el.tagName)) { el.remove(); continue; }
    if (looksLikeJunk(el) && textOf(el).trim().length < 400) el.remove();
  }
  return clone;
}

// --- Markdown conversion -------------------------------------------------

function escapeText(text) {
  return text.replace(/([\\`*_{}\[\]()#+\-.!])/g, "\\$1");
}

function inline(node, opts) {
  let out = "";
  for (const child of node.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      out += child.textContent.replace(/\s+/g, " ");
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    const tag = child.tagName;
    const inner = inline(child, opts).trim();

    if (tag === "BR") out += "\n";
    else if (tag === "STRONG" || tag === "B") out += inner ? `**${inner}**` : "";
    else if (tag === "EM" || tag === "I") out += inner ? `*${inner}*` : "";
    else if (tag === "DEL" || tag === "S") out += inner ? `~~${inner}~~` : "";
    else if (tag === "CODE") out += inner ? `\`${inner}\`` : "";
    else if (tag === "A") {
      const href = child.getAttribute("href") || "";
      out += (opts.links && href && !href.startsWith("javascript:"))
        ? `[${inner}](${absolute(href)})` : inner;
    } else if (tag === "IMG") {
      if (opts.images) {
        const src = child.getAttribute("src") || "";
        const alt = child.getAttribute("alt") || "";
        if (src) out += `![${alt}](${absolute(src)})`;
      }
    } else out += inner;
  }
  return out;
}

function absolute(url) {
  try { return new URL(url, document.baseURI).href; } catch { return url; }
}

function tableToMarkdown(table, opts) {
  const rows = Array.from(table.querySelectorAll("tr"));
  if (!rows.length) return "";
  const grid = rows.map(tr =>
    Array.from(tr.querySelectorAll("th, td"))
      .map(cell => inline(cell, opts).trim().replace(/\|/g, "\\|").replace(/\n/g, " ")));
  const width = Math.max(...grid.map(r => r.length));
  if (!width) return "";
  const pad = r => { const c = r.slice(); while (c.length < width) c.push(""); return c; };
  const head = pad(grid[0]);
  const body = grid.slice(1).map(pad);
  let md = `| ${head.join(" | ")} |\n| ${head.map(() => "---").join(" | ")} |\n`;
  for (const r of body) md += `| ${r.join(" | ")} |\n`;
  return md;
}

function blocks(node, opts, depth = 0) {
  let md = "";
  for (const child of node.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent.trim();
      if (text) md += text + "\n\n";
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    const tag = child.tagName;

    if (/^H[1-6]$/.test(tag)) {
      const text = inline(child, opts).trim();
      if (text) md += `${"#".repeat(Number(tag[1]))} ${text}\n\n`;
    } else if (tag === "P") {
      const text = inline(child, opts).trim();
      if (text) md += text + "\n\n";
    } else if (tag === "PRE") {
      const code = textOf(child).replace(/\n+$/, "");
      const cls = (child.querySelector("code")?.className || "");
      const lang = (cls.match(/language-([\w+-]+)/) || [, ""])[1];
      if (code.trim()) md += "```" + lang + "\n" + code + "\n```\n\n";
    } else if (tag === "BLOCKQUOTE") {
      const inner = blocks(child, opts, depth).trim();
      if (inner) md += inner.split("\n").map(l => "> " + l).join("\n") + "\n\n";
    } else if (tag === "UL" || tag === "OL") {
      const ordered = tag === "OL";
      let index = 1;
      for (const li of child.children) {
        if (li.tagName !== "LI") continue;
        const nested = Array.from(li.children).filter(c => c.tagName === "UL" || c.tagName === "OL");
        const copy = li.cloneNode(true);
        for (const n of Array.from(copy.children)) {
          if (n.tagName === "UL" || n.tagName === "OL") n.remove();
        }
        const text = inline(copy, opts).trim();
        const bullet = ordered ? `${index++}. ` : "- ";
        if (text) md += "  ".repeat(depth) + bullet + text + "\n";
        for (const n of nested) md += blocks({ childNodes: [n] }, opts, depth + 1);
      }
      if (depth === 0) md += "\n";
    } else if (tag === "TABLE") {
      if (opts.tables) {
        const table = tableToMarkdown(child, opts);
        if (table) md += table + "\n";
      }
    } else if (tag === "HR") {
      md += "---\n\n";
    } else if (tag === "IMG") {
      if (opts.images) {
        const src = child.getAttribute("src");
        if (src) md += `![${child.getAttribute("alt") || ""}](${absolute(src)})\n\n`;
      }
    } else {
      md += blocks(child, opts, depth);
    }
  }
  return md;
}

/** A line of nothing but brackets or punctuation is always debris. */
const PUNCT_ONLY = /^[\s\[\]()<>|*_~`.,;:!?-]+$/;

function tidy(md) {
  return md
    .split("\n")
    .filter(line => !PUNCT_ONLY.test(line) || line.trim() === "" || line.trim() === "---")
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/^\s+|\s+$/g, "") + "\n";
}

/** Rough token estimate — good enough to warn before a costly paste. */
function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

function convert(opts) {
  const selection = window.getSelection();
  const hasSelection = selection && selection.toString().trim().length > 40;

  let md;
  let mode = "article";

  if (opts.selectionOnly && hasSelection) {
    const wrapper = document.createElement("div");
    wrapper.appendChild(selection.getRangeAt(0).cloneContents());
    md = tidy(blocks(wrapper, opts));
    mode = "selection";
  } else {
    const main = findMainContent(document);
    const article = tidy(blocks(cleanClone(main), opts));
    const pageLength = bodyTextLength(document);

    // Two independent signals, because either alone misses cases. Coverage
    // catches a homepage where one story was picked out of forty. Structure
    // catches an index page that is tidy enough to score as a single block:
    // many linked headings with very little prose between them.
    const coversPage = pageLength > 0 ? article.length / pageLength : 1;
    const linkedHeadings = document.querySelectorAll(
      "h1 a[href], h2 a[href], h3 a[href], h4 a[href]").length;
    const paragraphs = main ? main.querySelectorAll("p").length : 0;
    const looksLikeIndex = linkedHeadings >= 6 && paragraphs <= linkedHeadings * 1.5;

    let headlines = [];
    if (coversPage < 0.25 || looksLikeIndex) headlines = collectHeadlines(document);

    if (headlines.length >= 5) {
      mode = "listing";
      md = headlines.map(h => {
        const line = h.url && opts.links ? `- [${h.title}](${h.url})` : `- ${h.title}`;
        return h.summary ? `${line}\n  ${h.summary}` : line;
      }).join("\n");
      md = tidy(`# ${document.title}\n\n${md}`);
    } else {
      md = article;
    }
  }
  if (opts.frontMatter) {
    const title = document.title.replace(/"/g, '\\"');
    md = `---\ntitle: "${title}"\nsource: ${location.href}\ncaptured: ${new Date().toISOString().slice(0, 10)}\n---\n\n${md}`;
  }
  return {
    markdown: md,
    mode,
    title: document.title,
    url: location.href,
    chars: md.length,
    tokens: estimateTokens(md),
    usedSelection: Boolean(opts.selectionOnly && hasSelection),
  };
}
