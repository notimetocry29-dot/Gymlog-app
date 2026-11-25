// اختبارات تلقائية سريعة لمنطق چيم لوج. بتشتغل على السيرفر المحلي: python3 -m http.server 8765
// node tests/smoke.mjs   (CHROME_PATH اختياري لو عايز Chrome بتاع النظام)
import { chromium } from 'playwright';
const URL0 = process.env.APP_URL || 'http://localhost:8765/index.html';
const iso = d => { const x = new Date(); x.setDate(x.getDate() - d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); };
let n = 0; const id = () => 't' + (n++);
const E = (name, w, sets, reps, core, unit = '') => ({ id: id(), name, w, sets, reps, goal: unit ? reps : Math.max(12, reps), unit, core: !!core, note: '' });
function state(lastAgo) {
  n = 0;
  const days = [
    { id: 'U1', name: 'Upper 1', ex: [E('Chest Press Machine', 25, 3, 12, 1), E('Lat Pulldown', 52, 3, 8, 1), E('Lateral Raises', 7.5, 3, 15)] },
    { id: 'L1', name: 'Lower 1', ex: [E('Leg Press', 100, 3, 10, 1), E('Leg Curl', 32, 3, 12), E('Plank', 0, 2, 45, 0, 'ث')] },
  ];
  const sessions = [];
  for (let k = 5; k >= 0; k--) {
    const d = days[k % 2];
    sessions.push({ id: 's' + k, date: iso(lastAgo + k * 2), day: d.id, dayName: d.name, cycle: 3, status: 'full', ts: Date.now() - k * 1e8,
      ex: d.ex.map(t => ({ exId: t.id, name: t.name, unit: t.unit, core: t.core, goal: t.goal, tsets: t.sets, treps: t.reps, w: t.w, sets: Array(t.sets).fill(t.goal), clean: true, note: '' })) });
  }
  return { v: 1, mig: 6, at: Date.now() + 1e9, settings: { cycle: 1, lastBackup: Date.now(), theme: 'iron', lang: 'ar' }, draft: null, sessions, program: { days } };
}
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const br = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH, args: ['--no-sandbox'] } : {});
async function page(st) {
  const ctx = await br.newContext({ viewport: { width: 393, height: 800 }, isMobile: true, hasTouch: true });
  if (st) await ctx.addInitScript(s => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('gymlog.v1', s); localStorage.setItem('gl_seen', Date.now()); sessionStorage.setItem('seeded', '1'); } }, JSON.stringify(st));
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('dialog', d => { errs.push('native dialog'); d.dismiss(); });
  await pg.goto(URL0); await pg.waitForTimeout(1800); return { pg, errs, ctx };
}
// 1) قاعدة الزيادة: يومين نضاف على الهدف = استحق زيادة
{ const { pg, errs, ctx } = await page(state(2));
  ok(await pg.evaluate(() => { const t = S.program.days[0].ex[0]; const p = progState({ sets: t.sets, goal: t.goal }, exHist(t.id)); return p && p.k === 'up'; }), 'progression earns an increase after two clean target days');
  ok(await pg.evaluate(() => planDraft('U1', null).ex[0].clean === true), 'new sets are clean by default');
  ok(await pg.evaluate(() => !cbNow()), 'no comeback card after a 2-day gap');
  ok(errs.length === 0, 'no page errors (fresh load) ' + errs.join(';')); await ctx.close(); }
// 2) الرجوع بعد الغياب
{ const { pg, errs, ctx } = await page(state(20));
  ok(await pg.evaluate(() => { const c = cbNow(); return c && c.step.k === 'fb' && c.step.p === .8; }), '20-day gap suggests full body at 80%');
  ok(await pg.evaluate(() => document.querySelector('.orb').dataset.a === 'cbGo'), 'the circle becomes the comeback session');
  ok(await pg.evaluate(() => !!document.querySelector('.cbq [data-a="start"]')), 'a quiet link offers the usual day instead');
  ok(errs.length === 0, 'no page errors (comeback) ' + errs.join(';')); await ctx.close(); }
// 3) الاسترجاع بينضّف القيم ومابيشغلش كود
{ const { pg, errs, ctx } = await page(state(2));
  const bad = state(2); bad.program.days[0].ex[0].reps = '<img src=x onerror=window.__x=1>'; bad.fbDay = { id: 'FB', name: 'Full Body', ex: [E('Leg Press', 80, 2, 10)] };
  await pg.evaluate(d => { window.__r = applyRestore(d); }, bad); await pg.waitForTimeout(300);
  await pg.click('#ask .ok'); await pg.waitForTimeout(600); await pg.evaluate(() => { go('home'); go('prog'); });
  ok(await pg.evaluate(() => !window.__x && typeof S.program.days[0].ex[0].reps === 'number'), 'restore sanitizes numbers (no script runs)');
  ok(await pg.evaluate(() => S.fbDay && S.fbDay.ex.length === 1 && 'fbDay' in snapData()), 'full body day survives backup/restore');
  ok(errs.length === 0, 'no page errors (restore) ' + errs.join(';')); await ctx.close(); }
// 4) يوم فاضي + تراجع
{ const { pg, errs, ctx } = await page(state(2));
  await pg.evaluate(() => { S.program.days[1].ex = []; save(); startSession('L1'); }); await pg.waitForTimeout(300);
  ok(await pg.evaluate(() => S.draft === null), 'empty day does not open a broken session');
  const n0 = await pg.evaluate(() => S.sessions.length);
  await pg.evaluate(() => sessModal(S.sessions[0].id)); await pg.waitForTimeout(200); await pg.click('[data-a="delS"]'); await pg.waitForTimeout(200); await pg.click('#ask .ok'); await pg.waitForTimeout(300);
  await pg.click('#undo button'); await pg.waitForTimeout(300);
  ok(await pg.evaluate(() => S.sessions.length) === n0, 'undo restores a deleted session');
  ok(errs.length === 0, 'no page errors (empty/undo) ' + errs.join(';')); await ctx.close(); }
// 5) أول استخدام
{ const { pg, errs, ctx } = await page(null);
  ok(await pg.evaluate(() => !!document.querySelector('[data-a="onbSys"]')), 'first run shows onboarding');
  ok(errs.length === 0, 'no page errors (first run) ' + errs.join(';')); await ctx.close(); }
// 6) v134: الرجوع يفضل متاح بعد ما تختار يومك العادي + الشروحات بعربي/English + مفيش قوايم نظام
{ const { pg, errs, ctx } = await page(state(20));
  await pg.evaluate(() => closeModal(true));
  await pg.click('.cbq [data-a="start"]'); await pg.waitForTimeout(500); await pg.evaluate(() => { closeSession(); go('home'); }); await pg.waitForTimeout(300);
  ok(await pg.evaluate(() => !!document.querySelector('.cbq [data-a="cbSwap"]')), 'after choosing the usual day, the comeback option stays under the circle');
  await pg.evaluate(() => { S.draft.ex[0].sets[0] = '10'; save(); go('home'); }); await pg.waitForTimeout(200);
  ok(await pg.evaluate(() => !!document.querySelector('.cbq [data-a="cbSwap"]')), 'the comeback button stays even after logging a set in the usual day');
  await pg.click('.cbq [data-a="cbSwap"]'); await pg.waitForTimeout(400); await pg.click('#ask .ok'); await pg.waitForTimeout(500);
  ok(await pg.evaluate(() => !$('#sess').hidden && S.draft && S.draft.cb && !S.draft.cb.dl), 'tapping it goes straight into the comeback session');
  await pg.evaluate(() => { closeSession(); S.draft = null; save(); go('home'); }); await pg.waitForTimeout(300);
  await pg.evaluate(() => { S.settings.lang = 'en'; LANG = 'en'; S.settings.howLang = 'ar'; go('home'); }); await pg.waitForTimeout(200);
  await pg.click('.cbq [data-a="cbWhy"]'); await pg.waitForTimeout(300);
  ok(await pg.evaluate(() => /الغياب/.test(document.querySelector('#modal .mbox').textContent)), 'explanation opens in Arabic (the chosen explanations language) inside an English app');
  await pg.click('#modal [data-a="xLang"][data-l="en"]'); await pg.waitForTimeout(300);
  ok(await pg.evaluate(() => /break/.test(document.querySelector('#modal .mbox').textContent) && S.settings.howLang === 'ar'), 'in-window toggle switches language without changing the setting');
  await pg.evaluate(() => closeModal()); await pg.waitForTimeout(300); await pg.evaluate(() => go('hist')); await pg.waitForTimeout(300);
  ok(await pg.evaluate(() => [...document.querySelectorAll('select')].every(s => getComputedStyle(s).display === 'none') && !!document.querySelector('.xsel')), 'selects are replaced by themed buttons');
  await pg.click('.xsel[data-for="dayPick"]'); await pg.waitForTimeout(300);
  ok(await pg.evaluate(() => document.querySelectorAll('#xp .xpo').length > 0), 'themed picker opens with options');
  await pg.click('#xp .xpo'); await pg.waitForTimeout(400);
  ok(await pg.evaluate(() => !document.getElementById('xp') && !document.querySelector('#modal').hidden), 'picking an option fires the original handler');
  ok(errs.length === 0, 'no page errors (v134) ' + errs.join(';')); await ctx.close(); }
// 7) الحلقة الواحدة فيها ذيل بيلف
{ const st = state(2); st.program.days = [st.program.days[0]]; const { pg, errs, ctx } = await page(st);
  ok(await pg.evaluate(() => !!document.querySelector('.orb .cmt') && getComputedStyle(document.querySelector('.orb .cmt')).animationName === 'cmt'), 'single ring has a visibly rotating comet');
  ok(errs.length === 0, 'no page errors (single ring) ' + errs.join(';')); await ctx.close(); }
// 8) v139: أمان البيانات — XSS من ملف، تمرين مخصص بايظ، دمج الجلسات، 3 نسخ قبل الاسترجاع، مفيش CSP errors
{ const { pg, errs, ctx } = await page(state(2));
  const csp = []; pg.on('console', m => { if (/Content Security Policy|Refused to/i.test(m.text())) csp.push(m.text()); });
  const bad = state(2); bad.program.days[0].id = '"><img src=x onerror=window.__x=1>'; bad.custom = [{ name: 5 }, { name: 'Ok Ex', sets: '<b>', reps: 3 }];
  bad.body = [{ d: '"><img src=x onerror=window.__x=2>', w: 80 }, { d: '2026-01-01', w: '<i>' }]; bad.sys = { cur: 'ul4', saved: { x: { days: [{ id: '"><svg onload=window.__x=3>', name: 'A', ex: [] }] } } };
  bad.settings.theme = '<x>'; bad.settings.protG = '<img>';
  await pg.evaluate(d => { window.__r = applyRestore(d); }, bad); await pg.waitForTimeout(300); await pg.click('#ask .ok'); await pg.waitForTimeout(700);
  await pg.evaluate(() => { go('prog'); go('lib'); go('data'); go('home'); lbQ = 'ok'; renderLib(); });
  ok(await pg.evaluate(() => !window.__x && S.custom.length === 1 && typeof S.custom[0].sets === 'number' && S.settings.theme === 'iron' && S.body.length === 1), 'restore cleans custom, body, sys and settings (no script runs, no crash)');
  ok(await pg.evaluate(async () => { const a = await idb.get('state.prerestores'); return Array.isArray(a) && a.length === 1; }), 'a pre-restore copy is kept');
  ok(await pg.evaluate(() => { const n = S.sessions.length; const r = JSON.parse(JSON.stringify({ sessions: S.sessions.slice(0, 2) })); r.sessions.push(Object.assign({}, r.sessions[0], { id: 'remoteOnly' })); r.sessions[1].mt = Date.now() + 5; r.sessions[1].dayName = 'Changed'; const k = mergeIn(r); return S.sessions.length === n + 1 && S.sessions.some(x => x.id === 'remoteOnly') && S.sessions.some(x => x.dayName === 'Changed') && k === 2; }), 'sync merge keeps remote-only sessions and the newest edit');
  ok(await pg.evaluate(() => { S.tomb = { remoteOnly: Date.now() }; mergeIn({ sessions: S.sessions }); return !S.sessions.some(x => x.id === 'remoteOnly'); }), 'deleted sessions stay deleted after a merge');
  const older = state(2); older.sessions = older.sessions.slice(0, 2);
  await pg.evaluate(d => { window.__r = applyRestore(d, { at: Date.now() - 864e5 }); }, older); await pg.waitForTimeout(300);
  ok(await pg.evaluate(() => /أقدم|older/.test(document.querySelector('#ask .atx').textContent)), 'restoring an older/smaller file shows a strong warning');
  await pg.click('#ask .no'); await pg.waitForTimeout(300);
  ok(await pg.evaluate(() => { try { cleanRestore({ __v: 9, program: { days: [] }, sessions: [] }); return false } catch (e) { return e.message === 'newer' } }), 'backups from a newer format are refused');
  ok(csp.length === 0, 'no CSP violations ' + csp.join(';'));
  ok(errs.length === 0, 'no page errors (v139 data safety) ' + errs.join(';')); await ctx.close(); }
// 9) v139: النسخ على GitHub: مفيش كتابة فوق نسخة موجودة، والجهازين بيندمجوا
{ const store = { file: null, sha: 0, puts: 0 };
  const fake = async route => { const rq = route.request(), u = new URL(rq.url()), p = u.pathname, m = rq.method(), J = (o, st = 200) => route.fulfill({ status: st, contentType: 'application/json', body: JSON.stringify(o) });
    if (p === '/repos/me/gym' && m === 'GET') return J({ private: true, permissions: { push: true }, default_branch: 'main' });
    if (p === '/user/repos') return J([{ full_name: 'me/gym' }]);
    if (p.includes('/git/ref/')) return J({ object: { sha: 'x' } });
    if (p.endsWith('/contents/sync/state.bin')) {
      if (m === 'GET') { if (!store.file) return J({ message: 'Not Found' }, 404); if (/raw/.test(rq.headers()['accept'] || '')) return route.fulfill({ status: 200, body: store.file }); return J({ sha: 's' + store.sha, encoding: 'base64', content: Buffer.from(store.file).toString('base64') }); }
      if (m === 'PUT') { const b = JSON.parse(rq.postData()); if (store.file && b.sha !== 's' + store.sha) return J({ message: 'conflict' }, 409); store.file = Buffer.from(b.content, 'base64').toString(); store.sha++; store.puts++; return J({ content: { sha: 's' + store.sha } }); } }
    return J({}, 404); };
  const dev = async (st) => { const r = await page(st); await r.ctx.route('https://api.github.com/**', fake); return r; };
  const A = await dev(state(2));
  await A.pg.evaluate(() => { go('data'); }); 
  ok(await A.pg.evaluate(() => enableSyncWith('github_pat_x', 'passphrase-123', 'me/gym')), 'first device enables sync and uploads');
  const B0 = state(2); B0.sessions = B0.sessions.slice(0, 3).map(x => Object.assign({}, x, { id: 'b' + x.id }));
  const B = await dev(B0);
  const wrong = B.pg.evaluate(() => enableSyncWith('github_pat_x', 'other-passphrase', 'me/gym')); await B.pg.waitForTimeout(2500);
  ok(await B.pg.evaluate(() => !!document.querySelector('#ask')), 'a different passphrase is refused (no overwrite)'); await B.pg.click('#ask .no'); await wrong;
  const puts = store.puts;
  const good = B.pg.evaluate(() => enableSyncWith('github_pat_x', 'passphrase-123', 'me/gym')); await B.pg.waitForTimeout(2500);
  ok(await B.pg.evaluate(() => !!document.querySelector('#ask .alt')), 'an existing backup offers merge / restore'); await B.pg.click('#ask .ok'); await good;
  ok(await B.pg.evaluate(() => S.sessions.length === 9 && SYNC.on), 'merge brings the other device sessions here');
  ok(store.puts === puts + 1, 'merged data uploaded once');
  ok(await A.pg.evaluate(async () => { S.sessions.push(Object.assign({}, S.sessions[0], { id: 'a-new', mt: Date.now() })); save(); return await runBackup(true) && S.sessions.length === 10; }), 'the first device keeps the second device sessions on its next upload');
  ok(await B.pg.evaluate(() => enableSyncWith('ghp_classic', 'passphrase-123', 'me/gym')) === false, 'classic (broad) tokens are refused');
  ok(A.errs.length === 0 && B.errs.length === 0, 'no page errors (sync) ' + A.errs.concat(B.errs).join(';')); await A.ctx.close(); await B.ctx.close(); }
await br.close();
console.log(fail ? `\n${fail} test(s) failed` : '\nall tests passed'); process.exit(fail ? 1 : 0);
