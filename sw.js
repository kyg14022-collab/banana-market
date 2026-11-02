/* 반아나 마켓 홈 화면 앱용 서비스 워커.
   아무것도 저장(캐시)하지 않습니다 — 매물은 항상 서버에서 새로 불러옵니다. */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function () {});
