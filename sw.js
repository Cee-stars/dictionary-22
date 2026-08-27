/* My Dictionary – service worker (offline)
   index.html だけで完結するアプリ（アイコンは base64、マニフェストは実行時生成）なので、
   持っておくのは入口の 1 枚だけでよい。 */

var CACHE = "mydict-v3";
var SHELL = "./index.html";

self.addEventListener("install", function(e){
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function(c){
      /* addAll はブラウザのHTTPキャッシュを通るので、古い1枚が残っていると
         それをそのまま貯め込んでしまう。入口だけは必ず取り直す。 */
      return Promise.all(["./", SHELL].map(function(u){
        return fetch(u, {cache:"reload"}).then(function(r){
          return (r && r.ok) ? c.put(u, r) : null;
        }).catch(function(){});
      }));
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

  /* 入口の1枚はブラウザのHTTPキャッシュを飛ばして取り直す。
     GitHub Pages は10分ぶん持たせる指示を付けて返すので、そのままだと
     更新したのに古い画面が開く（サーバーは新しいのに、手元が入れ替わらない）。 */
  var fromNet = (req.mode === "navigate")
    ? fetch(req.url, {cache:"reload", credentials:"same-origin"})
    : fetch(req);

  e.respondWith(
    fromNet.then(function(res){
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
