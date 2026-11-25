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
await br.close();
console.log(fail ? `\n${fail} test(s) failed` : '\nall tests passed'); process.exit(fail ? 1 : 0);
