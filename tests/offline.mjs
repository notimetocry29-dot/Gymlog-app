// اختبار الأوفلاين والتحديث: سيرفر محلي صغير (جوه الاختبار نفسه) → التطبيق يفتح والـ service worker يتثبت
// → النت يقطع → إعادة تحميل والتطبيق لسه بيترسم → sw.js جديد (BUILD أكبر) → زرار التحديث يظهر مرة واحدة
// → الضغط عليه يحمّل النسخة الجديدة مرة واحدة والزرار يختفي (مفيش لفّ).
// node tests/offline.mjs   (CHROME_PATH اختياري لو عايز Chrome بتاع النظام)
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join, normalize, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

let chromium;
try { ({ chromium } = await import('playwright')); }
catch (e) { ({ chromium } = createRequire(import.meta.url)('playwright')); }   // playwright متسطّب global (NODE_PATH)

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.md': 'text/markdown; charset=utf-8' };

// السيرفر: down = النت مقطوع (بيقفل الاتصال)، swBuild = نسخة sw.js اللي بتتقدّم (تحديث جديد)
const srv = { down: false, swBuild: null, swHits: 0 };
const server = createServer(async (req, res) => {
  if (srv.down) { req.socket.destroy(); return; }
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const f = normalize(join(ROOT, p));
    if (!f.startsWith(ROOT + sep) || f.includes(sep + '.git' + sep)) { res.writeHead(403).end(); return; }
    let body = await readFile(f);
    if (p === '/sw.js') { srv.swHits++; if (srv.swBuild) body = Buffer.from(body.toString('utf8').replace(/const BUILD='\d+'/, `const BUILD='${srv.swBuild}'`)); }
    res.writeHead(200, { 'Content-Type': TYPES[extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }).end(body);
  } catch (e) { res.writeHead(404).end('not found'); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const URL0 = `http://localhost:${server.address().port}/`;

let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const br = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH, args: ['--no-sandbox'] } : {});
try {
  const ctx = await br.newContext({ viewport: { width: 393, height: 800 }, isMobile: true, hasTouch: true });
  // نتخطى شاشة البداية (splash) عشان الاختبار مايستناش
  await ctx.addInitScript(() => { try { localStorage.setItem('gl_seen', Date.now()); } catch (e) {} });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('dialog', d => { errs.push('native dialog'); d.dismiss(); });
  let navs = 0; pg.on('load', () => navs++);   // تحميلات كاملة للصفحة بس (مش pushState)
  const rendered = () => pg.evaluate(() => { const v = document.querySelector('#view'); return !!v && v.children.length > 0 && v.textContent.trim().length > 0; });
  const updVisible = () => pg.evaluate(() => { const u = document.querySelector('#updBtn'); return !!u && !u.hidden && getComputedStyle(u).display !== 'none'; });
  const swBuild = () => pg.evaluate(async () => { const c = await caches.keys(); return c.filter(k => k.startsWith('gym-v')).map(k => k.slice(5)).sort(); });

  // 1) أول فتحة أونلاين: الـ service worker يتثبت ويتحكم في الصفحة
  await pg.goto(URL0);
  await pg.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller && navigator.serviceWorker.controller.state === 'activated', null, { timeout: 20000 });
  const build0 = await pg.evaluate(() => VER);
  ok(await rendered(), 'app renders online');
  ok((await swBuild()).join() === build0, `service worker active with cache gym-v${build0}`);
  ok(!(await updVisible()), 'no update button on first install');

  // 2) أوفلاين: إعادة التحميل لازم تشتغل من الكاش
  srv.down = true; await ctx.setOffline(true);
  await pg.reload(); await pg.waitForTimeout(1200);
  ok(await rendered(), 'app still renders after going offline and reloading (#view not empty)');
  ok(await pg.evaluate(() => typeof VER === 'string' && typeof S === 'object'), 'app scripts ran offline (served from the SW cache)');
  ok(!(await updVisible()), 'no update button while offline');

  // 3) نسخة جديدة على السيرفر: sw.js بـ BUILD أكبر → زرار التحديث يظهر (من غير reload تلقائي)
  srv.down = false; await ctx.setOffline(false);
  const next = String(+build0 + 1); srv.swBuild = next;
  const navsBefore = navs;
  await pg.reload();
  await pg.waitForFunction(() => { const u = document.querySelector('#updBtn'); return u && !u.hidden; }, null, { timeout: 20000 }).catch(() => {});
  ok(await updVisible(), `update button appears when sw.js BUILD changes (${build0} → ${next})`);
  ok(await pg.evaluate(() => document.querySelectorAll('#updBtn:not([hidden])').length === 1), 'exactly one update button');
  await pg.waitForTimeout(1500);
  ok(navs === navsBefore + 1, 'the page did not reload by itself while the update waits');

  // 4) الضغط على «تحديث»: إعادة تحميل واحدة بس، والنسخة الجديدة هي اللي شغالة، والزرار مايرجعش
  const navsClick = navs;
  // أول فتحة بتفتح نافذة الترحيب فوق الصفحة، فبنضغط الزرار من جوه الصفحة
  await pg.evaluate(() => document.querySelector('#updBtn').click());
  await pg.waitForTimeout(2500);
  ok(navs === navsClick + 1, `tapping update reloads exactly once (navigations: ${navs - navsClick})`);
  ok((await swBuild()).join() === next, `new cache gym-v${next} active and old cache removed`);
  ok(!(await updVisible()), 'update button gone after updating (shown only once)');
  await pg.reload(); await pg.waitForTimeout(1200);
  ok(!(await updVisible()) && await rendered(), 'no update prompt again on the next launch');

  ok(errs.length === 0, 'no page errors ' + errs.join(';'));
  await ctx.close();
} catch (e) { console.log('FAIL ' + (e && e.stack || e)); fail++; }
finally { await br.close(); server.close(); }
console.log(fail ? `\n${fail} failed` : '\nall offline/update checks passed');
process.exit(fail ? 1 : 0);
