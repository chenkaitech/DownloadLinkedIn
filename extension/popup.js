const pageEl = document.getElementById('page');
const t = (key) => chrome.i18n.getMessage(key);

document.documentElement.lang = chrome.i18n.getUILanguage();
for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);

function empty(text) {
  pageEl.innerHTML = '';
  const d = document.createElement('div');
  d.className = 'empty';
  d.textContent = text;
  pageEl.appendChild(d);
}

function row({ label, poster, url, filename }) {
  const div = document.createElement('div');
  div.className = 'item';
  if (poster) {
    const img = document.createElement('img');
    img.src = poster;
    div.appendChild(img);
  }
  const name = document.createElement('div');
  name.className = 'name';
  name.textContent = label;
  name.title = url || '';
  const btn = document.createElement('button');
  btn.textContent = t('popupDownload');
  btn.disabled = !url;
  btn.onclick = async () => {
    btn.disabled = true;
    btn.textContent = '…';
    const res = await chrome.runtime.sendMessage({ type: 'download', url, filename });
    btn.textContent = res?.ok ? '✓' : t('popupFailed');
    if (!res?.ok) btn.title = res?.error || '';
  };
  div.append(name, btn);
  pageEl.appendChild(div);
}

(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !/^https:\/\/www\.linkedin\.com\//.test(tab.url || '')) return empty(t('popupNotLinkedIn'));
  empty(t('popupResolving'));
  let videos;
  try {
    videos = await chrome.tabs.sendMessage(tab.id, { type: 'listVideos' });
  } catch {
    return empty(t('popupNoContentScript'));
  }
  if (!videos.length) return empty(t('popupNoVideos'));
  pageEl.innerHTML = '';
  videos.forEach((v, i) =>
    row({ label: `${i + 1}. ${v.url ? v.filename : t('errNoMp4')}`, poster: v.poster, url: v.url, filename: v.filename })
  );
})();
