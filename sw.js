/* My Dictionary – service worker (offline)
   index.html だけで完結するアプリ（アイコンは base64、マニフェストは実行時生成）なので、
   持っておくのは入口の 1 枚だけでよい。 */

var CACHE = "mydict-v2";
var SHELL = "./index.html";

self.addEventListener("install", function(e){
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function(c){
      return c.addAll(["./", SHELL]).catch(function(){});
    })
  );
});

self.addEventListener("activate", function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){
        if(k !== CACHE) return caches.delete(k);
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});

/* network first：更新があれば取り込み、オフラインならキャッシュを返す */
self.addEventListener("fetch", function(e){
  var req = e.request;
  if(req.method !== "GET") return;
  if(new URL(req.url).origin !== location.origin) return;

  /* 同期はGitHubへの通信そのものなので、キャッシュに逃がしても意味がない。
     ここで触らず、失敗はアプリ側のtoastに任せる。 */

  e.respondWith(
    fetch(req).then(function(res){
      // 404 や 500 を貯めると、オフラインのときにそれが返ってしまう
      if(res && res.ok && res.type === "basic"){
        var copy = res.clone();
        caches.open(CACHE).then(function(c){ c.put(req, copy); });
      }
      return res;
    }).catch(function(){
      return caches.match(req).then(function(hit){
        if(hit) return hit;
        // ページを開こうとしたときだけ入口の1枚に逃がす。
        // 画像やJSONにHTMLを返すと、かえって分かりにくい壊れ方をする。
        if(req.mode === "navigate") return caches.match(SHELL);
        return Response.error();
      });
    })
  );
});
