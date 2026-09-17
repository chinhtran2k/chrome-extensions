# Chrome Web Store listing

Copy these fields straight into the developer dashboard.

## Name (45 char max)
```
Page to Markdown — Clean Copy for AI
```

## Short description (132 char max)
```
Copy any web page as clean Markdown, without menus, ads or footers. Built for pasting into ChatGPT, Claude and other AI tools.
```

## Category
`Productivity` → `Workflow & Planning`

## Detailed description
```
Pasting a web page into an AI tool usually means pasting its navigation, cookie
banner, sidebar and footer too. That wastes tokens and gives the model text you
never wanted it to read.

Page to Markdown finds the article on the page and converts only that, into
clean Markdown.

MEASURED ON REAL PAGES, WITH THE DEFAULT SETTINGS
• A Wikipedia article: 249,097 characters of HTML became 16,019 of Markdown — 94% smaller
• A long blog post: 131,975 characters became 20,533 — 84% smaller

WORKS ON TWO KINDS OF PAGE
• On an article, it converts the article
• On a homepage or index, it returns every headline with its link and summary,
  instead of picking one story and silently dropping the rest

WHAT YOU GET
• One click to copy, or save as a .md file
• Headings, lists, tables, links and code blocks kept intact
• Code fences keep their language, so syntax highlighting survives
• A live token estimate, so you know the cost before you paste
• Optional front matter with the title, source URL and date

OPTIONS
• Convert only the selected text
• Keep or drop links, images and tables
• Keyboard shortcut: Ctrl+Shift+M (Cmd+Shift+M on Mac)

PRIVACY
Everything happens inside your browser. The extension has no server, sends no
data anywhere, and has no analytics. It cannot read a page until you click the
button, because it asks only for the "activeTab" permission — not access to
every site you visit.

FREE
No account, no sign-up, no limits.
```

## Privacy practices (required)

Single purpose:
```
Converts the content of the current web page into Markdown text for the user to
copy or download.
```

Permission justifications:
- **activeTab** — `Reads the current page only when the user clicks the extension button, in order to convert it.`
- **scripting** — `Runs the conversion code inside the page the user asked to convert.`
- **storage** — `Remembers the user's own option choices between sessions.`

Data collection: **none of the listed categories.**
Remote code: **no** — everything ships inside the package.

## Screenshots needed (1280x800)
1. The popup open beside a converted article
2. The Markdown result pasted into an AI chat
3. The options, with the token counter visible

## Notes
Permissions are deliberately minimal. Google's documentation says Manifest V3
extensions asking only for `activeTab` clear automated review in minutes, while
broad host permissions get routed to human review that can take weeks.
