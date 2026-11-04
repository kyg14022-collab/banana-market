/* 반아나 마켓 홈 화면 앱용 서비스 워커.
   아무것도 저장(캐시)하지 않습니다 — 매물은 항상 서버에서 새로 불러옵니다.
   사이트 화면 파일(html·js·css)은 휴대폰에 남아 있는 예전 사본을 쓰지 않고
   매번 서버에 "바뀐 게 있는지" 확인한 뒤 열어서, 수정한 내용이 바로 보이게 합니다. */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function (e) {
  var r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== self.location.origin) return;
  e.respondWith(fetch(r, { cache: 'no-cache' }).catch(function () { return fetch(r); }));
});
