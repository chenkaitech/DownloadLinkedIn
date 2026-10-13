function sanitize(name) {
  return name.replace(/[\\/:*?"<>|\s]+/g, '_').replace(/_+/g, '_').slice(0, 120);
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== 'download') return;
  const name = sanitize(msg.filename || `linkedin-video-${Date.now()}`);
  chrome.downloads
    .download({ url: msg.url, filename: `LinkedIn/${name}.mp4`, conflictAction: 'uniquify', saveAs: false })
    .then((id) => sendResponse({ ok: true, id }))
    .catch((e) => sendResponse({ ok: false, error: String(e.message || e) }));
  return true;
});
