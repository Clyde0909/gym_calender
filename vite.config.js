import { defineConfig } from "vite";
import { createHash } from "node:crypto";
export default defineConfig({
  plugins: [
    {
      name: "offline-app",
      generateBundle(_, bundle) {
        const assets = Object.keys(bundle).filter((n) =>
          n.startsWith("assets/"),
        );
        const revision = createHash("sha256")
          .update(assets.join(","))
          .digest("hex")
          .slice(0, 12);
        const files = [
          "./",
          "./index.html",
          "./icon.svg",
          "./manifest.webmanifest",
          ...assets.map((n) => "./" + n),
        ];
        this.emitFile({
          type: "asset",
          fileName: "sw.js",
          source: `const CACHE='gym-log-${revision}';const FILES=${JSON.stringify(files)};self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting())));self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(names=>Promise.all(names.filter(n=>n.startsWith('gym-log-')&&n!==CACHE).map(n=>caches.delete(n)))).then(()=>self.clients.claim())));self.addEventListener('fetch',event=>{if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(event.request,{ignoreSearch:true}))||fetch(event.request)));});self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(windows=>{const app=windows.find(client=>client.url.startsWith(self.registration.scope));return app?app.focus():self.clients.openWindow(self.registration.scope);}));});`,
        });
      },
    },
  ],
});
