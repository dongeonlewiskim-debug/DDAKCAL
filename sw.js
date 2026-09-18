// 앱 화면은 기기에 보관한다. 사용자 데이터·로그인 응답은 캐시하지 않는다.
const CACHE = "ddakcal-v13";
const ASSETS = ["./", "./index.html", "./manifest.json", "./logo.png"];
const SDK = [
  "https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth-compat.js",
  "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore-compat.js"
];
const localAssets = new Set(ASSETS.map(p=>new URL(p, self.location.href).href));

self.addEventListener("install", event=>{
  event.waitUntil((async ()=>{
    const cache = await caches.open(CACHE);
    await cache.addAll(ASSETS);
    await self.skipWaiting();
  })());
});
self.addEventListener("activate", event=>{
  event.waitUntil((async ()=>{
    const keys = await caches.keys();
    await Promise.all(keys.filter(k=>k.startsWith("ddakcal-") && k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});
async function networkOrCache(request){
  const cache = await caches.open(CACHE);
  const controller = new AbortController();
  const timer = setTimeout(()=>controller.abort(), 2000);
  try{
    const response = await fetch(request, {signal:controller.signal});
    // 이전 HTML의 일반 외부 script 요청은 opaque(status 0)여도 정상 응답일 수 있다.
    // 브라우저가 실행 여부를 판단하도록 전달하되 성공을 검증할 수 없어 캐시하지 않는다.
    if(response.type === "opaque") return response;
    if(!response.ok) throw new Error("앱 파일 응답 실패");
    try{ await cache.put(request, response.clone()); }catch(e){}
    return response;
  }catch(e){
    const cached = await cache.match(request);
    if(cached) return cached;
    if(request.mode === "navigate"){
      const shell = await cache.match("./index.html");
      if(shell) return shell;
    }
    return Response.error();
  }finally{ clearTimeout(timer); }
}
self.addEventListener("fetch", event=>{
  const request = event.request;
  if(request.method !== "GET") return;
  const url = new URL(request.url);
  // 버전이 고정된 공개 SDK만 캐시한다. 구글 로그인·Firestore API는 제외한다.
  if(SDK.includes(url.href)){
    event.respondWith((async ()=>{
      const cache = await caches.open(CACHE);
      return (await cache.match(request)) || networkOrCache(request);
    })());
    return;
  }
  if(url.origin !== self.location.origin) return;
  const canonical = new URL(url.href); canonical.search = ""; canonical.hash = "";
  if(!localAssets.has(canonical.href)) return;
  event.respondWith(networkOrCache(request));
});
