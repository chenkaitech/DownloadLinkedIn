const pageEl = document.getElementById('page');

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
  btn.textContent = '下载';
  btn.disabled = !url;
  btn.onclick = async () => {
    btn.disabled = true;
    btn.textContent = '…';
    const res = await chrome.runtime.sendMessage({ type: 'download', url, filename });
    btn.textContent = res?.ok ? '✓' : '失败';
    if (!res?.ok) btn.title = res?.error || '';
  };
  div.append(name, btn);
  pageEl.appendChild(div);
}

(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !/^https:\/\/www\.linkedin\.com\//.test(tab.url || '')) return empty('请在 LinkedIn 页面中使用。');
  empty('解析中…');
  let videos;
  try {
    videos = await chrome.tabs.sendMessage(tab.id, { type: 'listVideos' });
  } catch {
    return empty('内容脚本未加载，请刷新页面后重试。');
  }
  if (!videos.length) return empty('当前页面没有已加载的视频，请滚动到视频处。');
  pageEl.innerHTML = '';
  videos.forEach((v, i) =>
    row({ label: `${i + 1}. ${v.url ? v.filename : '未找到 MP4 地址'}`, poster: v.poster, url: v.url, filename: v.filename })
  );
})();
