// رقم النسخة: لازم يتغير هنا وفي index.html (const VER) مع كل إصدار — تغييره هنا هو اللي بيخلّي المتصفح يلاقي النسخة الجديدة
const BUILD='109';
const C='gym-v'+BUILD;
// كل ملف التطبيق محتاجه بيتحمّل وقت التثبيت؛ لو أي ملف ناقص التثبيت بيفشل (addAll بيرفض) بدل ما يشتغل نص نص
const FILES=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png','./icon-maskable-192.png','./icon-maskable-512.png','./apple-touch-icon.png','./favicon-48.png','./quotes.js','./exlib.js','./fonts/ruqaa.woff2','./fonts/figtree.woff2'];
// النسخة الجديدة بتستنى: التطبيق بيظهر زرار «تحديث جديد جاهز» وانت اللي تدوس (مفيش إعادة تحميل في نص التمرين)
self.addEventListener('install',e=>e.waitUntil(caches.open(C).then(c=>c.addAll(FILES.map(f=>new Request(f,{cache:'reload'}))))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('gym-')&&k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('message',e=>{if(e.data==='skip')self.skipWaiting()});
self.addEventListener('fetch',e=>{
  const r=e.request;
  if(r.method!=='GET'||new URL(r.url).origin!==location.origin)return;
  // تحديث في الخلفية: بنجيب النسخة الأحدث ونحطها في الكاش للفتحة الجاية
  const reval=()=>fetch(r).then(res=>{if(res&&res.ok){const cp=res.clone();caches.open(C).then(c=>c.put(r,cp))}return res});
  // الصفحة: الكاش الأول (بتفتح فورًا وأوفلاين) وindex.html احتياطي
  if(r.mode==='navigate'){
    e.respondWith(caches.match(r,{ignoreSearch:true}).then(h=>h||caches.match('./index.html')).then(h=>{
      if(h){reval().catch(()=>{});return h}
      return reval().catch(()=>caches.match('./index.html'));
    }));
    return;
  }
  // باقي الملفات: الكاش الأول + تحديث في الخلفية
  e.respondWith(caches.match(r,{ignoreSearch:true}).then(h=>{const n=reval().catch(()=>h);return h||n}));
});
