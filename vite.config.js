import { defineConfig } from "vite";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
export default defineConfig({
  plugins: [
    {
      name: "offline-app",
      generateBundle(_, bundle) {
        const assets = Object.keys(bundle).filter((n) =>
          n.startsWith("assets/"),
        );
        const publicFiles = [
          "manifest.webmanifest",
          "app-shell.js",
          "icon.svg",
          "icon-192.png",
          "icon-512.png",
          "icon-maskable-512.png",
          "apple-touch-icon.png",
        ];
        const revision = createHash("sha256")
          .update(assets.join(","))
          .update(
            Buffer.concat(
              publicFiles.map((name) =>
                readFileSync(new URL("./public/" + name, import.meta.url)),
              ),
            ),
          )
          .digest("hex")
          .slice(0, 12);
        const files = [
          "./",
          "./index.html",
          ...publicFiles.map((name) => "./" + name),
          ...assets.map((n) => "./" + n),
        ];
        this.emitFile({
          type: "asset",
          fileName: "sw.js",
          source: `const CACHE='gym-log-${revision}';const FILES=${JSON.stringify(files)};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(names=>{const older=names.filter(n=>n.startsWith('gym-log-')&&n!==CACHE);return Promise.all(older.slice(0,-1).map(n=>caches.delete(n)));}).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url),scope=new URL(self.registration.scope);
 if(request.method!=='GET'||url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  // Prefer a matching online HTML shell; never indefinitely pin an old shell.
  if(request.mode==='navigate'){
   try{const response=await fetch(request,{cache:'no-cache'});if(response.ok)return response;}catch{}
   return (await cache.match('./index.html'))||Response.error();
  }
  const cached=await cache.match(request,{ignoreSearch:true});if(cached)return cached;
  // A tab opened before activation may still request the previous build's hash.
  if(url.pathname.startsWith(new URL('assets/',scope).pathname)){
   const names=await caches.keys();
   for(const name of names.filter(n=>n.startsWith('gym-log-')&&n!==CACHE)){
    const old=await (await caches.open(name)).match(request,{ignoreSearch:true});if(old)return old;
   }
  }
  const response=await fetch(request);
  if(response.ok&&request.url.startsWith(new URL('exercise-media/',scope).href)){
   try{await cache.put(request,response.clone());}catch{}
  }
  return response;
 })());
});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(windows=>{const app=windows.find(client=>client.url.startsWith(self.registration.scope));return app?app.focus():self.clients.openWindow(self.registration.scope);}));});`,
        });
      },
    },
  ],
});
