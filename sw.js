// رقم النسخة: لازم يتغير هنا وفي app.js (const VER) مع كل إصدار — تغييره هنا هو اللي بيخلّي المتصفح يلاقي النسخة الجديدة
const BUILD='148';
const C='gym-v'+BUILD;
// كل ملف التطبيق محتاجه بيتحمّل وقت التثبيت؛ لو أي ملف ناقص التثبيت بيفشل (addAll بيرفض) بدل ما يشتغل نص نص
const FILES=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png','./icon-maskable-192.png','./icon-maskable-512.png','./apple-touch-icon.png','./favicon-48.png','./quotes.js','./guide.js','./exlib.js','./i18n.js','./app.js','./app.css','./theme.js','./splash.js','./privacy.html','./fonts/ruqaa.woff2','./fonts/figtree.woff2','./fonts/readex-400.woff2','./fonts/readex-600.woff2'];
// النسخة الجديدة بتستنى: التطبيق بيظهر زرار «تحديث جديد جاهز» وانت اللي تدوس (مفيش إعادة تحميل في نص التمرين)
self.addEventListener('install',e=>e.waitUntil(caches.open(C).then(c=>c.addAll(FILES.map(f=>new Request(f,{cache:'reload'}))))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('gym-')&&k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('message',e=>{if(e.data==='skip')self.skipWaiting()});
// v114: كل نسخة ثابتة في الكاش بتاعها (مفيش تحديث صامت للملفات). النسخة الجديدة بتيجي بس من sw.js جديد وزرار «تحديث»
self.addEventListener('fetch',e=>{
  const r=e.request;
  if(r.method!=='GET'||new URL(r.url).origin!==location.origin)return;
  if(r.mode==='navigate'){
    e.respondWith(caches.open(C).then(c=>c.match(r,{ignoreSearch:true}).then(h=>h||(new URL(r.url).pathname.endsWith('/')?c.match('./index.html'):null))).then(h=>h||fetch(r).catch(()=>caches.match('./index.html'))));
    return;
  }
  e.respondWith(caches.open(C).then(c=>c.match(r,{ignoreSearch:true})).then(h=>h||fetch(r)));
});
