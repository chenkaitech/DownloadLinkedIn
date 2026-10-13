(() => {
  const BTN_CLASS = 'lvd-download-btn';
  const MARK = 'lvdAttached';

  function assetIdOf(url) {
    const m = url.match(/\/playlist\/vid\/(?:v\d+\/|dynamic\/)?([A-Za-z0-9_-]{10,})\//);
    return m ? m[1] : null;
  }

  // 完整的 progressive MP4，路径形如 .../mp4-720p-30fp-crf28/...
  function isProgressive(url) {
    const path = url.split('?')[0];
    if (/m4s|m3u8|mpd|\/hls|\/dash|\/dynamic\//i.test(path)) return false;
    return /\/mp4-|\.mp4$/i.test(path);
  }

  function heightOf(url) {
    return Number((url.match(/mp4-(\d{3,4})p/) || [])[1] || 0);
  }

  function pickBest(urls) {
    return urls.filter((u) => u && /^https?:/i.test(u) && isProgressive(u)).sort((a, b) => heightOf(b) - heightOf(a))[0] || null;
  }

  // 旧版播放器直接把地址写在 <video> 上
  function directSources(video) {
    const list = [];
    const ds = video.getAttribute('data-sources');
    if (ds) {
      try {
        for (const s of JSON.parse(ds)) if (s?.src) list.push(s.src);
      } catch {}
    }
    for (const s of video.querySelectorAll('source')) list.push(s.src);
    list.push(video.currentSrc, video.src);
    return list;
  }

  // 请求 inject.js（MAIN world）从 React props 中读取播放器的 sources
  let seq = 0;
  function reactSources(video) {
    const token = `lvd${Date.now()}_${seq++}`;
    video.dataset.lvdReq = token;
    return new Promise((resolve) => {
      const timer = setTimeout(done, 2000, []);
      function done(sources) {
        clearTimeout(timer);
        window.removeEventListener('message', onMsg);
        delete video.dataset.lvdReq;
        resolve(sources);
      }
      function onMsg(e) {
        if (e.source === window && e.data?.__lvd === 1 && e.data.kind === 'resolved' && e.data.token === token) {
          done(e.data.sources.map((s) => s.src));
        }
      }
      window.addEventListener('message', onMsg);
      window.postMessage({ __lvd: 1, kind: 'resolve', token }, location.origin);
    });
  }

  async function resolveUrl(video) {
    return pickBest(directSources(video)) || pickBest(await reactSources(video));
  }

  function buildFilename(url) {
    const q = heightOf(url);
    return ['linkedin', assetIdOf(url) || Date.now(), q ? `${q}p` : ''].filter(Boolean).join('_');
  }

  function setState(btn, text, cls) {
    btn.textContent = text;
    btn.classList.remove('lvd-busy', 'lvd-ok', 'lvd-err');
    if (cls) btn.classList.add(cls);
  }

  async function onClick(e, video, btn) {
    e.preventDefault();
    e.stopPropagation();
    if (btn.classList.contains('lvd-busy')) return;
    setState(btn, '⏳ 解析中', 'lvd-busy');
    try {
      const url = await resolveUrl(video);
      if (!url) throw new Error('未找到完整 MP4 地址');
      const res = await chrome.runtime.sendMessage({ type: 'download', url, filename: buildFilename(url) });
      if (!res?.ok) throw new Error(res?.error || '下载失败');
      setState(btn, '✓ 已开始下载', 'lvd-ok');
    } catch (err) {
      console.warn('[LinkedIn Video Downloader]', err);
      setState(btn, '✗ ' + (err.message || '失败'), 'lvd-err');
    }
    setTimeout(() => setState(btn, '⬇ 下载视频'), 3000);
  }

  function attach(video) {
    if (video.dataset[MARK]) return;
    const host = video.closest('.video-js') || video.parentElement;
    if (!host) return;
    video.dataset[MARK] = '1';
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = BTN_CLASS;
    btn.textContent = '⬇ 下载视频';
    btn.title = '下载此视频 (LinkedIn Video Downloader)';
    // 阻止事件冒泡到播放器，避免点击按钮时触发暂停/播放
    for (const ev of ['mousedown', 'mouseup', 'pointerdown', 'pointerup', 'touchstart']) {
      btn.addEventListener(ev, (e) => e.stopPropagation());
    }
    btn.addEventListener('click', (e) => onClick(e, video, btn));
    host.appendChild(btn);
  }

  function scan() {
    document.querySelectorAll('video').forEach(attach);
  }

  let pending = false;
  new MutationObserver(() => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      scan();
    });
  }).observe(document.documentElement, { childList: true, subtree: true });
  scan();

  // 供 popup 查询页面中的视频
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type !== 'listVideos') return;
    (async () => {
      const videos = [];
      for (const v of document.querySelectorAll('video')) {
        const url = await resolveUrl(v).catch(() => null);
        videos.push({ url, filename: url ? buildFilename(url) : '', poster: v.poster || '' });
      }
      sendResponse(videos);
    })();
    return true;
  });
})();
