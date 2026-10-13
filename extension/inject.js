// 运行在页面 MAIN world。LinkedIn 新版播放器（video.js + MSE）在 React 组件的
// props.playerParams.playlist[].sources 里同时带有 HLS 和完整 MP4（mp4-720p-... ）地址。
// 内容脚本运行在隔离环境，读不到 React 的内部属性，所以由这里读取后通过 postMessage 回传。
(() => {
  const VID = '/playlist/vid/';

  function fiberOf(el) {
    for (; el; el = el.parentElement) {
      const key = Object.keys(el).find((k) => k.startsWith('__reactFiber$'));
      if (key) return el[key];
    }
    return null;
  }

  function sourcesFromProps(props) {
    const pl = props?.playerParams?.playlist || props?.playlist;
    if (!Array.isArray(pl)) return null;
    const list = pl.flatMap((item) => item?.sources || []).filter((s) => typeof s?.src === 'string');
    return list.length ? list : null;
  }

  // 兜底：在 props 中浅层搜索包含视频地址的 {src} 对象
  function deepFind(obj, depth, out, seen) {
    if (!obj || typeof obj !== 'object' || depth > 5 || seen.has(obj) || obj instanceof Node) return;
    seen.add(obj);
    if (typeof obj.src === 'string' && obj.src.includes(VID)) out.push({ src: obj.src, type: obj.type });
    for (const k of Object.keys(obj)) {
      if (k === 'children' || k.startsWith('_')) continue;
      let v;
      try {
        v = obj[k];
      } catch {
        continue;
      }
      if (v && typeof v === 'object') deepFind(v, depth + 1, out, seen);
    }
  }

  function findSources(video) {
    let f = fiberOf(video);
    for (let i = 0; f && i < 40; i++, f = f.return) {
      const s = sourcesFromProps(f.memoizedProps);
      if (s) return s;
    }
    f = fiberOf(video);
    const out = [];
    const seen = new WeakSet();
    for (let i = 0; f && i < 40 && !out.length; i++, f = f.return) deepFind(f.memoizedProps, 0, out, seen);
    return out;
  }

  window.addEventListener('message', (e) => {
    if (e.source !== window || e.data?.__lvd !== 1 || e.data.kind !== 'resolve') return;
    const { token } = e.data;
    const video = document.querySelector(`video[data-lvd-req="${token}"]`);
    let sources = [];
    try {
      if (video) sources = findSources(video).map((s) => ({ src: s.src, type: s.type || '' }));
    } catch {}
    window.postMessage({ __lvd: 1, kind: 'resolved', token, sources }, location.origin);
  });
})();
