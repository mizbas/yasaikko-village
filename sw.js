// やさいっこ冒険村 Service Worker
// ネット優先：つながっていれば毎回最新版を取りに行き、オフラインのときだけ保存した版を使う。
const VERSION = '20261105121008';
const CACHE = 'yasaikko-village-' + VERSION;
const CORE = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('yasaikko-village-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const font = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!sameOrigin && !font) return;
  if (sameOrigin && url.pathname.endsWith('version.json')) return; // 版の確認は常にサーバーへ

  if (font) {
    // フォントはほぼ変わらないので、保存した版をすぐ使い、裏で更新する
    e.respondWith(caches.open(CACHE).then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(r => { if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }

  // ゲーム本体：ネット優先（キャッシュを通さず取りに行く）、だめなら保存した版
  e.respondWith(
    fetch(req, { cache: 'no-store' })
      .then(r => {
        if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return r;
      })
      .catch(async () => (await caches.match(req)) || (req.mode === 'navigate' ? caches.match('./index.html') : undefined))
  );
});
