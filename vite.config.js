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
          source: `const CACHE='gym-log-${revision}';const FILES=${JSON.stringify(files)};self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting())));self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(names=>Promise.all(names.filter(n=>n.startsWith('gym-log-')&&n!==CACHE).map(n=>caches.delete(n)))).then(()=>self.clients.claim())));self.addEventListener('fetch',event=>{if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;event.respondWith(caches.open(CACHE).then(async cache=>{const cached=await cache.match(event.request,{ignoreSearch:true});if(cached)return cached;const response=await fetch(event.request);if(response.ok&&event.request.url.startsWith(new URL('exercise-media/',self.registration.scope).href)){try{await cache.put(event.request,response.clone());}catch{/* A full cache must not prevent viewing an online image. */}}return response;}));});self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(windows=>{const app=windows.find(client=>client.url.startsWith(self.registration.scope));return app?app.focus():self.clients.openWindow(self.registration.scope);}));});`,
        });
      },
    },
  ],
});
