// فحص سريع للنسخة قبل النشر (من غير متصفح):
//  1) BUILD في sw.js لازم يساوي VER في app.js (وبنفس الشكل اللي android/app/build.gradle بيقراه)
//  2) كل ملف في FILES بتاعة sw.js موجود فعلًا (لو ناقص، تثبيت الـ service worker بيفشل كله)
//  3) لو ملف من اللي بيتخزنوا أوفلاين اتغيّر في آخر commit، sw.js لازم يتغير معاه (وإلا محدش هياخد التحديث)
// node tests/check-build.mjs            (CHECK_BASE=<rev> اختياري؛ الافتراضي HEAD~1)
import { readFileSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = f => readFileSync(join(ROOT, f), 'utf8');
let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const skip = m => console.log('SKIP ' + m);

// 1) رقم النسخة
const app = read('app.js'), sw = read('sw.js');
const grab = (src, name) => { const m = src.match(new RegExp(`const\\s+${name}\\s*=\\s*['"](\\d+)['"]`)); return m ? m[1] : null; };
const VER = grab(app, 'VER'), BUILD = grab(sw, 'BUILD');
ok(!!VER, `app.js has const VER='NNN' (read by android/app/build.gradle)${VER ? ' = ' + VER : ''}`);
ok(!!BUILD, `sw.js has const BUILD='NNN'${BUILD ? ' = ' + BUILD : ''}`);
ok(VER && BUILD && VER === BUILD, `sw.js BUILD (${BUILD}) == app.js VER (${VER})`);

// 2) ملفات الكاش
const fm = sw.match(/const\s+FILES\s*=\s*\[([\s\S]*?)\]/);
ok(!!fm, 'sw.js has a FILES array');
const FILES = fm ? [...fm[1].matchAll(/['"]([^'"]+)['"]/g)].map(m => m[1]) : [];
// './' = الصفحة الرئيسية (index.html)؛ أي query (?v=) مالهاش دعوة بالمسار
const toPath = f => { const p = normalize(f.replace(/[?#].*$/, '')).replace(/^\.\/?/, ''); return p === '' || p.endsWith('/') ? p + 'index.html' : p; };
const missing = FILES.filter(f => { const p = join(ROOT, toPath(f)); return !existsSync(p) || !statSync(p).isFile(); });
ok(FILES.length > 0 && missing.length === 0, `all ${FILES.length} precached files exist${missing.length ? ' — missing: ' + missing.join(', ') : ''}`);
const dup = FILES.filter((f, i) => FILES.indexOf(f) !== i);
ok(dup.length === 0, 'no duplicate entries in FILES' + (dup.length ? ': ' + dup.join(', ') : ''));

// 3) ملف متخزّن اتغيّر من غير ما sw.js يتغير؟
const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
const base = process.env.CHECK_BASE || 'HEAD~1';
let changed = null;
try { git('rev-parse', '--verify', '--quiet', base + '^{commit}'); changed = git('diff', '--name-only', base, 'HEAD').split('\n').filter(Boolean); }
catch (e) { skip(`no ${base} to compare with (first commit or shallow clone with depth 1) — sw.js bump check skipped`); }
if (changed) {
  const cached = new Set(FILES.map(toPath));
  const hit = changed.filter(f => cached.has(f));
  if (!hit.length) skip(`no precached file changed since ${base}`);
  else ok(changed.includes('sw.js'), `sw.js changed along with precached files since ${base} (${hit.join(', ')}) — bump BUILD/VER or users never get the update`);
}

console.log(fail ? `\n${fail} check(s) failed` : '\nall build checks passed');
process.exit(fail ? 1 : 0);
