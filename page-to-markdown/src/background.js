chrome.commands.onCommand.addListener(async command => {
  if (command !== "copy-markdown") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !/^https?:/.test(tab.url || "")) return;

  const opts = await chrome.storage.sync.get(
    { selectionOnly: false, links: false, images: false, tables: true, frontMatter: false });

  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["src/extract.js"] });
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: o => convert(o),
    args: [opts],
  });
  if (!result) return;

  // The clipboard API needs a document, so write from the page itself.
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: text => navigator.clipboard.writeText(text),
    args: [result.markdown],
  });
});
