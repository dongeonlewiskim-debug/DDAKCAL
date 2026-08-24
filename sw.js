// DDAKCAL 서비스워커 — 오프라인 구동 + 앱 설치
// index.html이 크게 바뀌면 이 숫자를 올릴 것 — 안 올리면 오프라인일 때 옛 버전이 계속 나옴
const CACHE = "ddakcal-v4";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./logo.png"
];

// 설치: 핵심 파일 캐시
self.addEventListener("install", (e)=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
  self.skipWaiting();
});

// 활성화: 옛 캐시 정리
self.addEventListener("activate", (e)=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(
      keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))
    ))
  );
  self.clients.claim();
});

// 요청 처리:
//  - Firebase/구글 등 외부 API는 항상 네트워크 (캐시하지 않음)
//  - 그 외 앱 파일은 네트워크 우선, 실패 시 캐시(오프라인)
self.addEventListener("fetch", (e)=>{
  const req = e.request;
  if(req.method !== "GET"){ return; }

  const url = new URL(req.url);
  const isApi = /(googleapis\.com|firebaseio\.com|gstatic\.com|google\.com)/.test(url.hostname);
  if(isApi){ return; } // 브라우저 기본 처리(항상 네트워크)

  e.respondWith(
    fetch(req)
      .then(res=>{
        const copy = res.clone();
        caches.open(CACHE).then(c=>c.put(req, copy)).catch(()=>{});
        return res;
      })
      .catch(()=> caches.match(req).then(hit=> hit || caches.match("./index.html")))
  );
});
