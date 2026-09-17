/**
 * Tests for the conversion engine.
 *
 * The thing that actually decides whether this extension is worth installing is
 * whether it drops page furniture. Most of these tests are about junk removal,
 * not about Markdown syntax.
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const CODE = fs.readFileSync(path.join(__dirname, "..", "src", "extract.js"), "utf8");
const OPTS = { selectionOnly: false, links: true, images: false, tables: true, frontMatter: false };

function convert(html, url = "https://example.com/post", opts = OPTS) {
  const dom = new JSDOM(html, { url });
  const { window } = dom;
  global.window = window; global.document = window.document; global.Node = window.Node;
  global.URL = window.URL; global.location = window.location;
  return new Function(CODE + "\nreturn convert;").call(window)(opts);
}

let failures = 0;
function check(name, fn) {
  try { fn(); console.log("PASS " + name); }
  catch (e) { failures++; console.log("FAIL " + name + " -> " + e.message); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

const ARTICLE = `<html><head><title>My Post</title></head><body>
  <nav class="site-nav"><a href="/a">Home</a><a href="/b">About</a></nav>
  <div class="cookie-consent">We use cookies <button>Accept</button></div>
  <aside class="sidebar"><a href="/r">Related posts</a></aside>
  <article>
    <h1>Real Title</h1>
    <p>Body text with <strong>bold</strong>, <em>italic</em> and a <a href="/x">link</a>.</p>
    <h2>Section</h2>
    <p>A second paragraph long enough that the scorer treats this as real content.</p>
    <ul><li>one</li><li>two</li></ul>
    <pre><code class="language-python">print("hi")</code></pre>
    <table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>
  </article>
  <footer class="footer">copyright 2026 <a href="/p">privacy policy</a></footer>
</body></html>`;

check("drops nav, cookie banner, sidebar and footer", () => {
  const md = convert(ARTICLE).markdown;
  for (const junk of ["Home", "About", "cookies", "Accept", "Related posts", "copyright", "privacy policy"]) {
    assert(!md.includes(junk), `leaked page furniture: ${junk}`);
  }
});

check("keeps headings, emphasis and links", () => {
  const md = convert(ARTICLE).markdown;
  assert(md.includes("# Real Title"), "missing h1");
  assert(md.includes("## Section"), "missing h2");
  assert(md.includes("**bold**") && md.includes("*italic*"), "missing emphasis");
  assert(md.includes("[link](https://example.com/x)"), "link not absolute");
});

check("keeps code blocks with their language", () => {
  const md = convert(ARTICLE).markdown;
  assert(md.includes("```python"), "code fence lost its language");
  assert(md.includes('print("hi")'), "code body lost");
});

check("keeps tables when asked, drops them when not", () => {
  assert(convert(ARTICLE).markdown.includes("| A | B |"), "table missing");
  const off = convert(ARTICLE, "https://example.com/post", { ...OPTS, tables: false });
  assert(!off.markdown.includes("| A | B |"), "table kept despite the option being off");
});

check("links can be turned off", () => {
  const md = convert(ARTICLE, "https://example.com/post", { ...OPTS, links: false }).markdown;
  assert(md.includes("link") && !md.includes("](https://"), "links not stripped");
});

check("front matter carries title and source", () => {
  const r = convert(ARTICLE, "https://example.com/post", { ...OPTS, frontMatter: true });
  assert(r.markdown.startsWith("---\ntitle: \"My Post\""), "front matter missing title");
  assert(r.markdown.includes("source: https://example.com/post"), "front matter missing source");
});

check("reports a token estimate that tracks length", () => {
  const r = convert(ARTICLE);
  assert(r.tokens > 0 && r.chars > 0, "no stats");
  assert(Math.abs(r.tokens - Math.ceil(r.chars / 4)) <= 1, "token estimate inconsistent");
});

check("a page that is mostly navigation still yields its article", () => {
  const html = `<html><head><title>T</title></head><body>
    <div class="nav"><a href="/1">L1</a><a href="/2">L2</a><a href="/3">L3</a></div>
    <div id="content"><p>${"Real sentence that carries the actual meaning. ".repeat(10)}</p></div>
  </body></html>`;
  const md = convert(html).markdown;
  assert(md.includes("Real sentence"), "article body lost");
  assert(!md.includes("L1"), "navigation leaked");
});

check("survives an empty or broken page without throwing", () => {
  assert(typeof convert("<html><body></body></html>").markdown === "string", "empty page threw");
  assert(typeof convert("<html><body><div>hi</div></body></html>").markdown === "string", "tiny page threw");
});

check("collapses runaway blank lines", () => {
  const html = `<html><head><title>T</title></head><body><article>
    <p>${"Long enough paragraph to score as content. ".repeat(6)}</p>
    <div></div><div></div><div></div>
    <p>${"Second paragraph also long enough to keep the scorer happy. ".repeat(6)}</p>
  </article></body></html>`;
  assert(!/\n{3,}/.test(convert(html).markdown), "three or more blank lines in a row");
});

check("citation markers do not leave stray brackets", () => {
  const html = `<html><head><title>T</title></head><body><article>
    <p>${"A sentence with enough words to score as real content. ".repeat(6)}
       <sup class="reference"><a href="#n1">[</a>n 2<a href="#n1">]</a></sup></p>
    <p>${"Another paragraph long enough to keep the scorer happy here. ".repeat(6)}</p>
  </article></body></html>`;
  const md = convert(html).markdown;
  assert(!/^\s*[\[\]]\s*$/m.test(md), "stray bracket line survived:\n" + md);
  assert(!md.includes("n 2"), "citation text survived");
  assert(md.includes("A sentence with enough words"), "body text lost");
});

check("a listing page returns every headline, not just the top story", () => {
  const item = (n) => `<article><h3><a href="/story-${n}">Headline number ${n} about something</a></h3>
    <p>A summary sentence for story ${n} that is long enough to be worth keeping around.</p></article>`;
  const html = `<html><head><title>News Home</title></head><body>
    <nav><a href="/">Home</a></nav>
    ${Array.from({ length: 12 }, (_, i) => item(i + 1)).join("")}
  </body></html>`;
  const r = convert(html, "https://news.example.com/");
  assert(r.mode === "listing", "listing page not detected, mode=" + r.mode);
  for (let n = 1; n <= 12; n++) {
    assert(r.markdown.includes(`Headline number ${n} `), `headline ${n} missing`);
  }
  assert(r.markdown.includes("](https://news.example.com/story-3)"), "headline link missing");
  assert(r.markdown.includes("A summary sentence for story 3"), "summary missing");
});

check("an article page is still handled as an article", () => {
  const r = convert(ARTICLE);
  assert(r.mode === "article", "article misdetected as " + r.mode);
  assert(r.markdown.includes("# Real Title"), "article body lost");
});

console.log();
console.log(failures ? `${failures} FAILED` : "ALL PASS");
process.exit(failures ? 1 : 0);
