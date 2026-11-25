/* چيم لوج — منطق التطبيق. الإصدار في const VER، ولازم يتغير مع BUILD في sw.js */
'use strict';
const VER='138';
const KEY='gymlog.v1';
/* ================= اللغة / Language ================= */
let LANG='en';
const T=()=>I18N[LANG];
const unitTxt=u=>u?(T().units[u]||u):'';

/* ================= أدوات ================= */
const AR='٠١٢٣٤٥٦٧٨٩';
const $=s=>document.querySelector(s);
const num=v=>{if(v==null)return NaN;const s=String(v).trim().replace(/[٠-٩]/g,d=>AR.indexOf(d)).replace(/[٫,]/g,'.');return s===''?NaN:Number(s)};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const today=()=>{const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,10)};
const loc=()=>LANG==='ar'?'ar-EG-u-nu-latn':'en-GB';
const fmtD=iso=>{try{return new Date(iso+'T12:00:00').toLocaleDateString(loc(),{weekday:'short',day:'numeric',month:'short'})}catch(e){return iso}};
const daysAgo=iso=>Math.round((new Date(today()+'T12:00:00')-new Date(iso+'T12:00:00'))/864e5);
const noW=w=>w===''||w==null||isNaN(+w)||+w===0;
const fw=w=>noW(w)?'—':(+w)+' k';
function toast(t){const el=$('#toast');el.textContent=t;el.classList.add('on');clearTimeout(toast.t);el.style.transform='';el.style.opacity='';toast.t=setTimeout(()=>el.classList.remove('on'),t.length>45?3200:1500)}
(()=>{let x0=null;const el=()=>$('#toast');document.addEventListener('touchstart',e=>{if(e.target.closest&&e.target.closest('#toast')){x0=e.touches[0].clientX;clearTimeout(toast.t)}},{passive:true});document.addEventListener('touchmove',e=>{if(x0==null)return;const dx=e.touches[0].clientX-x0;el().style.transform=`translateX(calc(-50% + ${dx}px))`;el().style.opacity=String(Math.max(0,1-Math.abs(dx)/160))},{passive:true});document.addEventListener('touchend',e=>{if(x0==null)return;const dx=(e.changedTouches[0].clientX-x0);x0=null;const t=el();if(Math.abs(dx)>50){t.classList.remove('on');setTimeout(()=>{t.style.transform='';t.style.opacity=''},250)}else{t.style.transform='';t.style.opacity='';toast.t=setTimeout(()=>t.classList.remove('on'),1200)}})})();

/* ================= البيانات ================= */
function E(name,w,sets,reps,o={}){return{id:uid(),name,w,sets,reps,goal:o.goal??(o.unit?reps:Math.max(12,reps)),unit:o.unit||'',core:!!o.core,note:o.note||''}}
/* البرنامج الافتراضي لأي حد بيفتح التطبيق أول مرة: أبر/لوور 4 أيام. الأوزان من مكتبة التمارين (وزن بداية) والشرح كله من المكتبة */
function seed(){
  const X=(n,sets,reps,core)=>{const L=typeof LIB!=='undefined'&&LIB.find(r=>r[0]===n);return E(n,L?L[2]:0,sets,reps,{core,unit:L?L[5]:''})};
  return{v:1,settings:{cycle:1,lastBackup:null},draft:null,sessions:[],program:{days:[
    {id:'U1',name:'Upper 1',ex:[
      X('Flat Dumbbell Press',3,10,1),X('Lat Pulldown',3,10,1),X('Shoulder Press',3,10),
      X('Seated Row',3,10),X('Lateral Raises',3,15),X('Triceps Pushdown',3,12),X('Biceps Curl',3,10)]},
    {id:'L1',name:'Lower 1',ex:[
      X('Leg Press',3,10,1),X('Romanian Deadlift',3,10,1),X('Leg Extension',3,12),
      X('Leg Curl',3,12),X('Calf Raises',3,15),X('Plank',3,45)]},
    {id:'U2',name:'Upper 2',ex:[
      X('Incline Dumbbell Press',3,10,1),X('Chest-Supported Row',3,10,1),X('DB Shoulder Press',3,10),
      X('Face Pull',3,15),X('Cable Overhead Extension',3,12),X('Hammer Curl',3,10)]},
    {id:'L2',name:'Lower 2',ex:[
      X('Hack Squat',3,10,1),X('Hip Thrust',3,12,1),X('Seated Leg Curl',3,12),
      X('Walking Lunges',3,10),X('Seated Calf Raise',3,15),X('Hanging Knee Raise',3,10)]}
  ]}};
}
function load(){try{const r=localStorage.getItem(KEY);if(r){const o=JSON.parse(r);if(o&&o.program&&Array.isArray(o.sessions))return o}}catch(e){}return null}
/* التخزين: IndexedDB هو الأصل، وlocalStorage نسخة مرآة بنقرأ منها لو الأحدث (والرئيسية بتقرأ منها) */
let POP=-1;let S=null,sq=Promise.resolve(),pendMig=false;
let svT=null;
function saveSoon(){clearTimeout(svT);svT=setTimeout(()=>{svT=null;save()},700)}
function flushSave(){if(svT){clearTimeout(svT);svT=null;save()}}
function save(){
  if(svT){clearTimeout(svT);svT=null}
  S.at=Date.now();
  let snap;try{snap=structuredClone(S)}catch(e){snap=JSON.parse(JSON.stringify(S))}
  let lsOK=true;try{localStorage.setItem(KEY,JSON.stringify(snap))}catch(e){lsOK=false}
  sq=sq.then(()=>idb.set('state',snap)).catch(()=>{if(!lsOK)toast(T().storeFail)});
}
const HIST=[];/* السجل القديم اتشال من الكود العام (v50). بياناتك على الموبايل وفي النسخ الاحتياطية */
function histSess(h,id){
  const dd=h.id?S.program.days.find(d=>d.id===h.id):null;
  const ex=h.ex.map(e=>{
    const pe=S.program.days.flatMap(d=>d.ex).find(q=>q.name===e.n);
    const top=Math.max(...e.s);
    return{exId:pe?pe.id:'h:'+e.n,name:e.n,unit:e.u||'',core:false,goal:top,tsets:e.s.length,treps:top,w:e.w,sets:e.s.slice(),clean:false,note:e.t||''};
  });
  return{id,date:h.d,day:dd?dd.id:'',dayName:dd?dd.name:h.dn,cycle:h.c,status:'full',ts:new Date(h.d+'T12:00:00').getTime(),ex,imp:1};
}
function importHist(){
  if((S.mig||0)>=3)return 0;
  const have=new Set(S.sessions.map(s=>s.date));let n=0;
  for(const h of HIST){if(have.has(h.d))continue;S.sessions.push(histSess(h,uid()+n));n++}
  S.impN=n;return n;
}
/* v4: سجل كامل من الملاحظات القديمة. بيستبدل الجلسات المستوردة بس، وجلساتك اللي سجلتها بنفسك مبتتلمسش */
function importHist4(){
  const by=new Map(S.sessions.map(s=>[s.date,s]));let n=0;
  for(const h of HIST){
    const old=by.get(h.d);if(old&&!old.imp)continue;
    if(old){const i=S.sessions.indexOf(old);S.sessions[i]=histSess(h,old.id)}else S.sessions.push(histSess(h,uid()+n));
    n++;
  }
  S.impN=n;return n;
}
function migrate(){
  if((S.mig||0)<2){
    for(const d of S.program.days){
      const sp=d.ex.find(e=>e.name==='Shoulder Press');if(sp)sp.core=false;
      if(d.id==='L1'||d.id==='L2'){const i=d.ex.findIndex(e=>e.name==='Plank');if(i===0&&d.ex.length>1)d.ex.push(d.ex.splice(0,1)[0])}
    }
    S.mig=2;pendMig=true;
  }
  if((S.mig||0)<3){importHist();S.mig=3}
  if((S.mig||0)<4){importHist4();S.mig=4}
  if((S.mig||0)<6){S.mig6ask=S.sessions.some(x=>!x.imp&&x.ex.some(e=>!e.clean&&!e.unit));S.mig=6}
  if((S.mig||0)<5){for(const x of S.sessions)if(x.imp){const dd=S.program.days.find(d=>d.name===x.dayName);x.status=dd&&dd.ex.every(t=>x.ex.some(e=>e.name===t.name))?'full':'imp'}S.mig=5}
}
/* v87: آخر مرة التطبيق كان مفتوح (لشاشة البداية) */
/* v134: شاشة البداية بعد ساعتين غياب، مهما كان التطبيق اتقفل إزاي: اتقفل خالص (index.html بيتصرف)، أو فضل في الخلفية.
   في الخلفية الموبايل ساعات بيجمّد الصفحة من غير ما يبلّغها إنها اتخفت، فبنقيس الفجوة نفسها: آخر علامة «كان مفتوح» قبل ساعتين أو أكتر = رجوع */
(function(){const k='gl_seen',G=72e5,get=()=>{try{return +localStorage.getItem(k)||0}catch(e){return 0}},mark=()=>{try{localStorage.setItem(k,Date.now())}catch(e){}};
 let lt=Date.now();
 const back=()=>{const l=Math.max(get(),0),n=Date.now();if(l&&n-l>=G&&!document.getElementById('splash'))showSplash();lt=n;mark()};
 mark();
 setInterval(()=>{if(document.hidden)return;const n=Date.now();if(n-lt>=G)back();else{lt=n;mark()}},30000);
 document.addEventListener('visibilitychange',()=>{if(document.hidden){mark();return}back()});
 window.addEventListener('pageshow',e=>{if(e.persisted)back()});
 window.addEventListener('focus',()=>{if(!document.hidden&&Date.now()-lt>=G)back()});
 window.addEventListener('pagehide',mark)})();
function showSplash(){const tpl=window.__spTpl;if(!tpl)return;const d=document.createElement('div');d.innerHTML=tpl;const sp=d.firstElementChild;document.body.appendChild(sp);sp.classList.add('on');setTimeout(()=>{sp.classList.add('out');setTimeout(()=>sp.remove(),520)},1150)}
async function boot(){
  let a=null;try{a=await idb.get('state')}catch(e){}
  const b=load();
  if(!a&&b){try{await idb.set('state.legacy',JSON.parse(JSON.stringify(b)))}catch(e){}}
  const fresh=!a&&!b;
  S=(a&&b)?((b.at||0)>(a.at||0)?b:a):(a||b||seed());
  /* v87: أول فتح خالص: ثيم Iron، دورة 1، ومن غير رسايل ترحيل قديمة */
  if(fresh){S.onb=1;S.mig=6;S.settings.theme='iron';S.settings.cycle=1;S.settings.lang='';S.settings.howLang=/^en/i.test(navigator.language||'')?'en':'ar'}
  S.settings=S.settings||{};
  if(!S.settings.lang)S.settings.lang=/^ar/i.test(navigator.language||'')?'ar':'en';
  LANG=S.settings.lang;
  migrate();
  /* مسودة قديمة: لو اليوم ده اتحفظ فعلًا بنفس التاريخ، أو المسودة فاضية وقديمة، تتشال */
  if(S.draft&&!S.draft.editing){
    const dr=S.draft,filled=(dr.ex||[]).some(e=>(e.sets||[]).some(v=>String(v).trim()!==''));
    const saved=S.sessions.some(x=>x.date===dr.date&&(x.day===dr.day||x.dayName===dr.dayName));
    if(!filled&&(saved||dr.date<today()))S.draft=null;
  }
  if(S.draft&&typeof S.draft.cb==='number')S.draft.cb={k:'lt',p:.85,g:S.draft.cb,i:0,n:1};
  await loadSync();
  save();await sq;
  try{navigator.storage&&navigator.storage.persist&&navigator.storage.persist()}catch(e){}
}

/* v112: «Full Body» بتاع الرجوع يوم متخزّن تعدّله من تبويب البرنامج زي أي يوم (مش جزء من الدورة) */
function fbDay(){
  if(!S.fbDay||!Array.isArray(S.fbDay.ex)){S.fbDay={id:'FB',name:'Full Body',ex:fbPick().map(x=>Object.assign({},x.t,{id:uid(),core:x.core,sets:2}))};saveSoon()}
  return S.fbDay}
const day=id=>id==='FB'?fbDay():S.program.days.find(d=>d.id===id)||S.program.days[0];
const coreNames=d=>d.ex.filter(e=>e.core).map(e=>e.name);
const done=()=>S.sessions.slice().sort((a,b)=>b.date.localeCompare(a.date)||b.ts-a.ts);
function dayIdx(s){const o=S.program.days;let i=o.findIndex(d=>d.id===s.day);if(i<0)i=o.findIndex(d=>d.name===s.dayName);return i}
/* v108: جلسة «فول بادي» الرجوع مش يوم من الدورة: الدورة بتكمّل من آخر يوم حقيقي */
/* v125: أكتر من جيم: الوزن بيتاخد من آخر مرة في نفس الجيم */
const gymId=()=>(S.settings&&S.settings.gym)||'main';
const gymOf=x=>x.gym||'main';
const realLast=()=>done().find(s=>s.day!=='FB');
function nextDayId(){const l=realLast();const o=S.program.days.map(d=>d.id);if(!l)return o[0];const i=dayIdx(l);return i<0?o[0]:o[(i+1)%o.length]}
function calcCycle(dayId){const l=realLast();if(!l)return S.settings.cycle||1;const o=S.program.days.map(d=>d.id),i=dayIdx(l);return i<0?l.cycle:(o.indexOf(dayId)<=i?l.cycle+1:l.cycle)}
const nk=n=>String(n||'').trim().toLowerCase();
/* تاريخ التمرين: بالاسم من كل الجلسات (مش مربوط بيوم معين) */
function exHist(exId,skip){const out=[];
  const me=S.program.days.concat(S.fbDay?[S.fbDay]:[]).flatMap(d=>d.ex).find(x=>x.id===exId),nm=me?nk(me.name):null;
  for(const s of done()){if(s.id===skip)continue;const e=s.ex.find(x=>x.exId===exId)||(nm&&s.ex.find(x=>nk(x.name)===nm));if(e)out.push(Object.assign({date:s.date,cycle:s.cycle,cb:s.cb?1:0,gym:gymOf(s)},e))}return out}
function histMap(){const m={};for(const s of done())for(const e of s.ex){const k=nk(e.name);(m[k]||(m[k]=[])).push(Object.assign({date:s.date,cycle:s.cycle,cb:s.cb?1:0},e))}return m}
function setsStr(e){const a=e.sets;const u=e.unit?' '+unitTxt(e.unit):'';if(!a.length)return '';if(Array.isArray(e.ws)&&e.ws.length===a.length&&e.ws.some(x=>+x!==+e.w))return a.map((r,j)=>`${+e.ws[j]}×${r}`).join(' / ');return a.every(r=>r===a[0])?`${a.length}×${a[0]}${u}`:a.join('/')+u}

/* ================= v108: الرجوع بعد الغياب (تلقائي بعد أي فترة غياب) =================
   القوة بتفضل تقريبًا 2–3 أسابيع. اللي بيقع الأول: حماية العضلة من الشد العنيف بعد التمرين، والنَفَس، والأوتار.
   فالرجوع بيقلّل المجموعات أكتر من الوزن، وبيوقف قبل الفشل. أي جلسة مخففة مابتتحسبش في قاعدة الزيادة،
   وبعد الخطة الأوزان بترجع لوزنك قبل الغياب لوحدها. */
const CBD=8;
function cbSteps(g){
  if(g<CBD)return[];
  if(g<=14)return[{k:'lt',p:.9}];
  if(g<=28)return[{k:'fb',p:.8},{k:'lt',p:.9}];
  if(g<=60)return[{k:'fb',p:.75},{k:'fb',p:.85},{k:'lt',p:.9}];
  return[{k:'fb',p:.7},{k:'fb',p:.8},{k:'lt',p:.85},{k:'lt',p:.9}];
}
const dGap=(a,b)=>Math.round((new Date(a+'T12:00:00')-new Date(b+'T12:00:00'))/864e5);
/* فين انت في خطة الرجوع: الغياب الأخير (لسه مارجعتش، أو رجعت ولسه في نص الخطة) */
function cbNow(){
  const ds=done();if(!ds.length)return null;
  const at=(g,i)=>{let st=cbSteps(g);if(i>=st.length)return null;
    if(st.some(x=>x.k==='fb')&&fbDay().ex.length<2)st=st.map(x=>({k:'lt',p:x.p}));
    return{g,i,n:st.length,st,step:st[i],after:ds.slice(0,i).reverse()}};
  const g0=daysAgo(ds[0].date);if(g0>=CBD)return at(g0,0);
  for(let i=0;i<Math.min(ds.length-1,4);i++){const g=dGap(ds[i].date,ds[i+1].date);if(g>=CBD)return at(g,i+1)}
  return null;
}
/* فول بادي الرجوع: بيتبني من تمارين برنامجك انت. رجل ← صدر ← ضهر ← خلفية ← جذع. الأجهزة الأول لأنها أأمن بعد الغياب */
const fbGuess=n=>/leg press|squat|lunge|step.?up/i.test(n)?'quads':/leg curl|hamstring|deadlift|rdl|hip thrust|glute|bridge/i.test(n)?'posterior':/pulldown|pull.?up|chin|row/i.test(n)?'back':/bench|chest|push.?up|dip|(db|dumbbell|machine) press/i.test(n)?'chest':/plank|crunch|knee raise|leg raise|ab wheel|dead.?bug|pallof|hollow|sit.?up/i.test(n)?'core':'';
function fbPick(){
  const seen=new Set(),all=[];let o=0;
  for(const d of S.program.days)for(const t of d.ex){const k=nk(t.name);if(!k||seen.has(k))continue;seen.add(k);
    const n=t.name,L=libGet(n),m=(typeof META!=='undefined'&&META[n])||{};
    all.push({t,g:(L&&L[1])||fbGuess(n),comp:m.kind?m.kind==='comp':/press|squat|row|pull|deadlift|lunge|thrust|dip/i.test(n),
      safe:m.eq?(m.eq==='mach'||m.eq==='cable'):/machine|leg press|hack|smith|pulldown|cable|leg curl|pec/i.test(n),core:!!t.core,o:o++})}
  const sc=x=>x.comp*8+x.core*4+x.safe*(S.settings.safe?6:2);
  const SL=[['quads',x=>x.comp,sc],['chest',x=>x.comp,sc],['back',x=>x.comp,sc],['posterior',()=>1,x=>x.safe*8+x.core*2],['core',()=>1,x=>(x.t.unit==='ث')*8+x.core*2]];
  const out=[];
  for(const [g,ok,f] of SL){const c=all.filter(x=>x.g===g&&ok(x)).sort((a,b)=>f(b)-f(a)||a.o-b.o)[0];if(c)out.push({t:c.t,core:g==='quads'||g==='chest'||g==='back'})}
  return out;
}
/* التخفيف: فول بادي = مجموعتين. مخففة = مجموعة أقل (أقل حاجة 2). الوزن نسبة من وزنك قبل الغياب */
function cbApply(e,cb){
  const n=cb.k==='fb'?(+e.tsets||2):Math.max(2,(+e.tsets||3)-1);if(n!==+e.tsets){e.tsets=n;e.sets=Array(n).fill('');e.dur=[]}
  const w=num(e.w);if(!e.unit&&w>0){const st=stepOf(e.name);e.w=String(Math.min(w,Math.max(st,Math.round(w*cb.p/st)*st)))}
}
/* الجلسة اللي هتتلعب (من غير حفظ): الرئيسية بتعرضها، و«ابدأ» بيفتحها */
function planDraft(id,c){
  const fb=id==='FB';let ex,dd=null;
  if(fb)ex=fbDay().ex.map(t=>draftEx(t));
  else{dd=day(id);ex=dd.ex.map(t=>draftEx(t))}
  const l=realLast();
  const dr={id:uid(),t0:Date.now(),editing:null,date:today(),day:fb?'FB':dd.id,dayName:fb?fbDay().name:dd.name,cycle:fb?(l?l.cycle:(S.settings.cycle||1)):calcCycle(dd.id),ex};
  if(!c&&S.settings.ram)ex.forEach(e=>{const n=Math.max(2,(+e.tsets||3)-1);if(n<+e.tsets){e.tsets=n;e.sets=Array(n).fill('')}});
  if(c){dr.cb={k:fb?'fb':'lt',p:c.step.p,g:c.g,i:c.i,n:c.n};if(!fb)dr.dayName+=' · Light';ex.forEach(e=>cbApply(e,dr.cb))}
  return dr;
}
const cbPct=cb=>Math.round(cb.p*100)+'%';
const cbLine=cb=>cb.dl?tr(`أسبوع خفيف  · الأوزان ${cbPct(cb)} · مجموعة أقل`,`Light week · weights ${cbPct(cb)} · one set less`):tr(`رجوع بعد ${cb.g} يوم · الأوزان ${cbPct(cb)} · سيب في إيدك 2–3 عدّات`,`Back after ${cb.g} days · weights ${cbPct(cb)} · leave 2–3 reps in the tank`);
function cbCard(c,open){
  const ar0=LANG==='ar';
  if(!c){const dl=S.draft&&S.draft.cb&&S.draft.cb.dl;return `<button class="cbh" data-a="cbGo"><b>${dl?tr('جلسة خفيفة مفتوحة ','Deload session in progress'):tr('جلسة رجوع مفتوحة','Comeback session in progress')}</b><span class="cbgo">${dl?tr('كمّل الجلسة الخفيفة','Continue the light session'):tr('كمّل جلسة الرجوع','Continue the comeback session')} ${ar0?'‹':'›'}</span></button>`}
  const nm=s=>s.k==='fb'?tr('جسم كامل','Full body'):tr('مخففة','Light'),ar=LANG==='ar',sep=`<i>${ar?'‹':'›'}</i>`;
  /* الخطوات اللي عدّت بتتعلّم بالجلسة اللي اتلعبت فعلًا (رجوع أو يوم عادي) */
  const pills=c.st.map((s,k)=>{if(k<c.i){const a=c.after[k];return `<span class="ok">✓ ${a&&a.cb?nm(a.cb)+' <bdi class="en">'+cbPct(a.cb)+'</bdi>':'<bdi class="en">'+esc(dayBase(a?a.dayName:''))+'</bdi>'}</span>`}
    return `<span class="${k===c.i?'on':''}">${nm(s)} <bdi class="en">${cbPct(s)}</bdi></span>`}).join(sep)+`${sep}<span>${tr('جدولك','Your plan')}</span>`;
  const dn=c.step.k==='fb'?'':day(nextDayId()).name;
  const how=c.step.k==='fb'?tr(`جسم كامل: مجموعتين لكل تمرين، والأوزان ${cbPct(c.step)} من أوزانك قبل الغياب.`,`Full body: two sets per exercise, weights at ${cbPct(c.step)} of your pre-break weights.`)
    :tr(`<bdi class="en">${esc(dn)}</bdi> مخففة: مجموعة أقل في كل تمرين، والأوزان ${cbPct(c.step)} من أوزانك قبل الغياب.`,`${esc(dn)}, light: one set less per exercise, weights at ${cbPct(c.step)} of your pre-break weights.`);
  return `<button class="cbh" data-a="cbGo"><b>${tr(`رجوع بعد ${c.g} يوم`,`Back after ${c.g} days`)}</b><span class="cbt">${how} ${tr('وقّف وانت لسه قادر على 2–3 عدّات.','Stop each set with 2–3 reps left.')}</span><span class="cbs" dir="${ar?'rtl':'ltr'}">${pills}</span><span class="cbgo">${open?tr('كمّل جلسة الرجوع','Continue the comeback session'):tr('ابدأ جلسة الرجوع','Start the comeback session')} ${ar?'‹':'›'}</span></button>`;
}
/* v116: Deload: بعد 6 أسابيع تمرين متواصل (من غير غياب أسبوع)، اقتراح بأسبوع خفيف: مجموعة أقل والأوزان 90%، ومابيتحسبش في القاعدة */
function dlNow(){const ds=done();if(ds.length<8||daysAgo(ds[0].date)>=CBD)return null;
  if(S.dl&&dGap(today(),S.dl)<7)return{act:1,left:7-dGap(today(),S.dl)};
  const sk=!!(S.dlSkip&&dGap(today(),S.dlSkip)<7);
  let st=ds[0].date;for(let i=0;i<ds.length-1;i++){if(dGap(ds[i].date,ds[i+1].date)>=7)break;st=ds[i+1].date}
  const ref=S.dl&&S.dl>st?S.dl:st,wk=Math.floor(dGap(today(),ref)/7);return wk>=6?(sk?{wk,skip:1}:{wk}):null}
function dlCard(x){const ar=LANG==='ar';
  return `<div class="cbh dlc"><b>${x.act?tr(`أسبوع خفيف · فاضل ${x.left} يوم`,`Light week · ${x.left} day(s) left`):tr(`بقالك ${x.wk} أسابيع تمرين متواصل`,`${x.wk} weeks of training in a row`)}</b><span class="cbt">${tr('مجموعة أقل في كل تمرين والأوزان 90%، علشان جسمك يتخلص من التعب المتراكم ويرجع أقوى.','A light week: one set less per exercise at 90% weights. Your body clears built-up fatigue and comes back stronger; it does not count toward the progression rule.')}</span><span class="dlb"><button class="cbgo" data-a="dlGo">${tr('ابدأ يوم خفيف','Start a light day')} ${ar?'‹':'›'}</button>${x.act?'':`<button class="dls" data-a="dlSkip">${tr('مش دلوقتي','Not now')}</button>`}</span></div>`}
async function startDeload(){if(S.draft&&S.draft.cb&&S.draft.cb.dl&&!S.draft.editing){openSession();return}if(S.draft&&!dEmpty(S.draft)&&!await ask(T().confNew))return;
  if(!(S.dl&&dGap(today(),S.dl)<7))S.dl=today();
  delete S.dlSkip;
  S.draft=null;const pd=planDraft(nextDayId(),{g:0,i:0,n:1,step:{k:'lt',p:.9}});pd.cb.dl=1;if(!pd.ex.length){toast(tr('اليوم ده فاضي','This day is empty'));return}S.draft=pd;openTips.clear();save();openSession()}
/* اقتراح بس: بيتفتح لما تدوس على الكارت. الدايرة و«ابدأ يوم تاني» والبرنامج بيفتحوا يومك العادي بأوزانك */
/* v113: ask(نص) بدل confirm: نافذة بنفس الثيم، وبترجع وعد (موافقة = true) */
function ask(msg,o={}){return new Promise(res=>{
  const old=document.getElementById('ask');if(old)old.remove();
  const w=document.createElement('div');w.id='ask';w.setAttribute('role','dialog');w.setAttribute('aria-modal','true');
  w.innerHTML=`<div class="abx"><div class="atx" dir="auto">${esc(msg)}</div><div class="abt"><button class="ok${o.danger?' dg':''}">${esc(o.yes||tr('تمام','OK'))}</button><button class="no">${esc(o.no||tr('إلغاء','Cancel'))}</button></div></div>`;
  let done=false;const end=v=>{if(done)return;done=true;w.classList.remove('on');document.removeEventListener('keydown',kd,true);setTimeout(()=>w.remove(),180);res(v)};
  const kd=e=>{if(e.key==='Escape'){e.stopPropagation();end(false)}};
  w.addEventListener('click',e=>{e.stopPropagation();if(e.target.closest('.ok'))end(true);else if(e.target.closest('.no')||e.target===w)end(false)});
  document.addEventListener('keydown',kd,true);
  document.body.appendChild(w);void w.offsetWidth;w.classList.add('on');try{navigator.vibrate&&navigator.vibrate(8)}catch(e){}
  setTimeout(()=>{const b=w.querySelector('.no');b&&b.focus({preventScroll:true})},30);
})}
const dEmpty=d=>!!d&&!d.editing&&!(d.ex||[]).some(e=>(e.sets||[]).some(v=>String(v).trim()!==''));
/* v133: الرجوع مش يوم في البرنامج. لما شروطه تتحقق، الدايرة بتفتح الشاشة دي: التمرينة المقترحة بأوزانها */
function cbPreview(){const c=cbNow();if(!c){startComeback();return}
  const pd=planDraft(c.step.k==='fb'?'FB':nextDayId(),c),fb=c.step.k==='fb';
  modal(`<h3>${tr('تمرينتك المقترحة النهارده','Your suggested workout today')}</h3>
  <div class="mu" style="margin-bottom:12px;line-height:1.8">${tr(`غبت ${c.g} يوم، فالنهارده ${fb?'جسم كامل خفيف':'<bdi class="en">'+esc(pd.dayName.replace(' · Light',''))+'</bdi> مخففة'} والأوزان <b class="en">${cbPct(c.step)}</b> من أوزانك قبل الغياب. خطوة ${c.i+1} من ${c.n}، وبعدها ترجع لجدولك.`,`You were away ${c.g} days, so today is ${fb?'a light full body':esc(pd.dayName.replace(' · Light',''))+' (light)'} at <b>${cbPct(c.step)}</b> of your pre-break weights. Step ${c.i+1} of ${c.n}, then back to your plan.`)}</div>
  <div class="cbpl">${pd.ex.map(e=>`<div class="cbpr"><span class="sp en">${esc(e.name)}${e.core?' <i class="cbc">★</i>':''}</span><span class="en mu">${e.tsets}×${e.treps}${e.unit?' '+esc(unitTxt(e.unit)):''}</span><b class="en">${e.w&&+e.w?fw(e.w):'—'}</b></div>`).join('')}</div>
  <div class="mu" style="margin:10px 0 14px">${tr('وقّف كل مجموعة وانت لسه قادر على 2–3 عدّات. الجلسة دي مش بتتحسب في قاعدة الزيادة.','Stop each set with 2–3 reps left. This session does not count toward the progression rule.')}</div>
  <div class="row"><button class="btn pri sp" data-a="cbStart">${tr('ابدأ','Start')}</button><button class="btn ghost" data-a="cbWhy">${tr('ليه؟','Why?')}</button></div>`)}
async function startComeback(){
  /* جلسة الرجوع مفتوحة بالفعل: كمّلها */
  if(S.draft&&S.draft.cb&&!S.draft.editing){openSession();return}
  const c=cbNow();if(!c)return;
  if(S.draft&&!dEmpty(S.draft)&&!await ask(T().confNew))return;
  S.draft=null;S.draft=planDraft(c.step.k==='fb'?'FB':nextDayId(),c);
  openTips.clear();save();openSession();
}
/* وزن الشغل: آخر وزن من جلسة عادية (جلسات الرجوع المخففة مابتغيّرش وزنك) */
const baseH=id=>{const hh=exHist(id);return hh.find(x=>!x.cb)||hh[0]};

/* قاعدة الزيادة: الهدف كامل في يومين منفصلين على نفس الوزن */
function progState(t,h){
  h=h.filter(x=>!x.cb&&(x.gym||'main')===gymId());/* v108: جلسات الرجوع مخففة عن قصد: مابتتحسبش في قاعدة الزيادة */
  if(!h.length)return null;
  const W=+h[0].w||0;let q=0,n=0;const ds=new Set();
  for(const x of h){if((+x.w||0)!==W)break;n++;if(x.clean&&!ds.has(x.date)&&x.sets.length>=t.sets&&x.sets.every(r=>r>=t.goal)){ds.add(x.date);q++}}
  if(q>=2)return{k:'up'};if(n>=5)return{k:'stuck',n};if(q===1)return{k:'q1'};return null;
}
const STEP0={bb:2.5,db:2.5,mach:5,cable:5,kb:4,bw:2.5,band:2.5,other:2.5};
const stepOf=n=>{const o=S.steps&&S.steps[nk(n)];if(o>0)return o;const m=typeof META!=='undefined'&&META[n];return STEP0[(m&&m.eq)||'other']||2.5};
function progMsg(t,h,unit,name){
  const p=progState(t,h);if(!p)return null;const L=T();
  if(p.k==='up'){const w=+h[0].w||0,st=name?stepOf(name):0;
    if(!unit&&w>0&&st>0&&st/w>.15)return{c:'mid',t:L.pCtl(st,Math.round(st/w*100))};
    return{c:'ok',t:unit?L.pUpU(t.sets,t.goal):L.pUp(t.sets,t.goal)}}
  if(p.k==='stuck')return{c:'bad',t:L.pStuck(p.n)};
  return{c:'mid',t:L.pQ1(t.sets,t.goal)};
}
/* v114: الهدف بالمدى اللي القاعدة مستنياه: 3×10–12 */
const tgt=(r,g,u)=>esc(String(+r||0))+(!u&&+g>+r?'–'+esc(String(+g)):'');
const durSum=e=>(e.dur||[]).reduce((a,b)=>a+(+b||0),0);
const durLine=e=>e.dur&&e.dur.some(x=>x>0)?tr('الوقت','Time')+': '+e.dur.map(x=>x>0?mmss(x):'—').join(' | ')+' | '+tr('الإجمالي','Total')+' '+mmss(durSum(e)):'';
/* v131: «ملف التسجيل»: كل تفصيلة اتسجلت في الجلسة بتطلع في الكارت والتحليل والنسخة وExcel */
const gymName=id=>!id||id==='main'?'':((S.gyms||[]).find(g=>g.id===id)||{}).name||id;
const hm=t=>new Date(t).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
const rdyTxt=v=>[tr('وحش','poor'),tr('متوسط','OK'),tr('كويس','good')][v];
function sessMeta(s){const a=[];
  if(!s.imp&&s.t0&&s.ts&&s.ts>s.t0){const mn=Math.round((s.ts-s.t0)/60000);a.push(`${hm(s.t0)}–${hm(s.ts)}`+(mn>0&&mn<600?` · ${mn} ${tr('دقيقة','min')}`:''))}
  else if(!s.imp&&s.ts)a.push(hm(s.ts));
  const g=gymName(s.gym);if(g)a.push(tr('الجيم: ','Gym: ')+g);
  if(s.rdy!=null)a.push(tr('النوم والطاقة: ','Sleep/energy: ')+rdyTxt(s.rdy));
  return a}
function exFlags(e,s){const a=[];
  if(e.from)a.push(tr(`بدل ${e.from}`,`instead of ${e.from}`));else if(e.add)a.push(tr('اتضاف في الجلسة','added in session'));
  if(e.ss&&s){const k=s.ex.indexOf(e),nx=s.ex[k+1];if(nx)a.push(tr(`سوبرسيت مع ${nx.name}`,`superset with ${nx.name}`))}
  return a}
function cardText(s){
  const L=[`Cycle ${s.cycle}`,`${s.dayName} — ${s.date}`];
  L.push(...sessMeta(s));
  if(s.cb)L.push(s.cb.dl?tr(`أسبوع خفيف · الأوزان ${cbPct(s.cb)}`,`Light week · weights ${cbPct(s.cb)}`):tr(`رجوع بعد ${s.cb.g} يوم · الأوزان ${cbPct(s.cb)}`,`Back after ${s.cb.g} days · weights ${cbPct(s.cb)}`));L.push('');
  for(const e of s.ex){const f=exFlags(e,s);L.push(e.name+(f.length?` (${f.join(' · ')})`:''));
    L.push(`${fw(e.w)} | ${setsStr(e)}${e.clean?' | '+T().clean:' | '+tr('مش نضيف','not clean')}${e.rir!=null?' | '+tr('فاضل ','RIR ')+(e.rir===3?'3+':e.rir):''}`);
    const dl=durLine(e);if(dl)L.push(dl);if(e.note)L.push(e.note);L.push('')}
  const tot=s.ex.reduce((a,e)=>a+durSum(e),0);if(tot>0)L.push(tr('إجمالي وقت المجموعات: ','Total set time: ')+mmss(tot),'');
  const d=S.program.days.find(x=>x.id===s.day);const c=d?coreNames(d):s.ex.filter(e=>e.core).map(e=>e.name);
  if(c.length)L.push(T().coreLine+': '+c.join(' + '));
  return L.join('\n').trim();
}
function tplCard(d){
  const L=[`Cycle ${calcCycle(d.id)}`,'',d.name,''];
  for(const t of d.ex){const l=baseH(t.id);L.push(t.name);L.push(`${fw(l?l.w:t.w)} | ${t.sets}×${t.reps}${t.unit?' '+unitTxt(t.unit):''}`);if(t.note)L.push(t.note);L.push('')}
  L.push(T().coreLine+': '+coreNames(d).join(' + '));
  return L.join('\n');
}
/* نص منظم للتحليل بالذكاء الاصطناعي */
function aiText(s,skip){
  const L=T(),out=[];
  const dObj=S.program.days.find(x=>x.id===s.day);
  const tpl=dObj?dObj.ex:[];
  const coreAll=tpl.filter(t=>t.core),coreDone=coreAll.filter(t=>s.ex.some(e=>e.exId===t.id)).length;
  out.push(L.aiHead(s.dayName,s.cycle));
  out.push(`${L.aiDate}: ${s.date} (${fmtD(s.date)})`);
  {const m=sessMeta(s).filter(x=>!/^(النوم|Sleep)/.test(x));if(m.length)out.push(m.join(' · '))}
  if(s.rdy!=null)out.push(tr('النوم والطاقة قبل الجلسة: ','Sleep and energy before the session: ')+[tr('وحش','poor'),tr('متوسط','OK'),tr('كويس','good')][s.rdy]);
  if(coreAll.length)out.push(L.aiCore(coreDone,coreAll.length));
  if(s.cb)out.push(tr(`جلسة رجوع بعد غياب ${s.cb.g} يوم (${s.cb.k==='fb'?'جسم كامل':'يوم مخفف'}): الأوزان ${cbPct(s.cb)} من أوزانه قبل الغياب والمجموعات أقل عن قصد، ومابتتحسبش في قاعدة الزيادة.`,`Comeback session after a ${s.cb.g}-day break (${s.cb.k==='fb'?'full body':'light day'}): weights at ${cbPct(s.cb)} of pre-break and fewer sets on purpose; it does not count toward the progression rule.`));
  out.push(L.aiUnits);out.push(L.aiRule);out.push('');
  s.ex.forEach((e,i)=>{
    const u=e.unit?' '+unitTxt(e.unit):'';
    {const f=exFlags(e,s);out.push(`${i+1}. ${e.name}${e.core?' '+L.aiCoreTag:''}${f.length?' ('+f.join(' · ')+')':''}`)}
    out.push(`   ${L.aiTarget}: ${e.tsets||e.sets.length}×${e.treps||''}${u}`);
    out.push(`   ${L.aiWeight}: ${noW(e.w)?(e.unit?'—':L.bw):(+e.w)+' kg'}`);
    out.push(`   ${L.aiSets}: ${e.sets.join(', ')}${u}`);
    if(Array.isArray(e.ws)&&e.ws.some(x=>+x!==+e.w))out.push(`   ${tr('وزن كل مجموعة','Weight per set')}: ${e.ws.map(x=>(+x)+' kg').join(', ')}`);
    {const dl=durLine(e);if(dl)out.push('   '+dl)}
    out.push(`   ${L.aiForm}: ${e.clean?L.aiClean:tr('مش نضيف (مرجحة أو أداء مكسور)','not clean (swinging or broken form)')}`);
    if(e.rir!=null)out.push(`   ${tr('العدّات اللي كانت فاضلة في آخر مجموعة (RIR)','Reps in reserve on the last set (RIR)')}: ${e.rir===3?'3+':e.rir}`);
    const h=exHist(e.exId,skip).filter(x=>x.date<=s.date);const prev=h[0];
    if(prev)out.push(`   ${L.aiLast} (${prev.date}): ${noW(prev.w)?'—':(+prev.w)+' kg'} — ${prev.sets.join('/')}${u}${prev.clean?', '+L.clean:''}`);
    const p=s.cb?null:progState({sets:e.tsets||e.sets.length,goal:e.goal||e.treps||12},[Object.assign({date:s.date},e)].concat(h));
    if(p)out.push(`   ${L.aiStatus}: ${p.k==='stuck'?L.st2.stuck(p.n):L.st2[p.k]}`);
    if(e.note)out.push(`   ${L.aiNote}: ${e.note}`);
    out.push('');
  });
  {const tot=s.ex.reduce((a,e)=>a+durSum(e),0);if(tot>0){out.push(tr('إجمالي وقت المجموعات: ','Total set time: ')+mmss(tot));out.push('')}}
  const miss=tpl.filter(t=>!s.ex.some(e=>e.exId===t.id)).map(t=>t.name);
  if(miss.length)out.push(`${L.aiNotDone}: ${miss.join(', ')}`);
  return out.join('\n').trim();
}
async function copy(t){if(window.Android){try{if(Android.copyText(String(t))){toast(T().copied);return true}}catch(e){}}try{await navigator.clipboard.writeText(t);toast(T().copied);return true}catch(e){const a=document.createElement('textarea');a.value=t;document.body.appendChild(a);a.select();let ok=false;try{ok=document.execCommand('copy')}catch(_){}a.remove();toast(ok?T().copied:T().copyFail);return ok}}
async function shareText(t){
  if(navigator.share){try{await navigator.share({text:t});toast(T().shared);return}catch(e){if(e.name==='AbortError')return}}
  try{await navigator.clipboard.writeText(t);toast(T().copiedInstead)}catch(e){copy(t)}
}

const THEMES={iron:{ar:"ليل",en:"Night",bg:"#0e0e0f"},morning:{ar:"صبح",en:"Morning",bg:"#f3eee5"}};
const fOpen=new Set();document.addEventListener('toggle',e=>{const d=e.target;if(d&&d.dataset&&d.dataset.fk){d.open?fOpen.add(d.dataset.fk):fOpen.delete(d.dataset.fk)}},true);
function migTheme(){const t=S.settings.theme;if(!THEMES[t]){S.settings.theme=(t==='sand'||t==='book')?'morning':'iron';return true}return false}
/* v114: «تراجع» بعد أي مسح: نسخة من البرنامج والسجل قبل المسح، 7 ثواني */
let UND=null;
/* v115: تايمر جولات (شغل/راحة) للكوندشننج: جرس واهتزاز مع كل تغيير */
let RT=null;
function rtModal(){const o=S.settings.rt||{w:180,r:60,n:5};
  modal(`<h3>${tr('تايمر جولات','Round timer')}</h3><div class="mu" style="margin-bottom:10px">${tr('للكوندشننج: شغل وراحة بالجرس','For conditioning: work and rest with a bell')}</div>
  <div class="fgrid"><label class="fld">${tr('الشغل (ثانية)','Work (sec)')}<input class="inp en" id="rtW" inputmode="numeric" value="${o.w}"></label><label class="fld">${tr('الراحة (ثانية)','Rest (sec)')}<input class="inp en" id="rtR" inputmode="numeric" value="${o.r}"></label><label class="fld">${tr('الجولات','Rounds')}<input class="inp en" id="rtN" inputmode="numeric" value="${o.n}"></label></div>
  <div class="rtv" id="rtv"></div><div class="row mt"><button class="btn pri sp" data-a="rtGo">${tr('ابدأ','Start')}</button><button class="btn ghost" data-a="rtStop">${T().close}</button></div>`)}
function rtTick(){if(!RT)return;const el=$('#rtv');const t=(Date.now()-RT.t0)/1000,per=RT.w+RT.r;let k=Math.floor(t/per),in_=t-k*per;
  if(k>=RT.n){rtEnd(true);return}const work=in_<RT.w,rem=Math.ceil(work?RT.w-in_:per-in_),ph=(work?'w':'r')+k;
  if(RT.ph!==ph){if(RT.ph){try{navigator.vibrate&&navigator.vibrate(work?[300]:[150,80,150])}catch(e){}beep(work?1:2)}RT.ph=ph}
  if(el)el.innerHTML=`<div class="rtp ${work?'w':'r'}">${work?tr('شغل','Work'):tr('راحة','Rest')}</div><div class="rtt en">${mmss(rem)}</div><div class="mu">${tr('جولة','Round')} <span class="en">${k+1}/${RT.n}</span></div>`}
function rtEnd(done){clearInterval(RT&&RT.iv);RT=null;wakeOff();const el=$('#rtv');if(el&&done){el.innerHTML=`<div class="rtp w">${tr('خلصت ✓','Done ✓')}</div>`;try{navigator.vibrate&&navigator.vibrate([400,150,400])}catch(e){}beep(3)}}
/* v119: عدّاد البروتين اليومي: أزرار سريعة، من غير حساب سعرات */
const protToday=()=>{const p=S.prot;return p&&p.d===today()?+p.g||0:0};
function protHtml(){const g=protToday(),G=+S.settings.protG||150;
  return `<div class="prt"><span>${tr('بروتين النهارده','Protein today')} <b class="en">${g}/<button class="prg" data-a="protG">${G}</button>g</b></span><span class="prb">${[20,30,40].map(v=>`<button data-a="protAdd" data-v="${v}">+${v}</button>`).join('')}</span></div>`}
/* v120: الأسابيع ورا بعض اللي حققت فيها هدف الـ 3 جلسات (الأسبوع بيبدأ السبت) */
function wkStreak(){const ds=done();if(!ds.length)return 0;const wk=iso=>Math.floor((new Date(iso+'T12:00:00')-new Date('2000-01-01T12:00:00'))/(7*864e5));
  const c={};for(const x of ds){const k=wk(x.date);c[k]=(c[k]||0)+1}const now=wk(today());let n=0,k=now;if((c[k]||0)<3)k--;while((c[k]||0)>=3){n++;k--}return n}
const RULE=()=>tr('قاعدة الزيادة: الوزن بيزيد بس لما تلعب الهدف كامل (زي 3×12) بأداء نضيف في يومين منفصلين على نفس الوزن. بعد الزيادة تدخل بـ 8 عدّات وتبني تاني لحد الهدف. جلسات الرجوع والأسبوع الخفيف مابيتحسبوش.','Progression rule: add weight only after you hit the full target (e.g. 3×12) with clean form on two separate days at the same weight. After the increase, start at 8 reps and build back up. Comeback and deload sessions do not count.');
function ruleModal(){modal(`<h3>${tr('إزاي التطبيق بيحسب الزيادة','How progression works')}</h3><div class="dsec" style="line-height:1.9">${RULE()}</div><div class="mu mt" style="line-height:1.8">${tr('لو 5 جلسات عدّت على نفس الوزن من غير زيادة، التطبيق بيقولك خطوة محددة تعملها. وبعد أي غياب 8 أيام أو أكتر، بيقترح جلسة رجوع.','If 5 sessions pass at one weight without an increase, the app suggests a concrete step. After any break of 8+ days it suggests a comeback session.')}</div><button class="btn w mt" data-a="closeM">${T().close}</button>`)}
/* أول فتحة خالص: 3 خطوات */
function onbModal(step){const st=step||1;
  if(st===1)modal(`<h3>${tr('أهلًا بيك في چيم لوج','Welcome to Gym Log')}</h3><div class="mu" style="margin-bottom:12px">${tr('بتتمرن كام يوم في الأسبوع؟','How many days a week do you train?')}</div>${[['ul2',2],['fb3',3],['ul4',4],['ulppl5',5]].map(([id,n])=>`<button class="btn w mt" data-a="onbSys" data-id="${id}">${esc(sysName(SYSTEMS.find(x=>x.id===id)))}</button>`).join('')}<button class="btn w ghost mt" data-a="onbSkip">${tr('بعدين','Later')}</button>`);
  else modal(`<h3>${tr('حاجتين مهمين','Two things that matter')}</h3><div class="dsec" style="line-height:1.9">${RULE()}</div><div class="dsec" style="line-height:1.9">${tr('أول أسبوع: الأوزان اللي ظاهرة مجرد بداية. اختار وزن تقدر تلعب بيه الهدف بأداء نضيف، والتطبيق هيفتكره ويبني عليه.','First week: the weights shown are only a starting point. Pick a weight you can hit the target with in clean form; the app remembers it and builds from there.')}</div><div class="dsec" style="line-height:1.9">${tr('بياناتك متخزنة على الموبايل ده بس. خد نسخة احتياطية من «الملف» كل فترة.','Your data lives only on this phone. Save a backup from «File» now and then.')}</div><button class="btn pri w mt" data-a="onbDone">${tr('يلا نبدأ','Let\'s start')}</button>`)}
/* v121: كارت صورة للجلسة بنفس الثيم وبيت شعر */
async function cardImg(s){
  await (document.fonts&&document.fonts.ready);const cs=getComputedStyle(document.documentElement),v=k=>cs.getPropertyValue(k).trim()||'#888';
  const W=1080,ex=s.ex.slice(0,9),H=Math.max(1080,520+ex.length*120),c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d');
  g.fillStyle=v('--bg');g.fillRect(0,0,W,H);g.strokeStyle=v('--ac');g.lineWidth=6;g.globalAlpha=.6;g.beginPath();g.arc(W-150,150,90,-Math.PI/2,Math.PI*1.1);g.stroke();g.globalAlpha=1;
  const F='"Figtree","ArUI",sans-serif';g.textBaseline='alphabetic';
  g.fillStyle=v('--tx2');g.font='700 72px '+F;g.textAlign='left';g.direction='ltr';g.fillText(String(s.dayName).replace(/ · Light$/,''),80,170);
  g.fillStyle=v('--mu');g.font='400 36px '+F;g.fillText(`${s.date} · Cycle ${s.cycle}`,80,225);
  let y=330;for(const e of ex){g.fillStyle=v('--tx2');g.font='600 44px '+F;g.fillText(e.name.length>30?e.name.slice(0,29)+'…':e.name,80,y);
    g.fillStyle=v('--ac2');g.font='500 38px '+F;g.fillText(`${noW(e.w)?'—':(+e.w)+' kg'}   ${setsStr(e)}`,80,y+52);y+=120}
  const q=(QSEL&&QSEL.q)||'';if(q){g.fillStyle=v('--mu');g.textAlign='center';g.direction='rtl';g.font='700 44px "BasQ",'+F;q.split('|').slice(0,2).forEach((l,k)=>g.fillText(l.trim(),W/2,H-150+k*62))}
  g.direction='rtl';g.textAlign='right';g.fillStyle=v('--mu');g.font='500 32px '+F;g.fillText('چيم لوج',W-80,H-50);
  return new Promise(r=>c.toBlob(b=>r(b),'image/png'))}
async function shareImg(s){const b=await cardImg(s);if(!b)return;const f=new File([b],`gym-${s.date}.png`,{type:'image/png'});
  try{if(navigator.canShare&&navigator.canShare({files:[f]})){await navigator.share({files:[f]});return}}catch(e){if(e.name==='AbortError')return}
  const u=URL.createObjectURL(b);modal(`<h3>${tr('صورة الجلسة','Session image')}</h3><img class="cimg" src="${u}" alt=""><div class="mu mt">${tr('دوسة مطوّلة على الصورة علشان تحفظها أو تبعتها.','Long-press the image to save or share it.')}</div><div class="row mt"><a class="btn pri sp" href="${u}" download="gym-${s.date}.png">${tr('نزّل الصورة','Download')}</a><button class="btn ghost" data-a="closeM">${T().close}</button></div>`)}
/* v121: مشاركة برنامج بكود: نسخ ولصق */
function progCode(){const days=S.program.days.map(d=>({n:d.name,e:d.ex.map(t=>[t.name,t.sets,t.reps,t.goal,t.unit||'',t.core?1:0])}));return 'GL1:'+btoa(unescape(encodeURIComponent(JSON.stringify(days))))}
function progFromCode(t){const m=String(t||'').trim().match(/GL1:([A-Za-z0-9+/=]+)/);if(!m)throw 0;const a=JSON.parse(decodeURIComponent(escape(atob(m[1]))));if(!Array.isArray(a)||!a.length)throw 0;
  return a.slice(0,10).map((d,k)=>({id:'D'+uid()+k,name:String(d.n||'Day').slice(0,40),ex:(Array.isArray(d.e)?d.e:[]).slice(0,20).map(x=>cleanT({id:uid(),name:String(x[0]||'').slice(0,80),w:lastW(String(x[0]))||((libGet(String(x[0]))||[])[2])||0,sets:x[1],reps:x[2],goal:x[3],unit:x[4],core:!!x[5]})).filter(t=>t.name)}))}
function progShareModal(){modal(`<h3>${tr('مشاركة البرنامج','Share a program')}</h3><div class="mu" style="margin-bottom:8px">${tr('انسخ الكود وابعته لأي حد عنده التطبيق. الكود فيه التمارين والمجموعات بس، مش أوزانك ولا سجلك.','Copy the code and send it to anyone with the app. It holds exercises and sets only, not your weights or log.')}</div>
  <button class="btn pri w" data-a="progCopy">${tr('انسخ كود برنامجي','Copy my program code')}</button>
  <div class="mu" style="margin:16px 0 8px">${tr('أو الصق كود برنامج وصلك:','Or paste a program code you received:')}</div><textarea class="inp" id="pgIn" rows="3" dir="ltr" style="width:100%"></textarea>
  <button class="btn w mt" data-a="progImp">${tr('استورد البرنامج','Import the program')}</button><button class="btn ghost w mt" data-a="closeM">${T().close}</button>`)}
/* v124: صور التقدم: على الموبايل بس (IndexedDB)، مش بتترفع ولا بتدخل النسخة الاحتياطية */
function photoSec(){const a=(S.photos||[]).slice().sort((x,y)=>x.d<y.d?1:-1);
  return `<details class="fsec" data-fk="ph"${fOpen.has('ph')?' open':''}><summary>${tr('صور التقدم','Progress photos')}<span class="pchev">⌄</span></summary><div class="fbody">
  <div class="mu" style="margin-bottom:10px">${tr('الصور على الموبايل ده بس: مش بتترفع لأي مكان، ومش بتدخل في النسخة الاحتياطية. صوّر نفس المكان ونفس الإضاءة كل شهر.','Photos stay on this phone only: never uploaded and not part of backups. Same spot and light every month.')}</div>
  <label class="btn pri w" style="cursor:pointer">${tr('ضيف صورة','Add a photo')}<input type="file" id="phIn" accept="image/*" hidden></label>
  ${a.length?`<div class="phg">${a.map(x=>`<button class="pht" data-a="phOpen" data-id="${esc(x.id)}"><img data-ph="${esc(x.id)}" alt=""><span>${fmtD(x.d)}</span></button>`).join('')}</div>`:''}</div></details>`}
async function phLoad(){for(const im of document.querySelectorAll('img[data-ph]')){if(im.src)continue;try{const b=await idb.get('ph:'+im.dataset.ph);if(b)im.src=URL.createObjectURL(b)}catch(e){}}}
async function phAdd(f){try{const bm=await createImageBitmap(f);const k=Math.min(1,1280/Math.max(bm.width,bm.height)),c=document.createElement('canvas');c.width=Math.round(bm.width*k);c.height=Math.round(bm.height*k);c.getContext('2d').drawImage(bm,0,0,c.width,c.height);
  const b=await new Promise(r=>c.toBlob(r,'image/jpeg',.82));const id=uid();await idb.set('ph:'+id,b);S.photos=S.photos||[];S.photos.push({id,d:today()});fOpen.add('ph');save();renderData();toast(tr('الصورة اتحفظت ✓','Photo saved ✓'))}catch(e){toast(tr('مقدرتش أحفظ الصورة','Could not save the photo'))}}
async function phOpen(id,cmp){const a=(S.photos||[]).slice().sort((x,y)=>x.d<y.d?-1:1),x=a.find(q=>q.id===id);if(!x)return;const first=a[0];
  const u=async i=>{try{const b=await idb.get('ph:'+i);return b?URL.createObjectURL(b):''}catch(e){return ''}};
  const one=await u(id),two=cmp&&first&&first.id!==id?await u(first.id):'';
  modal(`<h3>${fmtD(x.d)}</h3>${two?`<div class="phc"><figure><img src="${two}" alt=""><figcaption>${fmtD(first.d)}</figcaption></figure><figure><img src="${one}" alt=""><figcaption>${fmtD(x.d)}</figcaption></figure></div>`:`<img class="cimg" src="${one}" alt="">`}
  <div class="row mt">${first&&first.id!==id&&!cmp?`<button class="btn sp" data-a="phCmp" data-id="${esc(id)}">${tr('قارن بأول صورة','Compare with the first')}</button>`:''}<button class="btn dan" data-a="phDel" data-id="${esc(id)}">${T().del}</button><button class="btn ghost" data-a="closeM">${T().close}</button></div>`)}
function gymHtml(){const G=[{id:'main',name:tr('جيمي','My gym')}].concat((S.gyms||[]).filter(g=>!g.del)),cur=gymId();
  return `<div class="gyr"><span>${tr('الجيم','Gym')}:</span>${G.map(g=>`<button class="${g.id===cur?'on':''}" data-a="gymSet" data-id="${esc(g.id)}">${esc(g.name)}</button>`).join('')}<button data-a="gymAdd">${tr('تعديل','Edit')}</button></div>`}
function toolsModal(){const n=wkStreak();modal(`<h3>${tr('أدوات','Tools')}</h3>
  <div class="mu" style="margin-bottom:10px">${T().weekOf(done().filter(s=>daysAgo(s.date)>=0&&daysAgo(s.date)<7).length)}${n>=2?` · <span class="stk">${tr(`${n} أسابيع ورا بعض حققت الهدف`,`${n} weeks in a row on target`)}</span>`:''}</div>
  <button class="mrow" data-a="rtOpen"><i>◴</i>${tr('تايمر جولات (كارديو ولياقة)','Round timer (cardio & conditioning)')}</button>
  <button class="mrow" data-a="rule"><i>?</i>${tr('إزاي التطبيق بيحسب الزيادة؟','How is progression decided?')}</button>
  <button class="mrow" data-a="rep" data-d="7"><i>▤</i>${tr('تقرير الأسبوع','Weekly report')}</button>
  <button class="mrow" data-a="gymAdd"><i>⌂</i>${(S.gyms||[]).length?tr('ضيف جيم تاني','Add another gym'):tr('بتتمرن في أكتر من جيم؟','Train at more than one gym?')}</button>
  <button class="btn ghost w mt" data-a="closeM">${T().close}</button>`)}
function cbWhy(){const c=cbNow();if(!c)return;const nm=s=>s.k==='fb'?tr('جسم كامل','Full body'):tr('يوم مخفف','Light day');
  modal(`<h3>${tr(`رجوع بعد ${c.g} يوم`,`Back after ${c.g} days`)}</h3><div class="dsec" style="line-height:1.9">${tr('بعد الغياب قوتك لسه موجودة، لكن عضلاتك وأوتارك مش متعودة على الشد. فبترجع على خطوات: مجموعات أقل وأوزان أخف، ووقّف وانت لسه قادر على 2–3 عدّات. الجلسات دي مابتتحسبش في قاعدة الزيادة، وبعدها أوزانك بترجع لوحدها.','After a break your strength is still there, but muscles and tendons are no longer used to the load. So you come back in steps: fewer sets, lighter weights, stopping with 2–3 reps left. These sessions do not count toward the rule, and your weights return on their own afterwards.')}</div>
  <div class="cbs" dir="${LANG==='ar'?'rtl':'ltr'}">${c.st.map((s,k)=>`<span class="${k<c.i?'ok':k===c.i?'on':''}">${k<c.i?'✓ ':''}${nm(s)} <bdi class="en">${cbPct(s)}</bdi></span>`).join('<i>›</i>')}<i>›</i><span>${tr('جدولك','Your plan')}</span></div>
  <button class="btn ghost w mt" data-a="closeM">${T().close}</button>`)}
function dlWhy(){modal(`<h3>${tr('أسبوع خفيف','Light week')}</h3><div class="dsec" style="line-height:1.9">${tr('بعد 6 أسابيع تمرين ورا بعض، التعب بيتراكم حتى لو مش حاسس بيه. أسبوع خفيف (مجموعة أقل في كل تمرين، والأوزان 90%) بيخلّي جسمك يتخلص منه ويرجع أقوى. ومابيتحسبش في قاعدة الزيادة.','After 6 straight weeks fatigue builds up even if you do not feel it. A light week (one set less, 90% weights) lets your body clear it and come back stronger. It does not count toward the rule.')}</div><button class="btn ghost w mt" data-a="closeM">${T().close}</button>`)}
/* v134: أي نافذة شرح («ليه؟» / إزاي بيحسب الزيادة / دليل التطبيق) بتفتح بلغة الشرح المختارة في الإعدادات (howLang)،
   مش بلغة الواجهة. وجوّاها زرار عربي/English للنافذة دي بس (من غير ما يغيّر الإعداد) */
function xModal(k,l){const f={rule:ruleModal,cb:cbWhy,dl:dlWhy}[k];if(!f)return;const lg=l==='ar'||l==='en'?l:howLang(),keep=LANG;
  LANG=lg;try{f()}finally{LANG=keep}
  const bx=$('#modal .mbox'),h=bx&&bx.querySelector(':scope>h3');if(!h||$('#modal').hidden)return;
  bx.setAttribute('dir',lg==='ar'?'rtl':'ltr');bx.setAttribute('lang',lg);
  const w=document.createElement('div');w.className='gdh2';h.replaceWith(w);w.appendChild(h);
  w.insertAdjacentHTML('beforeend',`<div class="thseg gdl"><button class="${lg==='ar'?'on':''}" data-a="xLang" data-l="ar" data-x="${k}">عربي</button><button class="${lg==='en'?'on':''}" data-a="xLang" data-l="en" data-x="${k}">English</button></div>`)}
const swRow=(a,on,t,d)=>`<button class="swr" data-a="${a}" data-k="${on?'off':'on'}" role="switch" aria-checked="${on?'true':'false'}"><span class="swt2"><b>${t}</b><small>${d}</small></span><i class="swk${on?' on':''}"></i></button>`;
function offerUndo(msg,snap){const el=$('#undo');if(!el)return;UND=snap;el.querySelector('span').textContent=msg;const b=el.querySelector('button');b.textContent=tr('تراجع','Undo');
  b.onclick=()=>{if(!UND)return;const o=JSON.parse(UND);UND=null;Object.assign(S,o);if(!o.fbDay)delete S.fbDay;save();queueBackup();el.classList.remove('on');if(!$('#sess').hidden&&!S.draft)closeSession();else if(S.draft&&$('#sess').hidden&&o.draft&&tab==='home')renderHome();go(tab);toast(tr('رجعت ✓','Restored ✓'))};
  el.classList.add('on');clearTimeout(offerUndo.t);offerUndo.t=setTimeout(()=>{el.classList.remove('on');UND=null},7000)}
const undoSnap=()=>JSON.stringify({program:S.program,sessions:S.sessions,draft:S.draft||null,fbDay:S.fbDay||null});
function applyFs(){const k=+(S&&S.settings&&S.settings.fs)||1;if(k>1)document.documentElement.dataset.fs=k;else delete document.documentElement.dataset.fs}
function applyTheme(){applyFs();const t=THEMES[S.settings.theme]?S.settings.theme:'iron';document.documentElement.dataset.th=t;const m=document.querySelector('meta[name=theme-color]');if(m)m.content=THEMES[t].bg;try{window.Android&&Android.setBarsTheme(t!=='morning')}catch(e){}}
/* ================= التنقل ================= */
let tab='home';
const TABICO=['<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>','<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>','<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>','<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12"/></svg>','<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/></svg>'];
function applyLang(){applyTheme();
  const L=T();document.documentElement.lang=LANG;document.documentElement.dir=LANG==='ar'?'rtl':'ltr';document.title=L.title;
  $('#brand').innerHTML=L.brand;$('#updBtn').textContent=L.update;
  document.querySelectorAll('.tabs button').forEach((b,i)=>{b.innerHTML=TABICO[i]+'<span>'+L.tabs[i]+'</span>'});
}
function saveUI(){try{localStorage.setItem('gymlog.ui',JSON.stringify({t:tab,s:!$('#sess').hidden,y:window.scrollY,at:Date.now()}))}catch(e){}}
/* الدامبل: بيت جديد من غير ما يدخل أي صفحة */
let nqBusy=false;
function newQuote(){
  if(nqBusy)return;
  const lg=document.querySelector('.brand .lg');
  if(lg){lg.classList.remove('spin');void lg.getBoundingClientRect();lg.classList.add('spin');setTimeout(()=>lg.classList.remove('spin'),1000)}
  if(tab!=='home')return;
  nqBusy=true;const old=document.querySelector('.qt');if(old)old.classList.add('qout');
  setTimeout(()=>{
    QSEL=null;if(tab==='home')renderHome();
    const q=document.querySelector('.qt');if(q)q.classList.add('qin');
    setTimeout(()=>{nqBusy=false},900)},old?460:0)}
function openCredits(){
  modal(`<div class="cr en">
  <svg class="crl" viewBox="0 0 34 22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M11 11h12"/><rect x="5" y="5" width="4" height="12" rx="1.2" fill="currentColor"/><rect x="25" y="5" width="4" height="12" rx="1.2" fill="currentColor"/><path d="M2 8.5v5M32 8.5v5"/></svg>
  <div class="crn">چيم لوج</div>
  <div class="crd"></div>
  <div class="crk">AN APP MADE BY</div>
  <div class="cra">Ahmed Maher</div>
  <a class="crf" href="https://www.facebook.com/share/1HWtZibWS7/" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M13.5 22v-8h2.7l.5-3.4h-3.2V8.5c0-1 .4-1.7 1.8-1.7h1.5V3.9c-.3 0-1.2-.2-2.2-.2-2.3 0-3.9 1.4-3.9 4v2.5H7.5V14h2.9v8z"/></svg><span>Facebook</span><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg></a>
  <div class="crv">v${VER}</div></div>`)}
/* زرار الرجوع في تطبيق الأندرويد: الويب بيتصرف الأول، ولو إنت في الرئيسية بيسأل «تخرج؟» */
window.__glSaved=ok=>{const bk=window.__glBk;window.__glBk=false;if(ok&&bk){markBackup();refresh();toast(T().savedFile)}else toast(ok?T().saved:tr('مقدرتش أحفظ الملف','Could not save the file'))};
function exitAsk(){
  modal(`<div style="text-align:center;font-weight:700;font-size:18px;margin:6px 0 18px">${tr('تخرج؟','Exit the app?')}</div><div style="display:flex;gap:10px"><button class="btn w" id="xNo">${tr('لأ','Stay')}</button><button class="btn w pri" id="xYes">${tr('خروج','Exit')}</button></div>`);
  $('#xNo').onclick=()=>closeModal();
  $('#xYes').onclick=()=>{try{Android.exitApp()}catch(e){}};
}
window.glBack=function(){
  if(XP.el){xpClose();return true}
  {const a=document.getElementById('ask');if(a){const n=a.querySelector('.no');n&&n.click();return true}}
  const M=$('#modal'),Sx=$('#sess');
  if(!M.hidden){if(hs().modal)history.back();else closeModal(true);return true}
  if(!Sx.hidden){if(hs().sess)history.back();else closeSession();return true}
  if(tab!=='home'){go('home');return true}
  exitAsk();return true;
};
/* زرار الرجوع في الموبايل: يرجّع خطوة جوّه التطبيق بدل ما يخرج */
const hs=()=>history.state||{};
function navTab(t){
  if(t===tab){go(t);return}
  history.pushState({tab:t},'');
  go(t);
}
window.addEventListener('popstate',e=>{
  const st=e.state||{},M=$('#modal'),Sx=$('#sess');
  if(st.modal){if(M.hidden)history.back();return}
  const wasM=!M.hidden||Date.now()-mClosed<1500;M.hidden=true;
  if(!st.sess&&!Sx.hidden){wakeOff();Sx.hidden=true;document.body.style.overflow='';if(S.draft)queueDraftBackup();if(tab==='home')renderHome()}
  /* قفل نافذة بس: الصفحة زي ما هي (من غير ما المفتوح فيها يتقفل) */
  if(Sx.hidden&&!(wasM&&(st.tab||'home')===tab))go(st.tab||'home');
});
try{history.replaceState({},'')}catch(e){}
function go(t){tab=t;document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('on',b.dataset.tab===t));({home:renderHome,hist:renderHistory,prog:renderProgram,lib:renderLib,data:renderData})[t]();{const v=$('#view');v.classList.remove('vin');void v.offsetWidth;v.classList.add('vin')}window.scrollTo(0,0);saveUI()}
function modal(h){const m=$('#modal'),bx=m.querySelector('.mbox');bx.removeAttribute('dir');bx.removeAttribute('lang');bx.innerHTML=h;if(m.hidden&&!hs().modal)history.pushState(Object.assign({tab:tab},hs(),{modal:1}),'');m.hidden=false}
let mClosed=0;
function closeModal(silent){$('#modal').hidden=true;mClosed=Date.now();if(!silent&&hs().modal)history.back()}

/* ================= الرئيسية (v57: دايرة واحدة) ================= */
const arcP=(r,a0,a1)=>{const p=a=>{const t=(a-90)*Math.PI/180;return[150+r*Math.cos(t),150+r*Math.sin(t)]};const[x0,y0]=p(a0),[x1,y1]=p(a1);return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${a1-a0>180?1:0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`};
/* جملة الشاشة الرئيسية: بتتختار مرة واحدة كل فتحة/ريفريش حسب الحالة (الملف quotes.js) */
let QSEL=null,QH=[],QI=-1;
const qGestOn=()=>S.settings.qGest!==0;
const quoteHtml=q=>`<div class="qt">${q.split('|').map(x=>`<span>${esc(x.trim())}</span>`).join('')}</div>`;
function pickQuote(st,wk){
  const Q=window.BAS_Q;if(!Q)return '';
  const hr=new Date().getHours(),pools=[[Q[st],6]];
  if(wk>=4&&Q.fire)pools.push([Q.fire,2]);
  if((hr>=23||hr<4)&&Q.night)pools.push([Q.night,2]);
  if(Q.any&&st!=='live')pools.push([Q.any,3]);
  let all=[];for(const [p,w] of pools)if(p)for(let i=0;i<w;i++)all=all.concat(p);
  let last='';try{last=localStorage.getItem('bas_q_last')||''}catch(e){}
  let c=all.filter(x=>x!==last);if(!c.length)c=all;if(!c.length)return '';
  const q=c[Math.floor(Math.random()*c.length)];
  try{localStorage.setItem('bas_q_last',q)}catch(e){}
  return q}
function pushQuote(q){QH.push(q);if(QH.length>60)QH.shift();QI=QH.length-1}
function homeQuote(ds,wk,dr){
  if(!window.BAS_Q)return '';
  const k=ds[0]?Math.max(0,daysAgo(ds[0].date)):-1;
  const st=dr?'live':k<0?'start':k===0?'today':k===1?'d1':k===2?'d2':k<=4?'d3':k<=7?'d5':k<=14?'d8':'d15';
  if(QSEL&&QSEL.st===st)return QSEL.h;
  const q=pickQuote(st,wk);if(!q)return '';
  pushQuote(q);const h=quoteHtml(q);QSEL={st,h,wk,q};return h}
/* بيت الشعر: دوسة = نسخ، سحب شمال = البيت اللي قبله، سحب يمين = اللي بعده */
function quoteNav(d){
  if(tab!=='home'||nqBusy||!QSEL)return;
  let q;
  const el=document.querySelector('.qt');if(!el)return;
  if(d<0){if(QI<=0){el.classList.remove('qbl','qbr');void el.offsetWidth;el.classList.add('qbl');return}QI--;q=QH[QI]}
  else if(QI<QH.length-1){QI++;q=QH[QI]}
  else{q=pickQuote(QSEL.st,QSEL.wk);if(!q)return;pushQuote(q)}
  nqBusy=true;el.classList.remove('qi-fr','qi-fl','qin','qbl');el.classList.add(d<0?'qx-l':'qx-r');
  setTimeout(()=>{const h=quoteHtml(q);QSEL.h=h;QSEL.q=q;const e2=document.querySelector('.qt');if(e2){e2.outerHTML=h;const n=document.querySelector('.qt');if(n)n.classList.add(d<0?'qi-fr':'qi-fl')}setTimeout(()=>{nqBusy=false},300)},230)}
function copyQuote(el){
  const t=[...el.querySelectorAll('span')].map(x=>x.textContent.trim()).join('\n');
  const ok=()=>toast(tr('اتنسخ ✓','Copied ✓'));
  const fb=()=>{try{const a=document.createElement('textarea');a.value=t;a.style.cssText='position:fixed;opacity:0;top:0';document.body.appendChild(a);a.select();document.execCommand('copy');a.remove();ok()}catch(e){}};
  try{navigator.clipboard.writeText(t).then(ok,fb)}catch(e){fb()}}
let qx=0,qy=0,qOn=false,qSw=0;
document.addEventListener('touchstart',e=>{qOn=qGestOn()&&tab==='home'&&e.touches.length===1&&!!e.target.closest('.qt');if(qOn){qx=e.touches[0].clientX;qy=e.touches[0].clientY}},{passive:true});
document.addEventListener('touchend',e=>{if(!qOn)return;qOn=false;const t=e.changedTouches[0],dx=t.clientX-qx,dy=t.clientY-qy;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.5){qSw=Date.now();quoteNav(dx<0?-1:1)}},{passive:true});
function renderHome(){const _d=document.querySelector('#home .dtl, .dtl'),_o=_d&&_d.open,_y=window.scrollY;renderHome0();if(_o){const d=document.querySelector('.dtl');if(d){d.open=true;window.scrollTo(0,_y)}}}
function renderHome0(){
  /* v129: الدايرة هي مركز كل حاجة. لو فيه رجوع أو أسبوع خفيف، الدايرة نفسها بتبقى الجلسة دي، وتحتها سطر هادي بالشرح ولينك «يومك العادي» */
  const L=T(),ds=done(),c=cbNow(),dlx=c?null:dlNow(),dcb=!!(S.draft&&S.draft.cb&&!S.draft.editing),dr=S.draft;
  const mode=dr?'draft':c?'cb':dlx&&!dlx.skip?'dl':'norm';
  /* v134: لو اخترت يومك العادي (أو أجّلت)، الاختيار التعويضي بيفضل موجود تحت الدايرة لحد ما تبدأ تسجّل */
  const nd=dr?(dr.day||nextDayId()):mode==='cb'&&c.step.k==='fb'?'FB':nextDayId(),fb=nd==='FB';
  const pl=dr||(mode==='cb'?planDraft(nd,c):mode==='dl'?(()=>{const x=planDraft(nd,{g:0,i:0,n:1,step:{k:'lt',p:.9}});x.cb.dl=1;return x})():planDraft(nd,null));
  const dName=fb?tr('جسم كامل','Full body'):String(pl.dayName||'').replace(/ · Light$/,'');
  const wk=ds.filter(s=>daysAgo(s.date)>=0&&daysAgo(s.date)<7).length,days=S.program.days,cc=+pl.cycle||pl.cycle;
  const n=days.length,g=n>1?9:0;
  const arcs=n>1&&!fb?days.map((x,k)=>{const dn=x.id!==nd&&ds.some(q=>q.cycle===cc&&(q.day===x.id||(!q.day&&q.dayName===x.name)));
    const pd=arcP(136,k*360/n+g/2,(k+1)*360/n-g/2);return (x.id===nd?`<path class="ar hl" d="${pd}"/>`:'')+`<path class="ar${x.id===nd?' cur':dn?' dn':''}" d="${pd}"/>`}).join('')
    :`<circle class="ar cur one" cx="150" cy="150" r="136"/><g class="cmt" style="animation-delay:-${((Date.now()%7000)/1000).toFixed(2)}s">${Array.from({length:24},(_,k)=>`<circle class="ct" cx="150" cy="150" r="136" pathLength="100" stroke-dasharray="1.34 98.66" stroke-dashoffset="${-(k*1.3).toFixed(2)}" style="opacity:${(.04+.96*Math.pow((k+1)/24,2.2)).toFixed(3)}"/>`).join('')}<circle class="ch" cx="150" cy="150" r="136" pathLength="100" stroke-dasharray="1.2 98.8" stroke-dashoffset="-31"/></g>`;
  let last='';
  if(ds[0]){const k=Math.max(0,daysAgo(ds[0].date));last=' · '+tr('آخر جلسة: ','Last: ')+(k===0?tr('النهارده','today'):k===1?tr('امبارح','yesterday'):tr(`من ${k} يوم`,`${k} days ago`))}
  const rowsOf=ex=>ex.map(e=>`<div class="dr${e.core?' c':''}"><span class="dn2 en">${esc(e.name)}</span><span class="dw en">${e.unit?'':fw(e.w)+' · '}${esc(String(+e.tsets||0))}×${tgt(e.treps,e.goal,e.unit)}${e.unit?' '+esc(unitTxt(e.unit)):''}</span></div>`).join('');
  const coreOf=ex=>`<div class="coreline">${L.coreL}: <span class="en">${esc(ex.filter(e=>e.core).map(e=>e.name).join(' + '))}</span></div>`;
  const cbk=pl.cb?(pl.cb.dl?tr('أسبوع خفيف','Light week'):tr('رجوع','Comeback'))+' · <bdi class="en">'+cbPct(pl.cb)+'</bdi> · ':'';
  const tag=dr?cbk+L.resume:cbk+L.exN(pl.ex.length)+`</span><span class="on3">${tr('دوس للبدء','tap to start')}`;
  const act=dr?'resume':mode==='cb'?'cbGo':mode==='dl'?'dlGo':'start';
  /* سطر هادي تحت الدايرة */
  let q='';
  /* v137: طول ما الرجوع (أو الأسبوع الخفيف) شغال، السطر ده بيفضل تحت الدايرة: «ليه؟» + زرار يدخلك التمرين التعويضي على طول، مهما اخترت قبلها */
  const inCb=!!(dcb&&!dr.cb.dl),inDl=!!(dcb&&dr.cb.dl);
  if(c){const go=inCb?'':` · <button class="cbgo2" data-a="cbSwap">${c.step.k==='fb'?tr('العب الفول بادي','Play the full body'):tr('العب اليوم المخفف','Play the light day')} ${LANG==='ar'?'‹':'›'}</button>`;
    q=`<div class="cbq">${tr(`رجعت بعد ${c.g} يوم`,`Back after ${c.g} days`)} · <button data-a="cbWhy">${tr('ليه؟','Why?')}</button>${go}${!dr&&mode==='cb'?` · <button data-a="start" data-d="${esc(nextDayId())}">${tr('يومك العادي','Your usual day')}</button>`:''}</div>`}
  else if(dlx||inDl){const go=inDl?'':` · <button class="cbgo2" data-a="dlGo">${tr('العب يوم خفيف','Play a light day')} ${LANG==='ar'?'‹':'›'}</button>`;
    q=`<div class="cbq">${dlx&&dlx.act?tr(`أسبوع خفيف · فاضل ${dlx.left} يوم`,`Light week · ${dlx.left} day(s) left`):dlx?tr(`${dlx.wk} أسابيع تمرين متواصل`,`${dlx.wk} weeks in a row`):tr('أسبوع خفيف','Light week')} · <button data-a="dlWhy">${tr('ليه؟','Why?')}</button>${go}${!dr&&dlx&&!dlx.act&&!dlx.skip?` · <button data-a="dlSkip">${tr('مش دلوقتي','Not now')}</button>`:''}</div>`}
  else if(!dr&&new Date().getDay()===6&&ds.some(x=>daysAgo(x.date)>=1&&daysAgo(x.date)<=7))q=`<div class="cbq">${tr('أسبوعك اللي فات','Your last week')}: ${ds.filter(x=>daysAgo(x.date)>=1&&daysAgo(x.date)<=7).length}/3 · <button data-a="rep" data-d="7">${tr('التقرير','Report')} ›</button></div>`;
  let al='';
  if(syncPublic())al+=`<div class="warn">${L.syncPub}</div>`;
  if(SYNC.on&&SYNC.missed>=3)al+=`<div class="warn">${L.syncMiss}</div>`;
  const lb=S.settings.lastBackup;
  if(ds.length&&!SYNC.on&&(!lb||Date.now()-lb>7*864e5))al+=`<div class="bkn"><div>${lb?L.bkAgo(Math.floor((Date.now()-lb)/864e5)):L.bkNone}</div><button class="btn sm" data-a="backup">${L.bkNowBtn}</button></div>`;
  const h=`<div class="homew"><div class="hs">
    <button class="orb" data-a="${act}"${act==='start'?` data-d="${esc(nd)}"`:''}>
      <svg viewBox="0 0 300 300" aria-hidden="true">${arcs}</svg>
      <span class="oc"><span class="on1${dName.length>11?' lg':''}"><bdi>${esc(dName)}</bdi></span><span class="on2">${tag}</span></span>
    </button>
    <div class="oline"><span>${tr('الدورة','Cycle')} <bdi class="en">${cc}</bdi></span>${last}</div>
    ${q}
    ${homeQuote(ds,wk,dr)}
    </div>
    <details class="dtl"><summary>${tr('التفاصيل','Details')}${al?'<i class="aldot"></i>':''}</summary>
      <div class="dl">${rowsOf(pl.ex)}</div>
      ${coreOf(pl.ex)}
      ${protHtml()}
      ${(S.gyms||[]).some(g=>!g.del)?gymHtml():''}
      ${al}
      <div class="dlk2"><details class="alt"><summary>${dr?L.newInstead:L.otherDay}</summary><div class="grid3 mt">${days.filter(x=>dr||x.id!==nd||mode!=='norm').map(x=>`<button class="btn${x.id===nextDayId()?' rec':''}" data-a="start" data-d="${x.id}"><bdi>${esc(x.name)}</bdi></button>`).join('')}</div></details>
      <button class="plink" data-a="tools">${tr('أدوات','Tools')} ›</button></div>
    </details>
  </div>`;
  $('#view').innerHTML=h;
}

/* ================= الجلسة ================= */
function draftEx(t,src){const hh=exHist(t.id,S.draft&&S.draft.editing),g=gymId(),h=hh.find(x=>!x.cb&&x.gym===g)||hh.find(x=>!x.cb)||hh[0];return{exId:t.id,name:t.name,unit:t.unit||'',core:!!t.core,goal:t.goal,tsets:t.sets,treps:t.reps,note0:t.note||libHow(t.name),w:src?src.w:(h?h.w:t.w),sets:src?src.sets.map(String):Array(t.sets).fill(''),ss:!!(src?src.ss:t.ss),ws:src&&src.ws?src.ws.map(String):[],add:src?src.add:undefined,from:src?src.from:undefined,rir:src&&src.rir!=null?src.rir:null,dur:src&&src.dur?src.dur.slice():[],clean:src?!!src.clean:true,note:src?src.note||'':''}}
async function startSession(id){
  if(S.draft&&!dEmpty(S.draft)&&!await ask(T().confNew))return;
  const pd=planDraft(id,id==='FB'?cbNow():null);
  if(!pd.ex.length){toast(tr('اليوم ده فاضي. ضيف تمارين من «البرنامج» الأول','This day is empty. Add exercises in Program first'));return}
  S.draft=pd;
  openTips.clear();save();openSession();
}
async function editSession(id){
  const s=S.sessions.find(x=>x.id===id);if(!s)return;
  if(S.draft&&!await ask(T().confEditOver))return;
  const d=S.program.days.find(x=>x.id===s.day);
  S.draft={t0:s.t0,gym:s.gym,id:s.id,editing:s.id,date:s.date,day:s.day,dayName:s.dayName,cycle:s.cycle,ex:[]};if(s.cb)S.draft.cb=s.cb;
  const ex=s.ex.map(e=>{const t=d&&d.ex.find(x=>x.id===e.exId)||{id:e.exId,name:e.name,unit:e.unit,core:e.core,goal:e.goal,sets:e.tsets||e.sets.length,reps:e.treps||e.sets[0],note:''};return draftEx(t,e)});
  if(d)for(const t of d.ex)if(!ex.some(e=>e.exId===t.id)){const e=draftEx(t);if(s.cb)cbApply(e,s.cb);ex.push(e)}
  S.draft.ex=ex;openTips.clear();save();closeModal(true);openSession();
}
function openSession(){setTimeout(askReady,450);if(!S.draft||!S.draft.ex.length){S.draft=null;save();if(tab==='home')renderHome();return}const dd=S.draft,k0=dd.ex.findIndex(e=>!fullyIn(e));curEx=dd.editing?0:(k0<0?dd.ex.length-1:k0);finishing=false;renderSession();$('#sess').hidden=false;$('#sess').classList.remove('in');void $('#sess').offsetWidth;$('#sess').classList.add('in');$('#sess').scrollTop=0;document.body.style.overflow='hidden';wakeOn();if(!hs().sess){const n=Object.assign({tab:tab},hs(),{sess:1});delete n.modal;if(hs().modal)history.replaceState(n,'');else history.pushState(n,'')}saveUI()}
/* v128: سؤال النوم والطاقة مرة واحدة أول الجلسة، في شيت صغير */
function askReady(){const d=S.draft;if(!d||d.editing||d.rdy!=null||d.rdyAsk||d.ex.some(x=>x.sets.some(v=>num(v)>0)))return;const sh=$('#sheet');if(!sh)return;sh.hidden=false;sh.innerHTML=`<div class="sbk" data-a="rdySkip"></div><div class="sbx"><div class="mgh">${tr('نومك وطاقتك النهارده؟','Sleep and energy today?')}</div><div class="rdy2">${[[2,tr('كويس','Good')],[1,tr('متوسط','OK')],[0,tr('وحش','Poor')]].map(([v,t])=>`<button data-a="rdyGo" data-v="${v}">${t}</button>`).join('')}</div><button class="mrow sk" data-a="rdySkip">${tr('تخطّي','Skip')}</button></div>`}
let WL=null;async function wakeOn(){try{window.Android&&Android.keepAwake(true)}catch(e){}try{if('wakeLock' in navigator&&!WL&&!document.hidden){WL=await navigator.wakeLock.request('screen');WL.addEventListener('release',()=>{WL=null})}}catch(e){}}
function wakeOff(){try{window.Android&&Android.keepAwake(false)}catch(e){}try{WL&&WL.release()}catch(e){}WL=null}
function closeSession(){wakeOff();swHalt();flushSave();$('#sess').hidden=true;document.body.style.overflow='';if(tab==='home')renderHome();saveUI();if(hs().sess)history.back()}
const openTips=new Set();
/* ===== شاشة التمرين (v57): تمرين واحد في الشاشة ===== */
let curEx=0,pk=null,swIv=null,wAnim=false,finishing=false;
/* v89: ساعة الإيقاف: دوسة تبدأ، دوسة توقف وتسجّل المدة تحت المجموعة، ودوسة تبدأ اللي بعدها */
const mmss=s=>{s=Math.max(0,Math.round(+s||0));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
const swNext=e=>{for(let j=0;j<e.sets.length;j++)if(!(num(e.sets[j])>0))return j;return e.sets.length};
/* v115: عدّاد الراحة: بيبدأ لوحده بعد كل مجموعة. مركّب 2:30، عزل 1:30، ثبات 1:00 */
const restFor=e=>(S.settings.ram?30:0)+(e.unit?60:(typeof META!=='undefined'&&META[e.name]&&META[e.name].kind==='comp')?150:90);
let rsIv=null,AC=null;
function beep(n){try{AC=AC||new (window.AudioContext||window.webkitAudioContext)();for(let k=0;k<(n||1);k++){const o=AC.createOscillator(),g=AC.createGain();o.frequency.value=880;o.connect(g);g.connect(AC.destination);const t=AC.currentTime+k*.25;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.25,t+.02);g.gain.exponentialRampToValueAtTime(.0001,t+.18);o.start(t);o.stop(t+.2)}}catch(e){}}
function restStart(e){const d=S.draft;if(!d||!e)return;d.rest={t0:Date.now(),dur:restFor(e)};saveSoon();if(!rsIv)rsIv=setInterval(restTick,250);restTick()}
function restTick(){const d=S.draft,el=$('#rst');if(!d||!d.rest){clearInterval(rsIv);rsIv=null;if(el)el.innerHTML='';return}
  const r=d.rest,rem=Math.ceil(r.dur-(Date.now()-r.t0)/1000);
  if(rem<=0&&!r.done){r.done=1;saveSoon();try{navigator.vibrate&&navigator.vibrate([220,120,220])}catch(e){}beep(2)}
  if(rem<-12){d.rest=null;saveSoon();clearInterval(rsIv);rsIv=null;if(el)el.innerHTML='';return}
  if(!el)return;const pc=Math.max(0,Math.min(100,(1-rem/r.dur)*100));
  el.innerHTML=rem>0?`<div class="rsb"><i style="width:${pc.toFixed(1)}%"></i></div><div class="rsr"><span>${tr('راحة','Rest')} <b class="en">${mmss(rem)}</b></span><button data-a="rsAdd">+30</button><button data-a="rsSkip">${tr('تخطّي','Skip')}</button></div>`:`<div class="rsr go"><span>${tr('يلا المجموعة الجاية','Next set')} ✓</span></div>`}
/* الإحماء للتمارين المركّبة التقيلة: 50%×8 · 70%×4 · 85%×2 */
function warmTxt(e){const w=num(e.w),m=typeof META!=='undefined'&&META[e.name];if(e.unit||!(w>=20)||!m||m.kind!=='comp')return '';const st=stepOf(e.name);
  const seen=new Set();return [[.5,8],[.7,4],[.85,2]].map(([p,r])=>[Math.max(st,Math.round(w*p/st)*st),r]).filter(([x])=>x<w&&!seen.has(x)&&seen.add(x)).map(([x,r])=>`${x}×${r}`).join(' · ')}
/* خط بياني ناعم */
function lineSvg(vals,lbl){if(vals.length<2)return '';const W=300,H=90,mn=Math.min(...vals),mx=Math.max(...vals),sp=mx-mn||1;
  const pts=vals.map((v,k)=>[34+k*(W-42)/(vals.length-1),H-10-(v-mn)/sp*(H-24)]);
  return `<svg class="lsv" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(lbl||'')}"><polyline points="${pts.map(p=>p.map(x=>x.toFixed(1)).join(',')).join(' ')}"/>${pts.map((p,k)=>k===pts.length-1||vals[k]===mx?`<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.5"/>`:'').join('')}<text x="4" y="12">${+mx.toFixed(1)}</text><text x="4" y="${H-1}">${+mn.toFixed(1)}</text></svg>`}
const e1rm=(w,r)=>w>0&&r>0?w*(1+Math.min(r,15)/30):0;
function swHalt(){clearInterval(swIv);swIv=null}
function swTick(){const d=S.draft,t=$('#swT');if(!d||!d.sw){swHalt();return}if(t)t.textContent=mmss((Date.now()-d.sw.t0)/1000)}
function swRecord(){
  const d=S.draft;if(!d||!d.sw)return;const e=d.ex[d.sw.i];
  if(e){const sec=Math.max(1,Math.round((Date.now()-d.sw.t0)/1000)),j=swNext(e);
    e.dur=(e.dur||[]).slice();while(e.dur.length<e.sets.length)e.dur.push(0);
    if(j>=e.sets.length){e.sets.push('');e.dur.push(0)}
    e.dur[j]=sec;if(!(num(e.sets[j])>0))e.sets[j]=String(e.unit==='ث'?sec:e.unit==='د'?Math.max(1,Math.round(sec/60)):e.treps)}
  d.sw=null;swHalt();if(e)restStart(e);
}
function swTap(){
  const d=S.draft;if(!d)return;const was=d.sw&&d.sw.i===curEx;
  if(d.sw)swRecord();
  if(!was){d.sw={i:curEx,t0:Date.now()};swIv=setInterval(swTick,250)}
  try{navigator.vibrate&&navigator.vibrate(was?[40,60,40]:25)}catch(e){}
  save();renderSession();
}
function swHtml(e){
  const d=S.draft,on=!!(d.sw&&d.sw.i===curEx),j=swNext(e),L=on?tr('دوس تاني تسجّل','Tap to log'):j<e.sets.length?tr('ابدأ المجموعة '+(j+1),'Start set '+(j+1)):tr('مجموعة جديدة','New set');
  return `<button class="swt${on?' on':''}" data-a="sw" aria-label="${esc(L)}"><span class="swi">${on?'<i class="swp"></i>':'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="14" r="7.5"/><path d="M12 10.5V14l2.2 1.6M9.5 2.5h5M12 2.5v4M18.4 7.6l1.4-1.4"/></svg>'}</span><span class="swc"><b class="en" id="${on?'swT':''}">${on?mmss((Date.now()-d.sw.t0)/1000):'0:00'}</b><small>${L}</small></span></button>`;
}
function goEx(k){const d=S.draft;if(!d||k<0||k>=d.ex.length||k===curEx)return;closeSheet();curEx=k;wAnim=true;renderSession();wAnim=false;$('#sess').scrollTop=0}
/* الأقواس بتلف دايماً ببطء. دوسة مطوّلة = لف سريع طول ما إيدك عليها. دوسة واحدة = لفة سريعة قصيرة وبعدها التمرين */
const ORB={ang:0,sp:8,tg:8,idle:8,fast:520,hold:false,swallow:false,t:0,lt:0,reduce:matchMedia('(prefers-reduced-motion: reduce)').matches};
function orbTick(ts){
  const v=document.querySelector('.orb svg');
  if(ORB.lt&&ts>ORB.lt){const dt=Math.min(.05,(ts-ORB.lt)/1000);ORB.sp+=(ORB.tg-ORB.sp)*(1-Math.exp(-dt*(ORB.tg>ORB.sp?9:3.5)));ORB.ang=(ORB.ang+ORB.sp*dt)%360}
  ORB.lt=ts;if(v)v.style.transform='rotate('+ORB.ang.toFixed(2)+'deg)';
  requestAnimationFrame(orbTick)}
if(!ORB.reduce)requestAnimationFrame(orbTick);
(()=>{const on=e=>e.target.closest&&e.target.closest('.orb');
  const end=()=>{clearTimeout(ORB.t);if(ORB.hold){ORB.hold=false;ORB.tg=ORB.idle;setTimeout(()=>{ORB.swallow=false},350)}};
  document.addEventListener('pointerdown',e=>{if(ORB.reduce||!on(e))return;ORB.hold=false;ORB.swallow=false;clearTimeout(ORB.t);
    ORB.t=setTimeout(()=>{ORB.hold=true;ORB.swallow=true;ORB.tg=ORB.fast;try{navigator.vibrate&&navigator.vibrate(15)}catch(_){}},320)});
  ['pointerup','pointercancel'].forEach(n=>document.addEventListener(n,end));
  document.addEventListener('contextmenu',e=>{if(on(e))e.preventDefault()});
  /* بعد الدوسة المطوّلة ما نفتحش التمرين */
  document.addEventListener('click',e=>{if(ORB.swallow&&on(e)){e.stopPropagation();e.preventDefault();ORB.swallow=false}},true)})();
function orbGo(b,fn){try{navigator.vibrate&&navigator.vibrate(10)}catch(e){}
  if(ORB.reduce||b.dataset.go){if(!b.dataset.go)fn();return}
  b.dataset.go='1';ORB.tg=ORB.fast*1.4;setTimeout(()=>{ORB.tg=ORB.idle;fn()},260)}
function closeSheet(){const s=$('#sheet');if(s){s.hidden=true;s.innerHTML=''}pk=null}
function openPick(kind,j){
  const d=S.draft,e=d.ex[curEx],L=T();let cur,step,min,max;
  if(kind==='w'){cur=num(e.w);if(isNaN(cur))cur=0;step=.5;min=0;max=Math.max(250,cur)}
  else{cur=num(e.sets[j]);if(!(cur>0))cur=+e.treps||10;const un=!!e.unit,mn=e.unit==='د';step=mn?1:un?5:1;min=mn?1:un?5:1;max=Math.max(mn?120:un?300:60,cur)}
  const vals=[];for(let v=min;v<=max+1e-9;v+=step)vals.push(Math.round(v*100)/100);
  if(!vals.includes(cur)){vals.push(cur);vals.sort((a,b)=>a-b)}
  pk={kind,j,vals};if(kind==='s'&&!e.unit){const a=num((e.ws||[])[j]);pk.wv=a>0?a:(num(e.w)||0)}
  const ttl=kind==='w'?`<span class="en">${esc(e.name)}</span> · ${L.wt}`:`${tr('المجموعة','Set')} ${j+1}${e.unit?'':tr(': العدّات والوزن',': reps and weight')}`;
  const sh=$('#sheet');sh.hidden=false;
  sh.innerHTML=`<div class="sbk" data-a="closeSheet"></div><div class="sbx"><div class="pkt">${ttl}</div>${kind==='w'&&!e.unit?`<div class="stp"><span>${tr('خطوة الزيادة','Step')}</span>${[1,2,2.5,4,5].map(v=>`<button class="en${stepOf(e.name)===v?' on':''}" data-a="stepSet" data-v="${v}">${v}</button>`).join('')}</div>`:''}${kind==='w'&&!e.unit&&typeof META!=='undefined'&&META[e.name]&&(META[e.name].eq==='bb'||META[e.name].eq==='mach')?`<div class="plc" id="plc"></div>`:''}${kind==='s'&&!e.unit?`<div class="pws"><span>${tr('وزن المجموعة دي','This set\'s weight')}</span><button data-a="pwm" aria-label="−">−</button><b class="en" id="pwv">${pk.wv}</b><small>k</small><button data-a="pwp" aria-label="+">+</button></div>`:''}<div class="pk"><div class="pkl" id="pkl">${vals.map(v=>`<div class="pki en">${v}</div>`).join('')}</div><div class="pkb"></div></div><button class="btn pri w" data-a="pickOk">${tr('تم','Done')}</button>${kind==='s'?`<div class="pkx"><button data-a="pickClr">${tr('امسح','Clear')}</button>${e.sets.length>1?`<button data-a="pickRm">${tr('شيل المجموعة','Remove set')}</button>`:''}</div>`:''}</div>`;
  const plc=$('#plc'),plates=v=>{let r=v;const o=[];for(const p of [20,10,5,2.5,1.25]){let c=0;while(r>=p-1e-9){c++;r=Math.round((r-p)*100)/100}if(c)o.push(c>1?`${c}×${p}`:`${p}`)}return r>0.01?'':o.join(' + ')};
  const l=$('#pkl'),mark=()=>{const k=Math.round(l.scrollTop/44);[...l.children].forEach((c,x)=>c.classList.toggle('sel',x===k));if(plc){const v=vals[Math.max(0,Math.min(vals.length-1,k))],t=plates(v);plc.innerHTML=t?`${tr('الأقراص على كل جنب','Plates per side')}: <b class="en">${t}</b>`:''}};
  l.scrollTop=vals.indexOf(cur)*44;mark();
  let raf=0;l.addEventListener('scroll',()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(mark)},{passive:true});
}
function openMenu(){
  const d=S.draft,L=T(),sh=$('#sheet');sh.hidden=false;const e=d.ex[curEx];
  /* v128: صفوف بنفس الشكل، مجموعتين، ومن غير زرار مليان */
  sh.innerHTML=`<div class="sbk" data-a="closeSheet"></div><div class="sbx mnu">
  <div class="mgh">${tr('التمرين ده','This exercise')}</div>
  <button class="mrow" data-a="swOpen"><i>⇄</i>${tr('بدّله (الجهاز مشغول)','Swap it (machine busy)')}</button>
  <button class="mrow" data-a="pain"><i>!</i>${tr('حاسس بوجع','It hurts')}</button>
  ${curEx<d.ex.length-1?`<button class="mrow" data-a="ssTgl"><i>⇵</i>${e.ss?tr('فك السوبرسيت','Unlink superset'):tr('سوبرسيت مع اللي بعده','Superset with the next one')}</button>`:''}
  <div class="mgh">${tr('الجلسة','Session')}</div>
  <button class="mrow" data-a="sxOpen"><i>+</i>${tr('ضيف تمرين','Add an exercise')}</button>
  ${d.editing?'':`<button class="mrow" data-a="timeShort"><i>◷</i>${tr('وقتي ضيق','Short on time')}</button>`}
  <button class="mrow" data-a="swTgl"><i>⏱</i>${S.settings.swOn?tr('ساعة الإيقاف: للتمارين اللي بالوقت بس','Stopwatch: timed exercises only'):tr('ساعة الإيقاف لكل التمارين','Stopwatch for every exercise')}</button>
  <button class="mrow" data-a="shareDraft"><i>↗</i>${L.shareW}</button>
  <button class="mrow" data-a="finish"><i>✓</i>${d.editing?L.saveEdit:tr('خلّص واحفظ','Finish and save')}</button>
  <button class="mrow" data-a="dateEd"><i>▤</i>${tr('تعديل التاريخ والدورة…','Edit date and cycle…')}</button>
  <div id="mdt" class="meta2" hidden><label>${L.date}<input class="inp" type="date" id="sDate" value="${esc(d.date)}"></label><label class="cy">${tr('الدورة','Cycle')}<input class="inp" id="sCyc" inputmode="numeric" value="${esc(d.cycle)}"></label></div>
  <button class="mrow dan" data-a="discard">${d.editing?L.discardEdit:L.discard}</button></div>`;
}
function openGuide(){
  const d=S.draft;if(!d)return;const e=d.ex[curEx];if(!e)return;const x=libGet(e.name),sh=$('#sheet');
  const body=(x&&detHtml(x))||(e.note0?`<div class="dsec" dir="auto">${esc(e.note0)}</div>`:`<div class="mu">${tr('مفيش شرح جاهز للتمرين ده. تقدر تكتب ملاحظتك من زرار «ملاحظة».','No guide for this exercise yet. Use the Note button to write your own.')}</div>`);
  sh.hidden=false;
  sh.innerHTML=`<div class="sbk" data-a="closeSheet"></div><div class="sbx gd"><div class="gdh"><b class="en">${esc(e.name)}</b><button class="wx" data-a="closeSheet" aria-label="${T().back}">×</button></div><div class="howto gdb">${body}</div>${notesHtml(e.name,(e.note||'').trim())}<div class="row mt"><button class="btn sp ghost" data-a="hwEdit" data-n="${esc(e.name)}">✎ ${tr('تعديل الشرح','Edit guide')}</button><button class="btn sp ghost" data-a="hist" data-id="${e.exId}">${tr('سجلّ التمرين','Exercise log')}</button></div></div>`;
}
function renderSession(){
  const d=S.draft,L=T();
  if(curEx>=d.ex.length)curEx=d.ex.length-1;if(curEx<0)curEx=0;
  const i=curEx,e=d.ex[i],n=d.ex.length,last=i===n-1,h=exHist(e.exId,d.editing),l=h[0],p=d.cb?null:progMsg({sets:e.tsets,goal:e.goal},h,e.unit,e.name),ps=d.cb?null:progState({sets:e.tsets,goal:e.goal},h),earn=!!(ps&&ps.k==='up'&&!e.unit);
  const u=e.unit?' '+esc(unitTxt(e.unit)):'',showW=!(noW(e.w)&&e.unit);
  const showL=openTips.has('l'+i),showH=openTips.has('h'+i),showN=openTips.has('n'+i)||!!e.note;
  const seg=d.ex.map((x,k)=>{const s=exSt(x);return `<button class="sg${k===i?' cur':''}${fullyIn(x)?' dn':s==='part'?' wn':''}" data-a="exGo" data-i="${k}" aria-label="${k+1}"><i></i></button>`}).join('');
  const du=e.dur||[],cir=e.sets.map((r,j)=>{const v=num(r)>0;return `<div class="cw"><button class="cir${v?' on':''}${POP===j?' pop':''}" data-a="setTap" data-j="${j}" aria-label="${tr('مجموعة','Set')} ${j+1}">${v?`<span class="en">${esc(r)}</span>`:`<span class="cix en">${j+1}</span><span class="en">${esc(String(+e.treps||0))}</span>`}</button><small class="ct en">${num((e.ws||[])[j])>0&&num(e.ws[j])!==num(e.w)?esc(String(num(e.ws[j])))+' k':''}${du[j]>0?(num((e.ws||[])[j])>0&&num(e.ws[j])!==num(e.w)?' · ':'')+mmss(du[j]):''}</small></div>`}).join('');
  const lastP=h.length?h.slice(0,3).map(x=>`<div><bdi>${fmtD(x.date)}</bdi> · <bdi class="en">${fw(x.w)} | ${esc(setsStr(x))}</bdi></div>`).join(''):`<div>${L.first}</div>`;
  const ar=LANG==='ar';
  $('#sess').innerHTML=`<div class="wtop"><button class="wx" data-a="closeS" aria-label="${L.back}">×</button><div class="wseg">${seg}</div><button class="wx" data-a="menu" aria-label="${tr('خيارات','Options')}">⋯</button></div>
  <div class="corec" id="corec" aria-live="polite"></div>
  ${d.cb?`<div class="cbn">${cbLine(d.cb)}</div>`:''}
  <div class="wmain${wAnim?' wa':''}" data-i="${i}">
    ${e.ss&&d.ex[i+1]?`<div class="sstag">⇄ ${tr('سوبرسيت مع','Superset with')} <bdi class="en">${esc(d.ex[i+1].name)}</bdi></div>`:i>0&&d.ex[i-1].ss?`<div class="sstag">⇄ ${tr('سوبرسيت مع','Superset with')} <bdi class="en">${esc(d.ex[i-1].name)}</bdi></div>`:''}
    <button class="wname en${e.core?' core':''}" data-a="guide" aria-label="${tr('طريقة الأداء','How to perform')}">${esc(e.name)}</button>
    <div class="war">${LANG==='ar'&&typeof META!=='undefined'&&META[e.name]&&META[e.name].ar?`<span>${esc(META[e.name].ar)}</span>`:''}<button class="wic" data-a="guide">ⓘ ${tr('الأداء','How')}</button><button class="wic" data-a="swOpen">⇄ ${tr('بدّل','Swap')}</button></div>
    <div class="wtg">${showW?`${e.unit?'':`<button class="wpm" data-a="wStep" data-v="-1" aria-label="${tr('أخف','Lighter')}">−</button>`}<button class="wwt en${earn?' earn':''}" id="wwt" data-a="pickW">${noW(e.w)?'—':esc(e.w)}<small>${L.wt}</small></button>${e.unit?'':`<button class="wpm" data-a="wStep" data-v="1" aria-label="${tr('أتقل','Heavier')}">+</button>`}`:''}<span class="wsr en">${esc(String(+e.tsets||0))}×${tgt(e.treps,e.goal,e.unit)}${u}</span></div>
    <div class="wsets">${cir}</div>
    <div class="wlast" data-a="hist" data-id="${e.exId}">${l?`${tr('آخر مرة','Last')}: <bdi class="en">${fw(l.w)} · ${esc(setsStr(l))}</bdi> · ${fmtD(l.date)}`:tr('أول مرة تلعبه','First time')}${!e.sets.some(v=>num(v)>0)&&warmTxt(e)?`<br>${tr('إحماء','Warm-up')}: <bdi class="en">${warmTxt(e)}</bdi>`:''}</div>
    <div class="rst" id="rst"></div>
    ${e.sets.length&&e.sets.every(v=>num(v)>0)&&!e.unit?`<div class="wrir"><span>${tr('فاضل في إيدك كام؟','Reps left in the tank?')}</span>${[tr('على الآخر','To failure'),tr('فاضل 1–2','1–2 left'),tr('فاضل 3+','3+ left')].map((t,k)=>`<button class="${e.rir===(k===0?0:k===1?2:3)?'on':''}" data-a="rir" data-v="${k===0?0:k===1?2:3}">${t}</button>`).join('')}</div>`:''}
    ${e.unit?'':`<button class="wcl${e.clean?' on':''}" data-a="clean">${e.clean?tr('✓ أداء نضيف','✓ Clean form'):tr('مش نضيف (مرجحة أو أداء مكسور)','Not clean (swinging or broken form)')}</button>`}
    ${(e.unit||S.settings.swOn||(d.sw&&d.sw.i===curEx))&&!(d.rest&&!d.rest.done&&!(d.sw&&d.sw.i===curEx))?`<div class="wrest">${swHtml(e)}</div>`:''}
    <div class="whint${memoOf(e.name)?' mine':''}" dir="auto" data-a="memo" data-n="${esc(e.name)}">${esc(memoOf(e.name)||(e.note0&&e.note0!==libHowAlt(e.name)?e.note0:(libHow(e.name)||e.note0||'')))||tr('اكتب ملاحظتك للتمرين ده','Write your note for this exercise')}</div>
    <div class="wlinks"><button data-a="tgl" data-k="l${i}">↺ ${tr('آخر 3 مرات','Last 3 times')}</button><button data-a="tgl" data-k="n${i}">✎ ${L.note}</button><button data-a="addset" data-i="${i}">+ ${tr('مجموعة','Set')}</button></div>
    ${showL?`<div class="tnote">${lastP}${p?`<div class="pmsg ${p.c}">${p.t}</div>`:''}</div>`:''}
    ${showN?`<input class="inp noteI" data-f="n" value="${esc(e.note)}" placeholder="${L.notePh}">`:''}
  </div>
  <div class="wnav"><button class="btn wb" data-a="exGo" data-i="${i-1}"${i===0?' disabled':''} aria-label="${tr('اللي قبله','Previous')}">‹</button>${last?`<button class="btn pri wb" data-a="finish">${d.editing?L.saveEdit:tr('خلّص','Finish')}</button>`:`<button class="btn wb" data-a="exGo" data-i="${i+1}" aria-label="${tr('اللي بعده','Next')}">›</button>`}</div>
  <div id="sheet" hidden></div>`;
  updCore();
  if(d.sw&&!swIv)swIv=setInterval(swTick,250);
  if(d.rest){if(!rsIv)rsIv=setInterval(restTick,250);restTick()}
}
let lastDone=null;
function finishSession(){
  if(!finishing&&S.draft&&S.draft.sw)swRecord();
  if(finishing||!buildFromDraft()){if(!finishing)toast(T().noSets);return}
  finishing=true;swHalt();closeSheet();
  const nm=S.draft.dayName,L=T(),dd0=S.draft,t0=dd0.t0,prev={};
  for(const e of dd0.ex)prev[e.exId]=exHist(e.exId,dd0.editing);
  const s=persistDraft();lastDone=s;finishing=false;
  /* v115: ملخص آخر الجلسة: المدة، الأرقام القياسية، واللي استحق زيادة */
  const sm=[];if(t0&&!dd0.editing){const mn=Math.round((Date.now()-t0)/60000);if(mn>0&&mn<360)sm.push(`${tr('المدة','Duration')}: <b class="en">${mn}</b> ${tr('دقيقة','min')}`)}
  {const N=S.sessions.length;if([10,25,50,100,150,200,300,500].includes(N))sm.unshift(`◆ ${tr(`الجلسة رقم ${N}. استمر.`,`Session number ${N}. Keep going.`)}`)}
  if(!s.cb)for(const e of s.ex){if(e.unit)continue;const h=prev[e.exId]||[],w=+e.w||0;if(!h.length||!w)continue;
    const mw=Math.max(...h.map(x=>+x.w||0)),bestR=Math.max(0,...h.filter(x=>(+x.w||0)===w).map(x=>Math.max(...x.sets)));
    if(w>mw)sm.push(`★ <bdi class="en">${esc(e.name)}</bdi>: ${tr('أتقل وزن','heaviest ever')} <b class="en">${w} k</b>`);
    else if(w===mw&&Math.max(...e.sets)>bestR&&bestR>0)sm.push(`★ <bdi class="en">${esc(e.name)}</bdi>: ${tr('أكتر عدّات على','most reps at')} <b class="en">${w} k</b>`);
    const ps=progState({sets:e.tsets,goal:e.goal},exHist(e.exId));if(ps&&ps.k==='up')sm.push(`↑ <bdi class="en">${esc(e.name)}</bdi>: ${tr('استحقيت الزيادة','increase earned')}`)}
  {const t=$('#toast');if(t)t.classList.remove('on')}
  const nx=s.ex.filter(e=>!e.unit&&(()=>{const p=progState({sets:e.tsets,goal:e.goal},exHist(e.exId));return p&&p.k==='up'})()).map(e=>e.name);
  sm.push(nx.length?`${tr('الجاية: زوّد في','Next time: add weight on')} <bdi class="en">${esc(nx.join('، '))}</bdi>`:tr('الجاية: نفس الأوزان، وحاول تكمّل الهدف','Next time: same weights, aim to complete the target'));
  for(let k=sm.length-2;k>=0;k--)if(/استحقيت الزيادة|increase earned/.test(sm[k]))sm.splice(k,1);
  $('#sess').innerHTML=`<div class="wdone"><div class="wchk">✓</div><div class="wdt"><bdi>${esc(nm)}</bdi></div><div class="wds">${s.status==='full'?L.savedFull:s.status==='core'?L.savedCore:L.saved}</div>${sm.length?`<div class="wsum">${sm.map(x=>`<div>${x}</div>`).join('')}</div>`:''}</div>
  <div class="wdn2"><button class="plink" data-a="shareDone">${tr('مشاركة…','Share…')}</button><button class="btn pri w" data-a="doneClose">${tr('تمام','Done')}</button></div>`;
}
const logged=e=>e.sets.some(r=>num(r)>0);
/* حالة التمرين: none | part (ناقص خانات) | low (كل الخانات مليانة بس أقل من الهدف) | ok */
function exSt(e){const n=e.sets.length;if(!n||!e.sets.some(r=>num(r)>0))return 'none';
  if(!e.sets.every(r=>num(r)>0))return 'part';
  const g=+e.goal||0;return g&&e.sets.some(r=>num(r)<g)?'low':'ok'}
const stCls=e=>({none:'',part:' wn',low:' wn',ok:' dn'})[exSt(e)];
const stMark=e=>({none:'',part:'…',low:'↓',ok:'✓'})[exSt(e)];
const fullyIn=e=>{const k=exSt(e);return k==='low'||k==='ok'};
function updCore(){
  const d=S.draft;if(!d)return;const c=d.ex.filter(e=>e.core),k=c.filter(fullyIn).length;
  const el=$('#corec');if(el){el.textContent=k===c.length&&c.length?T().coreDone:T().coreN(k,c.length);el.classList.toggle('done',k===c.length&&c.length>0);el.hidden=!c.length}
  document.querySelectorAll('#sess .sg').forEach((b,x)=>{const e=d.ex[x];if(!e)return;b.classList.toggle('dn',fullyIn(e));b.classList.toggle('wn',exSt(e)==='part')});
}
/* تحويل المسودة لجلسة (من غير حفظ) */
function buildFromDraft(){
  const d=S.draft,ex=[];
  for(const e of d.ex){const sets=[],dur=[],wsx=[];e.sets.forEach((r,j)=>{const v=num(r);if(!isNaN(v)&&v>0){sets.push(v);dur.push(+((e.dur||[])[j])||0);const x=num((e.ws||[])[j]);wsx.push(x>0?x:num(e.w))}});if(!sets.length)continue;const w=num(e.w);
    const o={exId:e.exId,name:e.name,unit:e.unit,core:e.core,goal:e.goal,tsets:e.tsets,treps:e.treps,w:isNaN(w)?'':w,sets,clean:!!e.clean,note:(e.note||'').trim()};if(dur.some(x=>x>0))o.dur=dur;if(e.rir!=null)o.rir=e.rir;if(e.ss)o.ss=1;if(e.add)o.add=1;if(e.from)o.from=String(e.from);if(!e.unit&&wsx.some(x=>x!==num(e.w)))o.ws=wsx;ex.push(o)}
  if(!ex.length)return null;
  const core=d.ex.filter(e=>e.core).every(e=>ex.some(x=>x.exId===e.exId));
  const all=d.ex.every(e=>ex.some(x=>x.exId===e.exId));
  const o={t0:d.t0||undefined,gym:d.gym||gymId(),rdy:d.rdy,id:d.editing||d.id,date:d.date||today(),day:d.day,dayName:d.dayName,cycle:+num(d.cycle)||1,ex,status:all?'full':core?'core':'part',ts:Date.now()};
  if(d.cb)o.cb=d.cb;if(o.rdy==null)delete o.rdy;if(o.gym==='main')delete o.gym;return o;
}
function persistDraft(){
  const d=S.draft,s=buildFromDraft();
  if(!s)return null;
  s.ex.forEach(e=>addExNote(e.name,e.note,s.date));
  const i=d.editing?S.sessions.findIndex(x=>x.id===d.editing):-1;
  if(i>-1){s.ts=S.sessions[i].ts;S.sessions[i]=s}else S.sessions.push(s);
  S.draft=null;openTips.clear();save();autoFile();queueBackup(true);
  return s;
}
function shareDraft(){const s=buildFromDraft();if(!s){toast(T().noSets);return}shareText(aiText(s,S.draft.editing))}
function exHistModal(exId){
  const L=T();let nm='',dn='';for(const d of S.program.days){const t=d.ex.find(x=>x.id===exId);if(t){nm=t.name;dn=d.name}}
  const h=exHist(exId);if(!nm&&h[0])nm=h[0].name;
  const ch=h.filter(x=>!x.unit&&+x.w>0&&!x.cb).slice(0,40).reverse(),best=Math.max(0,...ch.map(x=>e1rm(+x.w,Math.max(...x.sets))));
  modal(`<h3 class="en" style="text-align:start">${esc(nm)}</h3><div class="mu" style="margin-bottom:8px"><span class="en">${esc(dn)}</span> · ${L.sessCount(h.length)}</div>
  ${ch.length>1?`<div class="lch"><div class="mu">${tr('الوزن على مدار الوقت','Weight over time')}</div>${lineSvg(ch.map(x=>+x.w),tr('الوزن','Weight'))}<div class="mu">${tr('أقصى وزن تقديري لعدّة واحدة','Estimated one-rep max')}: <b class="en">${best.toFixed(1)} k</b></div></div>`:''}
  ${h.length?`<table class="h">${h.map(x=>`<tr><td>${fmtD(x.date)}</td><td class="en">${fw(x.w)}</td><td class="en">${esc(setsStr(x))}</td><td>${x.clean?`<span style="color:var(--ok)">${L.clean}</span>`:''}</td></tr>`).join('')}</table>`:`<div class="empty">${L.noData}</div>`}
  <button class="btn w mt" data-a="closeM">${L.close}</button>`);
}

/* ================= السجل ================= */
const dayBase=n=>String(n||'').replace(/\b(light|lite)\b/gi,' ').replace(/لايت|خفيفة|خفيف/g,' ').replace(/[-–·()]+/g,' ').replace(/\s+/g,' ').trim();
const dayKey=n=>dayBase(n).toLowerCase();
let hsList=[],hsN=0,hsLast='';
function histChunk(){const L=T(),part=hsList.slice(hsN,hsN+(hsN?30:12));hsN+=part.length;
  return part.map(s=>{
    let mh='';try{const m=new Date(s.date+'T00:00:00').toLocaleDateString(loc(),{month:'long',year:'numeric'});if(m!==hsLast){hsLast=m;mh=`<div class="pmon">${m}</div>`}}catch(e){}
    return `${mh}<div class="pr2"><div class="pr2b" data-a="sess" data-lp="s" data-id="${s.id}"><div class="sp"><div class="pnm"><bdi>${esc(s.dayName)}</bdi></div><div class="mu">${fmtD(s.date)} · ${L.exN(s.ex.length)}${s.cb?' · '+(s.cb.dl?tr('خفيف','light'):tr('رجوع','comeback')):''}</div></div>${s.status==='full'?'':`<span class="pst ${s.status}">${L.st[s.status]||''}</span>`}</div></div>`}).join('')}
/* v122: إحصائيات: الالتزام آخر 16 أسبوع، ومجموعات كل عضلة في آخر 7 أيام */
function statsHtml(ds){if(!ds.length)return '';
  const wk=iso=>Math.floor((new Date(iso+'T12:00:00')-new Date('2000-01-01T12:00:00'))/(7*864e5)),now=wk(today()),c={};for(const x of ds){const k=now-wk(x.date);if(k>=0&&k<16)c[k]=(c[k]||0)+1}
  const mx=Math.max(3,...Object.values(c)),bars=Array.from({length:16},(_,i)=>15-i).map(k=>{const n=c[k]||0;return `<i class="${n>=3?'ok':n?'lo':''}" style="height:${Math.max(4,n/mx*44).toFixed(0)}px" title="${n}"></i>`}).join('');
  const mg={};for(const x of ds){if(daysAgo(x.date)>6||daysAgo(x.date)<0)continue;for(const e of x.ex){const L=libGet(e.name),g=L?L[1]:'';if(!g||g==='cond')continue;mg[g]=(mg[g]||0)+e.sets.length}}
  const rows=Object.keys(GRP).filter(g=>mg[g]).map(g=>`<div class="mgr"><span>${GRP[g][LANG==='ar'?0:1]}</span><i style="width:${Math.min(100,mg[g]/20*100).toFixed(0)}%"></i><b class="en">${mg[g]}</b></div>`).join('');
  return `<details class="fsec sts" data-fk="stats"${fOpen.has('stats')?' open':''}><summary>${tr('الإحصائيات','Stats')}<span class="pchev">⌄</span></summary><div class="fbody">
    <div class="row" style="margin-bottom:12px"><button class="btn sp" data-a="rep" data-d="7">${tr('تقرير الأسبوع','Weekly report')}</button><button class="btn sp" data-a="rep" data-d="30">${tr('تقرير الشهر','Monthly report')}</button></div>
    <div class="mu">${tr('جلسات كل أسبوع (آخر 16 أسبوع، الأحدث على اليمين). الدهبي = حققت 3','Sessions per week (last 16 weeks, newest on the right). Gold = hit 3')}</div><div class="wkb" dir="ltr">${bars}</div>
    ${rows?`<div class="mu" style="margin-top:14px">${tr('مجموعات كل عضلة في آخر 7 أيام (10–20 في الأسبوع مدى كويس للنمو)','Sets per muscle in the last 7 days (10–20 a week is a good range for growth)')}</div><div class="mgs">${rows}</div>`:''}</div></details>`}
/* v125: تقرير أسبوعي / شهري */
function reportText(days){const ds=done(),inP=x=>{const a=daysAgo(x.date);return a>=0&&a<days},cur=ds.filter(inP),prev=ds.filter(x=>!inP(x)&&daysAgo(x.date)>=0);
  const L=[tr(`تقرير آخر ${days} يوم — ${today()}`,`Report for the last ${days} days — ${today()}`),''];
  const sets=cur.reduce((a,x)=>a+x.ex.reduce((b,e)=>b+e.sets.length,0),0),vol=cur.reduce((a,x)=>a+x.ex.reduce((b,e)=>b+(e.unit?0:e.sets.reduce((c,r,j)=>c+r*(+(e.ws&&e.ws[j])||+e.w||0),0)),0),0);
  L.push(`${tr('الجلسات','Sessions')}: ${cur.length}${days===7?` (${tr('الهدف 3','goal 3')})`:` (${tr('متوسط','avg')} ${(cur.length/(days/7)).toFixed(1)} ${tr('في الأسبوع','per week')})`}`);
  L.push(`${tr('إجمالي المجموعات','Total sets')}: ${sets}`);
  const pr=[],up=[],stk=[];const seen=new Set();
  for(const x of cur)for(const e of x.ex){const k=nk(e.name);if(e.unit||seen.has(k))continue;seen.add(k);const w=Math.max(...cur.filter(q=>q.ex.some(z=>nk(z.name)===k)).map(q=>+q.ex.find(z=>nk(z.name)===k).w||0));
    const pw=Math.max(0,...prev.flatMap(q=>q.ex.filter(z=>nk(z.name)===k).map(z=>+z.w||0)));if(pw>0&&w>pw)pr.push(`${e.name}: ${pw} → ${w} kg`);
    const ps=progState({sets:e.tsets||3,goal:e.goal||12},exHist(e.exId));if(ps&&ps.k==='up')up.push(e.name);if(ps&&ps.k==='stuck')stk.push(e.name)}
  L.push('',tr('أوزان جديدة','New weights')+':',...(pr.length?pr.map(x=>'- '+x):['- '+tr('مفيش','none')]));
  if(up.length)L.push('',tr('استحقيت زيادة في','Increase earned on')+':',...up.map(x=>'- '+x));
  if(stk.length)L.push('',tr('واقف من غير زيادة','Stalled')+':',...stk.map(x=>'- '+x));
  const b=(S.body||[]).filter(x=>daysAgo(x.d)>=0&&daysAgo(x.d)<days&&x.w>0).sort((x,y)=>x.d<y.d?-1:1);if(b.length>1)L.push('',`${tr('وزن الجسم','Bodyweight')}: ${b[0].w} → ${b[b.length-1].w} kg`);
  const cbx=cur.filter(x=>x.cb).length;if(cbx)L.push('',`${tr('جلسات رجوع أو خفيفة','Comeback/light sessions')}: ${cbx}`);
  return L.join('\n')}
function reportModal(days){const t=reportText(days);modal(`<h3>${days===7?tr('تقرير الأسبوع','Weekly report'):tr('تقرير الشهر','Monthly report')}</h3><pre class="cardtxt">${esc(t)}</pre><div class="row"><button class="btn pri sp" data-a="repCopy" data-d="${days}">${tr('انسخ','Copy')}</button><button class="btn sp" data-a="repShare" data-d="${days}">${tr('شارك للتحليل','Share for analysis')}</button></div><button class="btn ghost w mt" data-a="closeM">${T().close}</button>`)}
function renderHistory(){
  const L=T(),ds=done();hsList=ds;hsN=0;hsLast='';
  const hm=histMap(),inProg=new Set(S.program.days.flatMap(d=>d.ex.map(t=>nk(t.name))));
  const old=Object.keys(hm).filter(k=>!inProg.has(k)).map(k=>[hm[k][0].name,hm[k].length]).sort((x,y)=>y[1]-x[1]);
  const dk=dayKey,dc={},dn={};
  S.program.days.forEach(d=>{const k=dk(d.name);if(!dn[k]){dn[k]=dayBase(d.name);dc[k]=0}});
  ds.forEach(x=>{const k=dk(x.dayName);if(!k)return;if(!dn[k])dn[k]=dayBase(x.dayName);dc[k]=(dc[k]||0)+1});
  const dopts=Object.keys(dn).sort((x,y)=>dc[y]-dc[x]);
  let h=`<div class="lsearch"><select id="exPick" class="psel"><option value="">${L.exPickPh}</option>${S.program.days.map(d=>`<optgroup label="${esc(d.name)}">${d.ex.map(t=>`<option value="${t.id}">${esc(t.name)} (${(hm[nk(t.name)]||[]).length})</option>`).join('')}</optgroup>`).join('')}${old.length?`<optgroup label="${tr('تمارين قديمة','Older exercises')}">${old.map(o=>`<option value="n:${esc(o[0])}">${esc(o[0])} (${o[1]})</option>`).join('')}</optgroup>`:''}</select><span class="pchev">⌄</span></div>
  <div class="lsearch"><select id="dayPick" class="psel"><option value="">${tr('اختار يوم تمرين…','Choose a workout day…')}</option>${dopts.map(k=>`<option value="${esc(k)}">${esc(dn[k])} (${dc[k]})</option>`).join('')}</select><span class="pchev">⌄</span></div>`;
  h+=statsHtml(ds);
  if(!ds.length)h+=`<div class="empty">${L.noSess}</div>`;
  else h+=`<div class="plist" id="hsL">${histChunk()}</div>${hsN<ds.length?'<div id="hsMore" style="height:1px"></div>':''}`;
  $('#view').innerHTML=h;
  const mo=$('#hsMore');if(mo){const io=new IntersectionObserver(es=>{if(!es[0].isIntersecting)return;const l=$('#hsL');if(!l||!mo.isConnected){io.disconnect();return}l.insertAdjacentHTML('beforeend',histChunk());if(hsN>=hsList.length){io.disconnect();mo.remove()}else{io.unobserve(mo);io.observe(mo)}},{rootMargin:'800px'});io.observe(mo)}
  $('#exPick').onchange=e=>{const v=e.target.value;if(v)v.startsWith('n:')?exHistName(v.slice(2)):exHistModal(v);e.target.value=''};
  $('#dayPick').onchange=e=>{const v=e.target.value;if(v)dayHistModal(v);e.target.value=''};
}
function exHistName(nm){
  const L=T(),h=histMap()[nk(nm)]||[];
  modal(`<h3 class="en" style="text-align:start">${esc(nm)}</h3><div class="mu" style="margin-bottom:8px">${L.sessCount(h.length)}</div>
  ${h.length?`<table class="h">${h.map(x=>`<tr><td>${fmtD(x.date)}</td><td class="en">${fw(x.w)}</td><td class="en">${esc(setsStr(x))}</td><td>${x.clean?`<span style="color:var(--ok)">${L.clean}</span>`:''}</td></tr>`).join('')}</table>`:`<div class="empty">${L.noData}</div>`}
  <button class="btn w mt" data-a="closeM">${L.close}</button>`);
}
function dayHistModal(k){
  const L=T(),dk=dayKey;
  const ss=done().filter(x=>dk(x.dayName)===k),nm=ss[0]?dayBase(ss[0].dayName):dayBase((S.program.days.find(d=>dk(d.name)===k)||{}).name)||k;
  const cnt=st=>ss.filter(x=>x.status===st).length;
  modal(`<h3 class="en" style="text-align:start">${esc(nm)}</h3>
  <div class="mu" style="margin-bottom:8px">${tr('اتلعب','Played')} <b style="color:var(--tx)">${ss.length}</b> ${tr('مرة','times')}${ss.length?` · ${tr('آخر مرة','Last')} ${fmtD(ss[0].date)}`:''}</div>
  ${ss.length?`<div class="plist" style="max-height:48vh;overflow-y:auto">${ss.map(x=>`<div class="pr2"><div class="pr2b" data-a="sess" data-id="${x.id}"><div class="sp"><div class="mu">${fmtD(x.date)} · <span class="en">C${x.cycle}</span> · ${L.exN(x.ex.length)}${dayBase(x.dayName).toLowerCase()!==String(x.dayName).trim().toLowerCase()?` · <span class="en">${esc(x.dayName)}</span>`:''}</div></div><span class="pst ${x.status}">${L.st[x.status]||''}</span></div></div>`).join('')}</div>`:`<div class="empty">${L.noData}</div>`}
  <button class="btn w mt" data-a="closeM">${L.close}</button>`);
}
/* v133: الدوسة المطوّلة: قايمة سريعة على الجلسة في السجل، والتمرين في البرنامج، والتمرين في المكتبة */
function lpMenu(el){const k=el.dataset.lp,R=(a,ic,t,x='')=>`<button class="mrow${a==='delS'||a==='delT'?' dan':''}" data-a="${a}" ${x}><i>${ic}</i>${t}</button>`;
  if(k==='s'){const s=S.sessions.find(x=>x.id===el.dataset.id);if(!s)return;const q=`data-id="${s.id}"`;
    modal(`<h3><bdi>${esc(s.dayName)}</bdi> · ${fmtD(s.date)}</h3>${R('copyS','⧉',tr('انسخ الكارت','Copy the card'),q)}${R('imgS','▣',tr('صورة للجلسة','Session image'),q)}${R('aiS','↗',tr('ابعتها للتحليل','Send for analysis'),q)}${R('editS','✎',T().edit,q)}${R('delS','×',T().del,q)}`)}
  else if(k==='pt'){const i=+el.dataset.i,t=day(pDay).ex[i];if(!t)return;const q=`data-i="${i}"`;
    modal(`<h3 class="en">${esc(t.name)}</h3>${R('editT','✎',tr('عدّل الوزن والمجموعات','Edit weight and sets'),q)}${R('tCore','★',t.core?tr('شيله من الأساسي','Remove from essentials'):tr('خليه أساسي','Make it essential'),q)}${i>0?R('tMv','↑',tr('طلّعه فوق','Move up'),q+' data-v="-1"'):''}${i<day(pDay).ex.length-1?R('tMv','↓',tr('نزّله تحت','Move down'),q+' data-v="1"'):''}${R('memo','✐',tr('ملاحظتي','My note'),`data-n="${esc(t.name)}"`)}${R('delT','×',tr('شيله من اليوم','Remove from this day'),q)}`)}
  else if(k==='lx'){const n=el.dataset.n,ds=S.program.days;
    modal(`<h3 class="en">${esc(n)}</h3><div class="mgh">${tr('ضيفه ليوم','Add it to a day')}</div>${ds.map(d=>R('libAddTo','+',`<bdi class="en">${esc(d.name)}</bdi>${d.ex.some(t=>t.name===n)?' <span class="mu">✓</span>':''}`,`data-n="${esc(n)}" data-d="${d.id}"`)).join('')}${R('memo','✐',tr('ملاحظتي','My note'),`data-n="${esc(n)}"`)}`)}
}
(()=>{let tm=null,x0=0,y0=0,sw=false;
  const cancel=()=>{clearTimeout(tm);tm=null};
  document.addEventListener('pointerdown',e=>{const el=e.target.closest&&e.target.closest('[data-lp]');if(!el)return;x0=e.clientX;y0=e.clientY;cancel();
    tm=setTimeout(()=>{tm=null;sw=true;try{navigator.vibrate&&navigator.vibrate(15)}catch(_){}lpMenu(el)},480)},{passive:true});
  document.addEventListener('pointermove',e=>{if(tm&&Math.hypot(e.clientX-x0,e.clientY-y0)>10)cancel()},{passive:true});
  ['pointerup','pointercancel','scroll'].forEach(t=>document.addEventListener(t,cancel,{passive:true,capture:true}));
  document.addEventListener('click',e=>{if(sw){sw=false;e.preventDefault();e.stopPropagation()}},true);
  document.addEventListener('contextmenu',e=>{if(e.target.closest&&e.target.closest('[data-lp]'))e.preventDefault()});
})();
function sessModal(id){
  const L=T(),s=S.sessions.find(x=>x.id===id);if(!s)return;
  modal(`<h3><bdi>${esc(s.dayName)}</bdi> · ${fmtD(s.date)}</h3><div class="dl">${s.ex.map(e=>`<div class="dr"><span class="dn2 en">${esc(e.name)}</span><span class="dw en">${e.unit?'':fw(e.w)+' · '}${esc(setsStr(e))}</span></div>`).join('')}</div>
  <div class="row mt"><button class="btn pri sp" data-a="editS" data-id="${s.id}">${L.edit}</button><button class="btn sp" data-a="shareS" data-id="${s.id}">${tr('مشاركة…','Share…')}</button></div>
  <button class="mrow dan" data-a="delS" data-id="${s.id}">${L.del}</button>`);
}
function shareModal(s){modal(`<h3>${tr('مشاركة الجلسة','Share the session')}</h3><button class="mrow" data-a="copyS" data-id="${s.id}"><i>⧉</i>${tr('انسخ الكارت','Copy the card')}</button><button class="mrow" data-a="imgS" data-id="${s.id}"><i>▣</i>${tr('صورة للجلسة','Session image')}</button><button class="mrow" data-a="aiS" data-id="${s.id}"><i>↗</i>${tr('ابعتها للتحليل','Send for analysis')}</button><button class="btn ghost w mt" data-a="closeM">${T().close}</button>`)}

/* ================= البرنامج ================= */
/* ================= مكتبة التمارين + الأنظمة ================= */
const tr=(a,e)=>LANG==='ar'?a:e;
const GRP={chest:['صدر','Chest'],back:['ضهر','Back'],shoulders:['كتف','Shoulders'],biceps:['باي','Biceps'],triceps:['تراي','Triceps'],forearms:['ساعد وقبضة','Forearms & grip'],neck:['رقبة','Neck'],quads:['فخد أمامي','Quads'],posterior:['فخد خلفي ومؤخرة','Hamstrings & glutes'],calves:['سمانة','Calves'],core:['جذع','Core'],cond:['لياقة وكارديو','Conditioning']};
const EQN={bb:['بار','Barbell'],db:['دمبل','Dumbbell'],mach:['جهاز','Machine'],cable:['كابل','Cable'],bw:['وزن جسم','Bodyweight'],kb:['كيتل بل','Kettlebell'],band:['شريط','Band'],other:['أخرى','Other']};
const howLang=()=>S.settings.howLang==='en'?'en':'ar';
/* [الاسم، المجموعة، وزن مبدئي، مجموعات، عدّات، وحدة، شرح عربي، شرح إنجليزي] */
/* LIB و DET و META في exlib.js */
const cuG=c=>{const g=c.g||'core',n=c.name||'';if(GRP[g])return g;if(g==='arms')return /tri|push|dip|ext|kick|skull/i.test(n)?'triceps':/wrist|grip|forearm|carry|hang|pinch/i.test(n)?'forearms':'biceps';if(g==='legs')return /calf/i.test(n)?'calves':/curl|deadlift|rdl|thrust|bridge|glute|hip|good morning|swing/i.test(n)?'posterior':'quads';return 'core'};
const customLib=()=>(S.custom||[]).map(c=>[c.name,cuG(c),c.w||0,c.sets||3,c.reps||12,c.unit||'',c.how||'','',null,1]);
const allLib=()=>LIB.concat(customLib());
const libGet=n=>LIB.find(x=>x[0]===n)||customLib().find(x=>x[0]===n);
const libOv=n=>(S.libOv&&S.libOv[n])||null;
/* v132: ملاحظتك الشخصية لكل تمرين — بتفضل للأبد وبتظهر في كل جلسة وفي تاب التمارين */
const memoOf=n=>(S.exMemo&&S.exMemo[nk(n)])||'';
function memoModal(n){const cur=memoOf(n)||((()=>{const t=S.draft&&S.draft.ex.find(e=>e.name===n);return t&&t.note0&&t.note0!==libHowAlt(n)?t.note0:libHow(n)})()||'');
  modal(`<h3>${tr('ملاحظتك','Your note')}</h3><div class="mu" style="margin-bottom:8px"><bdi class="en">${esc(n)}</bdi> · ${tr('بتفضل محفوظة للتمرين ده في كل جلسة وفي تاب التمارين.','Kept for this exercise in every session and in the Exercises tab.')}</div>
  <textarea class="inp" id="memoT" rows="6" dir="auto" maxlength="1200">${esc(cur)}</textarea>
  <div class="row mt"><button class="btn pri sp" data-a="memoSave" data-n="${esc(n)}">${T().saveB}</button>${memoOf(n)?`<button class="btn ghost" data-a="memoDel" data-n="${esc(n)}">${tr('رجّع الشرح الأصلي','Restore default')}</button>`:`<button class="btn ghost" data-a="closeM">${T().cancel}</button>`}</div>`)}
function memoDone(){closeModal();if(S.draft&&!$('#sess').hidden)renderSession();if(tab==='lib')renderLib()}
const exNotes=n=>(S.exNotes&&S.exNotes[String(n||'').trim().toLowerCase()])||[];
function addExNote(n,t,d){t=(t||'').trim();if(!t)return;S.exNotes=S.exNotes||{};const k=String(n||'').trim().toLowerCase(),a=S.exNotes[k]||(S.exNotes[k]=[]);if(!a.some(x=>x.t===t))a.push({d:d||today(),t})}
function notesHtml(n,extra){const a=exNotes(n).slice();if(extra&&!a.some(x=>x.t===extra))a.push({d:'',t:extra});
  return a.length?`<div class="dsec k0 unotes" dir="auto"><b>${tr('ملاحظاتك','Your notes')}</b>${a.map(x=>`<div>• ${esc(x.t)}${x.d?` <span class="mu">· ${fmtD(x.d)}</span>`:''}</div>`).join('')}</div>`:''}
const libHow=n=>{const x=libGet(n);if(!x)return '';const o=libOv(n);if(howLang()==='en'){if(o&&o.shortEn)return o.shortEn;if(x[7])return x[7]}else if(o&&o.short!=null&&o.short!=='')return o.short;return x[6]};
/* الملخص باللغة التانية: لو note0 اتاخد من المكتبة قبل تغيير لغة الشرح، نعرضه باللغة الحالية */
const libHowAlt=n=>{const x=libGet(n);if(!x)return '';const o=libOv(n)||{};return howLang()==='en'?((o.short!=null&&o.short!=='')?o.short:x[6]):(o.shortEn||x[7]||'')};
const lastW=n=>{for(const s of done()){const e=s.ex.find(x=>x.name===n&&+x.w>0);if(e)return +e.w}return null};
const mk=(n,sets,reps,core)=>{const L=libGet(n)||[n,'',0,3,12,''];const lw=lastW(n);return{id:uid(),name:n,w:lw!=null?lw:L[2],sets:sets||L[3],reps:reps||L[4],goal:reps||L[4],unit:L[5]||'',core:!!core,note:''}};
/* v133: برامج المستخدم اللي بيعملها من الصفر */
const allSys=()=>SYSTEMS.concat((S.myProgs||[]).map(p=>({id:p.id,ar:[p.name,'برنامجك اللي عملته'],en:[p.name,'Your own program'],mine:1,custom:1})));
function npModal(){modal(`<h3>${tr('برنامج جديد','New program')}</h3>
  <div class="mu" style="margin-bottom:10px;line-height:1.8">${tr('سمّي البرنامج واكتب أيامه بالترتيب اللي هتلعبها بيه. بعدها ضيف تمارين كل يوم من «تعديل». برنامجك الحالي بيتحفظ وتقدر ترجعله في أي وقت.','Name the program and list its days in the order you will train them. Then add each day\'s exercises from “Edit”. Your current program is kept and you can switch back anytime.')}</div>
  <label class="fld">${tr('اسم البرنامج','Program name')}<input class="inp" id="npN" maxlength="30" placeholder="Push Pull Legs"></label>
  <div id="npD">${['Push','Pull','Legs'].map((x,k)=>`<label class="fld">${tr('يوم','Day')} ${k+1}<input class="inp npd" maxlength="24" value="${x}"></label>`).join('')}</div>
  <div class="row" style="margin-bottom:12px"><button class="btn sm ghost" data-a="npAddD">+ ${tr('يوم','Day')}</button><button class="btn sm ghost" data-a="npRmD">− ${tr('يوم','Day')}</button></div>
  <div class="row"><button class="btn pri sp" data-a="npSave">${tr('اعمله','Create')}</button><button class="btn ghost" data-a="closeM">${T().cancel}</button></div>`)}
const SYSTEMS=[
{id:'ul4',ar:['علوي / سفلي (4 أيام)','كل عضلة مرتين في الأسبوع، من زاويتين مختلفتين. توازن ممتاز بين الحجم والراحة'],en:['Upper / Lower (4 days)','Every muscle twice a week from two angles. A great balance of volume and recovery'],mine:1},
{id:'ul2',ar:['علوي / سفلي (يومين)','للأسابيع المزحومة: يوم للجزء العلوي ويوم للسفلي'],en:['Upper / Lower (2 days)','For busy weeks: one upper day, one lower day'],
 days:[['Upper',[['Flat Dumbbell Press',3,12,1],['Lat Pulldown',3,10,1],['Shoulder Press',3,10,1],['Seated Row',3,10],['Triceps Pushdown',3,12],['Biceps Curl',3,10]]],['Lower',[['Leg Press',3,10,1],['Romanian Deadlift',3,10,1],['Leg Curl',3,12,1],['Leg Extension',3,12],['Calf Raises',3,15],['Plank',3,45]]]]},
{id:'fb3',ar:['جسم كامل (3 أيام)','جسمك كله في كل جلسة. مناسب لو بتتغيب كتير'],en:['Full Body (3 days)','Whole body each session. Good if you miss days often'],
 days:[['Full Body A',[['Leg Press',3,10,1],['Flat Dumbbell Press',3,10,1],['Lat Pulldown',3,10,1],['Shoulder Press',2,10],['Biceps Curl',2,12],['Plank',2,40]]],['Full Body B',[['Hack Squat',3,10,1],['Incline Dumbbell Press',3,10,1],['Seated Row',3,10,1],['Leg Curl',3,12],['Triceps Pushdown',2,12],['Lateral Raises',2,15]]],['Full Body C',[['Romanian Deadlift',3,10,1],['Chest Press Machine',3,10,1],['Chest-Supported Row',3,10,1],['Leg Extension',2,12],['Hammer Curl',2,12],["Farmer's Walk",3,25]]]]},
{id:'ppl3',ar:['دفع / سحب / رجل (3 أيام)','الكلاسيكي: دفع، سحب، رجل، وبتكرره'],en:['Push / Pull / Legs (3 days)','The classic: push, pull, legs, repeat'],
 days:[['Push',[['Incline Dumbbell Press',3,10,1],['Flat Dumbbell Press',3,12,1],['Shoulder Press',3,10,1],['Lateral Raises',3,15],['Triceps Pushdown',3,12],['Cable Overhead Extension',3,12]]],['Pull',[['Lat Pulldown',3,10,1],['Seated Row',3,10,1],['Face Pull',3,15,1],['Biceps Curl',3,10],['Hammer Curl',3,10],['DB Shrugs',3,15]]],['Legs',[['Plank',3,45,1],['Leg Press',3,10,1],['Leg Curl',3,12,1],['Leg Extension',3,12],['Calf Raises',3,15],['Back Extension',3,12]]]]},
{id:'ulppl5',ar:['دفع / سحب / رجل + علوي / سفلي (5 أيام)','خمس أيام: دفع وسحب ورجل، وبعدين يوم علوي ويوم سفلي'],en:['Push / Pull / Legs + Upper / Lower (5 days)','Five days: push, pull, legs, then an upper and a lower day'],
 days:[['Push',[['Incline Dumbbell Press',3,10,1],['Chest Press Machine',3,12,1],['Shoulder Press',3,10,1],['Lateral Raises',3,15],['Triceps Pushdown',3,12]]],['Pull',[['Lat Pulldown',3,10,1],['T-Bar Row',3,10,1],['Face Pull',3,15,1],['Biceps Curl',3,10],['Hammer Curl',3,10]]],['Legs',[['Leg Press',3,12,1],['Hack Squat',3,10,1],['Back Extension',3,12],['Leg Curl',3,10,1],['Calf Raises',4,15]]],['Upper',[['Chest Press Machine',3,12,1],['Lat Pulldown',3,10,1],['Shoulder Press',3,10,1],['Triceps Pushdown',3,12],['Hammer Curl',3,10]]],['Lower',[['Leg Press',3,12,1],['Leg Extension',3,12],['Leg Curl',3,10,1],['Calf Raises',4,15]]]]},
{id:'bro5',ar:['تقسيم عضلات (5 أيام)','يوم لكل عضلة: صدر، ضهر، كتف، دراعين، رجل'],en:['Body-part split (5 days)','One muscle group a day: chest, back, shoulders, arms, legs'],
 days:[['Chest',[['Flat Dumbbell Press',4,10,1],['Incline Dumbbell Press',3,12,1],['Pec Deck',3,12],['Push-Up',2,15]]],['Back',[['Lat Pulldown',4,10,1],['T-Bar Row',3,10,1],['Seated Row',3,12],['Back Extension',3,12]]],['Shoulders',[['Shoulder Press',4,10,1],['Lateral Raises',4,15],['Rear Delt Fly',3,15],['DB Shrugs',3,15]]],['Arms',[['Biceps Curl',3,10,1],['Hammer Curl',3,10],['Triceps Pushdown',3,12,1],['Cable Overhead Extension',3,12],['Wrist Curl + Reverse',2,15]]],['Legs',[['Leg Press',4,10,1],['Hack Squat',3,10,1],['Leg Curl',3,12,1],['Leg Extension',3,12],['Calf Raises',4,15]]]]}
];
const sysName=s=>(LANG==='ar'?s.ar:s.en)[0],sysDesc=s=>(LANG==='ar'?s.ar:s.en)[1];
function sysInit(){if(!S.sys)S.sys={cur:'ul4',saved:{}}}
function switchSys(id){
  sysInit();const sp=allSys().find(x=>x.id===id);if(!sp||id===S.sys.cur)return;
  S.sys.saved[S.sys.cur]={days:S.program.days};
  let days=S.sys.saved[id]&&S.sys.saved[id].days;
  if(!days)days=(sp.days||[]).length?sp.days.map((d,k)=>({id:'D'+uid()+k,name:d[0],ex:d[1].map(x=>mk(x[0],x[1],x[2],x[3]))})):seed().program.days;
  delete S.sys.saved[id];S.program.days=days;S.sys.cur=id;pDay=days[0].id;save();queueBackup();
}
/* ================= شاشة التمارين: كل التمارين وشرحها ================= */
const DETL=['العضلات','التجهيز','التنفيذ','أخطاء شائعة','نصيحة'],DETLE=['Muscles','Setup','How to do it','Common mistakes','Coach\'s tip'];
const detEn=(x,o)=>{if(o&&o.de)return o.de;if(o&&o.en!=null)return null;return typeof DETEN!=='undefined'&&DETEN[x[0]]||null};
const secHtml=(d,L,dir,lg)=>d.map((t,k)=>t&&String(t).trim()?`<div class="dsec k${k}" dir="${dir}" lang="${lg}"><b>${L[k]}</b><div style="white-space:pre-wrap">${esc(t)}</div></div>`:'').join('');
function detHtml(x){const o=x[9]?null:libOv(x[0]),d=(o&&o.d)||DET[x[0]];
  if(howLang()==='en'&&!x[9]){const de=detEn(x,o);if(de){const h=secHtml(de,DETLE,'ltr','en');if(h)return h}const en=(o&&o.en!=null)?o.en:x[7];if(en)return `<div class="dsec" dir="ltr" lang="en" style="white-space:pre-wrap">${esc(en)}</div>`}
  if(d){const h=secHtml(d,DETL,'rtl','ar');if(h)return h}
  const sh=(o&&o.short)||x[6];return sh?`<div class="dsec" style="white-space:pre-wrap">${esc(sh)}</div>`:''}
let lbQ='',lbG='all';
function lbRefresh(){const l=$('#lbL');if(!l)return;const o=[...l.querySelectorAll('.lbn[open]')].map(x=>x.dataset.n);l.innerHTML=libRows();o.forEach(n=>{const d=[...l.querySelectorAll('.lbn')].find(x=>x.dataset.n===n);if(d){const g=d.closest('.lgrp');if(g)g.open=true;d.open=true;lbFill(d)}})}
function histBlock(h){
  if(!h.length)return `<div class="mu" style="margin-top:10px">${tr('لسه ماتسجلش في أي جلسة.','Not logged in any session yet.')}</div>`;
  const best=Math.max(...h.map(x=>+x.w||0));
  return `<div class="lhist"><div class="lht"><b>${tr('سجلّك','Your log')}</b> · ${tr(h.length+' جلسة','' +h.length+' session(s)')}${best>0?` · ${tr('أعلى وزن','Best')} <span class="en">${fw(best)}</span>`:''}</div>
  <table class="h">${h.slice(0,10).map(x=>`<tr><td>${fmtD(x.date)}</td><td class="en">${fw(x.w)}</td><td class="en">${esc(setsStr(x))}</td></tr>`).join('')}</table>${h.length>10?`<div class="mu">+${h.length-10}</div>`:''}</div>`;
}
function lbBody(x,hm){return `<div class="howto">${detHtml(x)||`<span class="mu">${tr('مفيش شرح. اضغط تعديل واكتب شرحك.','No guide yet. Tap Edit and write yours.')}</span>`}</div>${notesHtml(x[0])}
    ${histBlock(hm[nk(x[0])]||[])}
    <div class="pact" style="border:0;padding-top:4px;margin-top:6px"><button class="plink" data-a="lbAdd" data-n="${esc(x[0])}">${tr('ضيف لبرنامجي…','Add to my program…')}</button><button class="plink" data-a="hwEdit" data-n="${esc(x[0])}">${tr('تعديل الشرح','Edit guide')}</button>${x[9]?`<button class="plink" data-a="cuEdit" data-n="${esc(x[0])}">${tr('تعديل التمرين','Edit exercise')}</button>`:''}</div>`}
function lbFill(d){const b=d.querySelector('.lbody');if(!b||b.dataset.f)return;const n=d.dataset.n,x=allLib().find(q=>q[0]===n);if(!x)return;b.dataset.f='1';const m=memoOf(n);b.innerHTML=`<div class="lmemo${m?'':' empty'}" dir="auto" data-a="memo" data-n="${esc(n)}"><b>${tr('ملاحظتي','My note')}</b>${m?esc(m):tr('اضغط واكتب ملاحظتك','Tap to write your note')}</div>`+lbBody(x,histMap())}
let lbE='all';const lbOpenG=new Set();
const lbMatch=(x,q)=>{if(!q)return true;const m=META[x[0]];return x[0].toLowerCase().includes(q)||!!(m&&m.ar.includes(q))};
const lbEq=x=>(META[x[0]]||{eq:'other'}).eq;
function libRows(){
  const q=lbQ.trim().toLowerCase(),inP=new Set(S.program.days.flatMap(d=>d.ex.map(t=>t.name)));
  const r=allLib().filter(x=>(lbG==='all'||x[1]===lbG)&&(lbE==='all'||lbEq(x)===lbE)&&lbMatch(x,q));
  if(!r.length)return `<div class="empty">—</div>`;
  const row=x=>`<details class="pr2 lbn" data-n="${esc(x[0])}"><summary data-lp="lx" data-n="${esc(x[0])}"><div class="sp"><div class="pnm en">${esc(x[0])}</div><div class="mu">${LANG==='ar'&&META[x[0]]?esc(META[x[0]].ar)+' · ':''}<span class="en">${x[3]}×${x[4]}${x[5]?' '+esc(unitTxt(x[5])):''}</span> · ${(EQN[lbEq(x)]||EQN.other)[LANG==='ar'?0:1]}${x[9]?' · '+tr('تمريني','Mine'):''}</div></div>${inP.has(x[0])?'<span class="pdot"></span>':''}<span class="pchev">⌄</span></summary>
    <div class="lbody"></div></details>`;
  return GRP_ORDER.map(g=>{const rs=r.filter(x=>x[1]===g);if(!rs.length)return '';
    const op=!!q||lbG!=='all'||lbOpenG.has(g);
    return `<details class="lgrp" data-g="${g}"${op?' open':''}><summary><b>${GRP[g][LANG==='ar'?0:1]}</b><span class="lgc en">${rs.length}</span><span class="pchev">⌄</span></summary>${rs.map(row).join('')}</details>`}).join('');
}
function renderLib(){
  $('#view').innerHTML=`<div class="lsearch"><input id="lbS" dir="auto" placeholder="${tr('ابحث عن تمرين…','Search exercises…')}" value="${esc(lbQ)}" style="text-align:start"><button class="ptxt" data-a="cuNew">+ ${tr('تمرين مخصص','Custom')}</button></div>
  <div class="lbf"><select id="lbEq" class="psel">${['all'].concat(EQ_ORDER).map(e=>`<option value="${e}"${lbE===e?' selected':''}>${e==='all'?tr('كل الأدوات','All gear'):EQN[e][LANG==='ar'?0:1]}</option>`).join('')}</select></div>
  <div class="mu lcount">${allLib().length} ${tr('تمرين','exercises')} · <span class="pdot in"></span> ${tr('في برنامجك','in your program')}</div>
  <div class="plist" id="lbL">${libRows()}</div>`;
  $('#lbEq').onchange=e=>{lbE=e.target.value;const l=$('#lbL');if(l)l.innerHTML=libRows()};
}
const lbEChips=()=>`<button class="${lbE==='all'?'on':''}" data-a="lbE" data-e="all">${tr('كل الأدوات','All gear')}</button>${EQ_ORDER.map(e=>`<button class="${lbE===e?'on':''}" data-a="lbE" data-e="${e}">${EQN[e][LANG==='ar'?0:1]}</button>`).join('')}`;
const lbChips=()=>`<button class="${lbG==='all'?'on':''}" data-a="lbG" data-g="all">${tr('الكل','All')}</button>${Object.keys(GRP).map(g=>`<button class="${lbG===g?'on':''}" data-a="lbG" data-g="${g}">${GRP[g][LANG==='ar'?0:1]}</button>`).join('')}`;
function hwModal(n){
  const x=libGet(n);if(!x)return;
  const nt=`<label class="fld">${tr('ملاحظاتك (سطر لكل ملاحظة)','Your notes (one per line)')}<textarea class="inp" id="hwN" rows="3" dir="auto">${esc(exNotes(n).map(q=>q.t).join('\n'))}</textarea></label>`;
  if(x[9]){modal(`<h3 class="en">${esc(n)}</h3>${nt}<div class="row"><button class="btn pri sp" data-a="hwSave" data-n="${esc(n)}">${T().saveB}</button><button class="btn sp" data-a="cuEdit" data-n="${esc(n)}">${tr('تعديل التمرين','Edit exercise')}</button><button class="btn ghost" data-a="closeM">${T().cancel}</button></div>`);return}
  const o=libOv(n)||{},E=howLang()==='en',dir=E?'ltr':'rtl',L=E?DETLE:DETL;
  const d=E?(detEn(x,o)||(o.en!=null?[ '',o.en,'','','']:null)||['','','','','']):(o.d||DET[n]||['','','','','']);
  const sh=E?(o.shortEn!=null&&o.shortEn!==''?o.shortEn:(x[7]||'')):(o.short!=null&&o.short!==''?o.short:x[6]);
  modal(`<h3 class="en">${esc(n)}</h3><div class="mu" style="margin-bottom:10px">${tr('عدّل الشرح والمعلومات. اللي تكتبه هو اللي هيظهر في شاشة اللعب.','Edit the guide and notes. What you write is what shows in the session screen.')} <span class="en">(${E?'English':'عربي'})</span></div>
  <label class="fld">${tr('ملخص قصير (بيظهر تحت المجموعات في اللعب)','Short summary (shown under the sets)')}<textarea class="inp${E?' en':''}" id="hwS" rows="2" dir="${dir}">${esc(sh)}</textarea></label>
  ${L.map((t,k)=>`<label class="fld">${t}<textarea class="inp${E?' en':''}" id="hwD${k}" rows="${k===3?4:3}" dir="${dir}">${esc(d[k]||'')}</textarea></label>`).join('')}
  ${nt}
  <div class="mu" style="margin:-4px 0 12px">${tr('لغة الشرح بتتغيّر من «الملف» ← اللغة.','The guide language is set in File → Language.')}</div>
  <div class="row"><button class="btn pri sp" data-a="hwSave" data-n="${esc(n)}">${T().saveB}</button><button class="btn ghost" data-a="closeM">${T().cancel}</button></div>
  ${o.d||o.de||o.en!=null||o.short!=null||o.shortEn!=null?`<button class="btn w ghost dan mt" data-a="hwReset" data-n="${esc(n)}">${tr('رجّع الشرح الأصلي','Restore original guide')}</button>`:''}`);
}
function hwApply(n,old){
  save();queueBackup();
  const nw=libHow(n);if(S.draft)S.draft.ex.forEach(e=>{if(e.name===n&&e.note0===old)e.note0=nw});save();
  closeModal();if($('#sess')&&!$('#sess').hidden)renderSession();else if($('#lbL'))lbRefresh();
}
function hwSave(n){
  const x=libGet(n);if(!x)return;const old=libHow(n);
  {const k=String(n).trim().toLowerCase(),prev=exNotes(n),ls=($('#hwN').value||'').split('\n').map(t=>t.trim()).filter(Boolean);S.exNotes=S.exNotes||{};
   if(ls.length)S.exNotes[k]=ls.map(t=>{const q=prev.find(z=>z.t===t);return q||{d:today(),t}});else delete S.exNotes[k]}
  if(x[9]){hwApply(n,old);toast(tr('اتحفظ ✓','Saved ✓'));return}
  const d=[0,1,2,3,4].map(k=>$('#hwD'+k).value.trim()),sh=$('#hwS').value.trim(),E=howLang()==='en';
  S.libOv=S.libOv||{};const o=Object.assign({},S.libOv[n]||{});
  if(E){const d0=(typeof DETEN!=='undefined'&&DETEN[n])||['','','','',''];delete o.en;
    if(d.every((t,k)=>t===(d0[k]||'')))delete o.de;else o.de=d;
    if(sh===(x[7]||''))delete o.shortEn;else o.shortEn=sh}
  else{const d0=DET[n]||['','','','',''];
    if(d.every((t,k)=>t===(d0[k]||'')))delete o.d;else o.d=d;
    if(sh===x[6])delete o.short;else o.short=sh}
  if(Object.keys(o).length)S.libOv[n]=o;else delete S.libOv[n];
  hwApply(n,old);toast(tr('اتحفظ ✓','Saved ✓'));
}
function cuModal(n){
  const c=n?(S.custom||[]).find(x=>x.name===n):null,t=c||{name:'',g:'chest',w:'',sets:3,reps:12,unit:'',how:''};
  modal(`<h3>${c?tr('تعديل التمرين','Edit exercise'):tr('تمرين جديد','New exercise')}</h3>
  <label class="fld">${tr('الاسم','Name')}<input class="inp en" id="cuN" value="${esc(t.name)}" style="text-align:left"></label>
  <label class="fld">${tr('العضلة','Muscle group')}<select class="inp" id="cuG">${Object.keys(GRP).map(g=>`<option value="${g}"${cuG(t)===g?' selected':''}>${GRP[g][LANG==='ar'?0:1]}</option>`).join('')}</select></label>
  <div class="fgrid"><label class="fld">${T().weight}<input class="inp" id="cuW" inputmode="decimal" value="${esc(t.w)}"></label><label class="fld">${T().sets}<input class="inp" id="cuS" inputmode="numeric" value="${esc(t.sets)}"></label><label class="fld">${T().reps}<input class="inp" id="cuR" inputmode="numeric" value="${esc(t.reps)}"></label></div>
  <label class="fld">${T().unit}<select class="inp" id="cuU">${['','ث','خطوة','د'].map(u=>`<option value="${u}"${t.unit===u?' selected':''}>${T().units[u]}</option>`).join('')}</select></label>
  ${c?'':`<label class="fld">${tr('تضيفه لبرنامجك؟ (اختياري)','Add to your program? (optional)')}<select class="inp" id="cuD"><option value="">${tr('لا، في المكتبة بس','No, library only')}</option>${S.program.days.map(x=>`<option value="${x.id}"${x.id===pDay&&tab==='prog'?'':''}>${tr('ضيفه لـ ','Add to ')}${esc(x.name)}</option>`).join('')}</select></label>`}
  <label class="fld">${tr('الشرح والتعليمات','Instructions')}<textarea class="inp" id="cuH" rows="7" placeholder="${tr('التجهيز، التنفيذ، الأخطاء، نصيحتك…','Setup, execution, mistakes, tips…')}">${esc(t.how)}</textarea></label>
  <div class="row"><button class="btn pri sp" data-a="cuSave" data-n="${esc(t.name)}">${T().saveB}</button>${c?`<button class="btn dan" data-a="cuDel" data-n="${esc(t.name)}">${T().del}</button>`:''}<button class="btn ghost" data-a="closeM">${T().cancel}</button></div>`);
}
function cuSave(old){
  const name=$('#cuN').value.trim();if(!name){toast(T().nameReq);return}
  if(name!==old&&allLib().some(x=>x[0].toLowerCase()===name.toLowerCase())){toast(tr('الاسم ده موجود فعلًا','That name already exists'));return}
  const g=k=>{const v=num($(k).value);return isNaN(v)?'':v};
  S.custom=S.custom||[];let c=old&&S.custom.find(x=>x.name===old);if(!c){c={};S.custom.push(c)}
  Object.assign(c,{name,g:$('#cuG').value,w:g('#cuW')||0,sets:Math.max(1,g('#cuS')||3),reps:g('#cuR')||12,unit:$('#cuU').value,how:$('#cuH').value.trim()});
  if(old&&old!==name)S.program.days.forEach(d=>d.ex.forEach(t=>{if(t.name===old)t.name=name}));
  const dv=$('#cuD')?$('#cuD').value:'',td=dv&&S.program.days.find(x=>x.id===dv);if(td)td.ex.push(mk(name));
  save();queueBackup();closeModal();if(tab==='prog')renderProgram();else renderLib();toast(td?tr('اتحفظ واتضاف لـ ','Saved and added to ')+td.name+' ✓':tr('اتحفظ في المكتبة ✓','Saved to library ✓'));
}
/* ================= شاشة البرنامج ================= */
let pDay='U1',pEdit=false,pInit=false;
function shortDay(n){
  const m=String(n).trim().match(/^(upper|lower|push|pull|legs?)\s*(\d*)$/i);
  if(m){const k=m[1].toLowerCase();return (k==='upper'?'U':k==='lower'?'L':k==='push'?'Push':k==='pull'?'Pull':'Legs')+m[2]}
  n=String(n).trim();return n.length>6?n.slice(0,5)+'…':n;
}
function renderProgram(){
  sysInit();const L=T(),days=S.program.days;
  if(!pInit){pInit=true;try{pDay=nextDayId()}catch(e){}}
  if(!days.some(d=>d.id===pDay))pDay=days[0].id;
  const d=day(pDay),sp=allSys().find(x=>x.id===S.sys.cur)||SYSTEMS[0];
  const cores=d.ex.filter(t=>t.core).map(t=>esc(t.name));
  const rows=d.ex.map((t,i)=>{
    const l=exHist(t.id)[0],lb=libGet(t.name),bw=baseH(t.id);
    const meta=`<span class="en">${fw(bw?bw.w:t.w)} · ${t.sets}×${t.reps}${t.unit?' '+esc(unitTxt(t.unit)):''}</span>`;
    if(pEdit)return `<div class="pr2" data-i="${i}"><span class="pgrip" data-grip aria-label="${tr('اسحب للترتيب','Drag to reorder')}">≡</span><div class="pr2b" data-a="editT" data-i="${i}"><span class="pno${t.core?' cr':''}">${i+1}</span><div class="sp"><div class="pnm en">${esc(t.name)}</div><div class="mu">${meta}</div></div><span class="pchev">✎</span></div></div>`;
    const last=l?`${setsStr(l)?setsStr(l)+' · ':''}${fw(l.w)} · ${esc(l.date||'')}`:tr('لسه ماتلعبش','Not logged yet');
    return `<details class="pr2"><summary data-lp="pt" data-i="${i}" data-n="${esc(t.name)}"><span class="pno${t.core?' cr':''}">${i+1}</span><div class="sp"><div class="pnm en">${esc(t.name)}</div><div class="mu">${meta}${lb?` · ${GRP[lb[1]][LANG==='ar'?0:1]}`:''}</div></div><span class="pchev">⌄</span></summary><div class="pdrop"><div class="mu">${tr('آخر أداء','Last time')}: <span class="en">${last}</span></div><button class="plink" data-a="exInfo" data-i="${i}">${tr('طريقة اللعب','How to perform')}</button></div></details>`;
  }).join('')||`<div class="empty">${tr('اليوم فاضي.','Empty day.')}</div>`;
  const tabs=days.map((x,k)=>`<button class="${x.id===pDay?'on':''}" data-a="pday" data-d="${x.id}">${esc(shortDay(x.name))}</button>`).join('');
  $('#view').innerHTML=`<button class="psys" data-a="sysOpen"><span class="en">${esc(sysName(sp))}</span><span class="pchev">⌄</span></button>
  <div class="ptabs">${tabs}</div>
  <div class="phead"><div class="pdn en">${esc(d.name)}</div><button class="ptxt" data-a="pedit">${pEdit?tr('تم','Done'):tr('تعديل','Edit')}</button></div>
  ${pDay==='FB'?`<div class="pfbn">${tr('ده الفول بادي اللي بيتلعب في جلسة الرجوع بعد الغياب. مش جزء من الدورة. عدّل تمارينه ومجموعاته زي ما انت عايز، والتطبيق بيحط الأوزان المخففة لوحده.','The full body played in the comeback session after a break. It is not part of the rotation. Edit its exercises and sets as you like; the app sets the reduced weights itself.')}</div>`:''}
  <div class="plist${pEdit?' ed':''}">${rows}</div>
  ${pEdit?`<div class="pact"><button class="plink" data-a="libOpen">+ ${tr('تمرين','Exercise')}</button>${pDay==='FB'?`<button class="plink" data-a="fbReset">${tr('رجّعه للاختيار التلقائي','Reset to automatic')}</button>`:''}<button class="plink" data-a="dayEdit">${tr('اسم اليوم','Rename day')}</button><button class="plink" data-a="copyT">${L.copyTpl}</button></div>`
  :`${cores.length?`<div class="pcore"><b>${tr('الأساسي','Essentials')}:</b> <span class="en">${cores.join(' + ')}</span></div>`:''}${d.ex.length?`<button class="btn pri w pgo" data-a="start" data-d="${d.id}">${tr('ابدأ اليوم ده','Start this day')}</button>`:`<button class="btn pri w pgo" data-a="libOpen">+ ${tr('ضيف تمرين من المكتبة','Add from library')}</button>`}`}`;
}
function infoModal(i){
  const d=day(pDay),t=d.ex[i];if(!t)return;const lb=libGet(t.name),how=libHow(t.name),l=baseH(t.id);
  modal(`<h3 class="en" style="text-align:start">${esc(t.name)}</h3>
  <div class="mu" style="margin-bottom:10px">${lb?GRP[lb[1]][LANG==='ar'?0:1]+' · ':''}<span class="en">${fw(l?l.w:t.w)} | ${t.sets}×${t.reps}${t.unit?' '+esc(unitTxt(t.unit)):''}</span></div>
  <div class="howto">${lb&&detHtml(lb)||`<span class="mu">${tr('مفيش شرح جاهز للتمرين ده. اكتب تعليماتك الخاصة في التعديل.','No built-in guide for this exercise. Add your own instructions in Edit.')}</span>`}</div>
  ${t.note&&t.note!==how?`<div class="tnote" style="margin-top:10px"><b>${tr('ملاحظتك','Your note')}:</b> ${esc(t.note)}</div>`:''}
  <div class="row mt"><button class="btn pri sp" data-a="editT" data-i="${i}">${tr('تعديل التمرين','Edit exercise')}</button><button class="btn ghost" data-a="closeM">${T().close}</button></div>`);
}
let libQ='',libG='all',libFor='prog';
function libRowsHtml(){
  const q=libQ.trim().toLowerCase();
  const sx=(libFor==='sess'||libFor==='swap')&&S.draft,inS=n=>sx&&S.draft.ex.some(e=>nk(e.name)===nk(n));
  const sf=n=>{const m=typeof META!=='undefined'&&META[n];return m&&(m.eq==='mach'||m.eq==='cable')?0:m&&m.eq==='bb'?2:1};let li=allLib().filter(x=>(libG==='all'||x[1]===libG)&&lbMatch(x,q));if(S.settings.safe||libFor==='swap')li=li.slice().sort((a,b)=>sf(a[0])-sf(b[0]));
  return li.map(x=>`<div class="prow" data-a="${sx?(libFor==='swap'?'sxSwap':'sxAdd'):'libAdd'}" data-n="${esc(x[0])}"><div class="sp"><div class="nm en">${esc(x[0])}</div><div class="mu">${(GRP[x[1]]||GRP.core)[LANG==='ar'?0:1]} · <span class="en">${x[3]}×${x[4]}</span></div></div><span class="icb">${inS(x[0])?'✓':'+'}</span></div>`).join('')||`<div class="empty">—</div>`;
}
function libModal(){
  const rows=libRowsHtml();
  const sw=libFor==='swap'&&S.draft,sx=(libFor==='sess'||sw)&&S.draft,pd=libFor==='sess'&&sx&&S.program.days.find(x=>x.id===S.draft.day),pg=!!(pd&&S.settings.sxProg);
  modal(`<h3>${sw?tr('بدّل بتمرين لنفس العضلة','Swap for the same muscle'):sx?tr('ضيف تمرين للجلسة','Add an exercise'):tr('مكتبة التمارين','Exercise library')}</h3>
  ${pd?`<div class="thseg sxs"><button class="${pg?'':'on'}" data-a="sxProg" data-v="0">${tr('الجلسة دي بس','This session only')}</button><button class="${pg?'on':''}" data-a="sxProg" data-v="1">${tr('وفي البرنامج كمان','Also in the program')}</button></div>`:''}
  <input class="inp" id="libS" dir="auto" placeholder="${tr('ابحث…','Search…')}" value="${esc(libQ)}" style="text-align:start;margin-bottom:8px">
  <div class="chips"><button class="${libG==='all'?'on':''}" data-a="libG" data-g="all">${tr('الكل','All')}</button>${Object.keys(GRP).map(g=>`<button class="${libG===g?'on':''}" data-a="libG" data-g="${g}">${GRP[g][LANG==='ar'?0:1]}</button>`).join('')}</div>
  <div id="libR" style="max-height:44vh;overflow-y:auto">${rows}</div>
  <div class="row mt">${sx?'':`<button class="btn sp" data-a="addT">${tr('تمرين مخصص','Custom exercise')}</button>`}<button class="btn ghost${sx?' sp':''}" data-a="closeM">${T().close}</button></div>`);
  }
function sysModal(){
  sysInit();
  modal(`<h3>${tr('اختار النظام','Choose a system')}</h3>
  <div class="mu" style="margin-bottom:10px">${tr('تمارينك في النظام الحالي بتتحفظ وترجعلها لو رجعت له. الأوزان بتتاخد من آخر مرة لعبت فيها نفس التمرين.','Your exercises in the current system are kept if you return. Weights come from the last time you did the same exercise.')}</div>
  <button class="btn w" data-a="npNew" style="margin-bottom:12px">+ ${tr('برنامج جديد من الصفر','New program from scratch')}</button>
  ${allSys().map(s=>{const cur=S.sys.cur===s.id;const dn=s.mine?(cur?S.program.days:(S.sys.saved[s.id]?S.sys.saved[s.id].days.map(x=>x.name):['Upper 1','Lower 1','Upper 2','Lower 2'])).map?.(x=>x.name||x):[];const names=s.days?s.days.map(x=>x[0]):dn;
   return `<div class="sysopt${cur?' on':''}"><div class="sp"><div class="nm">${esc(sysName(s))}${cur?` <span class="tag">${tr('الحالي','Current')}</span>`:''}</div><div class="mu">${esc(sysDesc(s))}</div><div class="mu en" style="margin-top:3px">${names.map(esc).join(' · ')}</div></div>${cur?'':`<div class="sysb"><button class="btn sm pri" data-a="sysPick" data-id="${s.id}">${tr('استخدم','Use')}</button>${s.custom?`<button class="btn sm ghost" data-a="npDel" data-id="${s.id}">${tr('امسح','Delete')}</button>`:''}</div>`}</div>`}).join('')}
  <button class="btn w mt" data-a="progShare">${tr('مشاركة أو استيراد برنامج بكود','Share or import a program code')}</button>
  <div class="row mt"><button class="btn ghost sp" data-a="closeM">${T().close}</button></div>`);
}
function dayModal(){
  const d=day(pDay);
  modal(`<h3>${tr('تعديل اليوم','Edit day')}</h3>
  <label class="fld">${tr('اسم اليوم','Day name')}<input class="inp en" id="dName" maxlength="24" value="${esc(d.name)}" style="text-align:left"></label>
  <div class="row"><button class="btn pri sp" data-a="daySave">${T().saveB}</button>${S.program.days.length>1&&pDay!=='FB'?`<button class="btn dan" data-a="dayDel">${tr('احذف اليوم','Delete day')}</button>`:''}<button class="btn ghost" data-a="closeM">${T().cancel}</button></div>`);
}
function tplModal(i){
  const L=T(),d=day(pDay),t=i>-1?d.ex[i]:{name:'',w:'',sets:3,reps:12,goal:12,unit:'',core:false,note:''};
  modal(`<h3>${i>-1?L.editEx:L.newEx}</h3>
  <label class="fld">${L.name}<input class="inp en" id="tName" list="libdl" value="${esc(t.name)}" style="text-align:left"><datalist id="libdl">${allLib().map(x=>`<option value="${esc(x[0])}">`).join('')}</datalist></label>
  <div class="fgrid"><label class="fld">${L.weight}<input class="inp" id="tW" inputmode="decimal" value="${esc(t.w)}"></label><label class="fld">${L.sets}<input class="inp" id="tS" inputmode="numeric" value="${esc(t.sets)}"></label><label class="fld">${L.reps}<input class="inp" id="tR" inputmode="numeric" value="${esc(t.reps)}"></label></div>
  <div class="fgrid"><label class="fld">${L.goal}<input class="inp" id="tG" inputmode="numeric" value="${esc(t.goal)}"></label><label class="fld" style="grid-column:span 2">${L.unit}<select class="inp" id="tU">${['','ث','خطوة','د'].map(u=>`<option value="${u}" ${t.unit===u?'selected':''}>${L.units[u]}</option>`).join('')}</select></label></div>
  <label class="cl" style="margin:4px 0 12px"><input type="checkbox" id="tC" ${t.core?'checked':''}>${L.coreEx}</label>
  <label class="fld">${L.instr}<textarea class="inp" id="tN" rows="2">${esc(t.note)}</textarea></label>
  <div class="mu" style="margin-bottom:10px">${L.tplHint}</div>
  <div class="row"><button class="btn pri sp" data-a="saveT" data-i="${i}">${L.saveB}</button>${i>-1?`<button class="btn dan" data-a="delT" data-i="${i}">${L.del}</button>`:''}<button class="btn ghost" data-a="closeM">${L.cancel}</button></div>`);
}
function saveTpl(i){
  const name=$('#tName').value.trim();if(!name){toast(T().nameReq);return}
  const g=k=>{const v=num($(k).value);return isNaN(v)?'':v};
  const d=day(pDay),t=i>-1?d.ex[i]:{id:uid()};
  Object.assign(t,{name,w:g('#tW'),sets:Math.max(1,g('#tS')||3),reps:g('#tR')||12,goal:g('#tG')||g('#tR')||12,unit:$('#tU').value,core:$('#tC').checked,note:$('#tN').value.trim()});
  if(i<0)d.ex.push(t);save();queueBackup();closeModal();renderProgram();
}

/* ================= النسخة الاحتياطية (.md) ================= */
const FS='showSaveFilePicker' in window&&!window.Android;
/* الـ APK الجديد بيربط ملف ويقراه بنفسه (النسخة القديمة من الـ APK مفيهاش الدوال دي) */
const NL=!!(window.Android&&Android.linkFile);
const idb=(()=>{let p;const db=()=>p||(p=new Promise((res,rej)=>{const r=indexedDB.open('gymlog',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)}));
  return{get:k=>db().then(d=>new Promise((res,rej)=>{const q=d.transaction('kv').objectStore('kv').get(k);q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)})),
         set:(k,v)=>db().then(d=>new Promise((res,rej)=>{const t=d.transaction('kv','readwrite');t.objectStore('kv').put(v,k);t.oncomplete=()=>res();t.onerror=()=>rej(t.error)}))}})();

/* ================= نسخة مشفّرة أوتوماتيك على GitHub ================= */
const enc=new TextEncoder(),dec=new TextDecoder();
const b64=u=>{let t='';for(let i=0;i<u.length;i+=0x8000)t+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000));return btoa(t)};
const unb64=t=>Uint8Array.from(atob(t),c=>c.charCodeAt(0));
const pipe=async(bytes,S2)=>new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(S2)).arrayBuffer());
let SYNC={on:false,repo:'',branch:'gym-backup',path:'sync/state.bin',salt:'',iter:600000,last:0,n:0,dirty:false,missed:0,err:''};
let BKEY=null,running=false,chg=0,brOK=false,rSha=null;
async function loadSync(){try{const c=await idb.get('sync');if(c)Object.assign(SYNC,c)}catch(e){}try{BKEY=(await idb.get('bk.key'))||null}catch(e){}}
const saveSync=()=>idb.set('sync',Object.assign({},SYNC)).catch(()=>{});
async function deriveKey(pass,salt,iter){
  const km=await crypto.subtle.importKey('raw',enc.encode(pass),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations:iter},km,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
async function sealBytes(key,bytes){const iv=crypto.getRandomValues(new Uint8Array(12));return{iv,ct:new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,bytes))}}
/* كل اللي محتاجينه عشان الاسترجاع يرجّع كل حاجة (نفس الشكل في الملف وGitHub) */
const snapData=()=>({program:S.program,sessions:S.sessions,settings:S.settings,draft:S.draft||null,sys:S.sys||null,custom:S.custom||[],myProgs:S.myProgs||[],libOv:S.libOv||{},exNotes:S.exNotes||{},exMemo:S.exMemo||{},steps:S.steps||{},body:S.body||[],mig:S.mig||0,fbDay:S.fbDay||null,dl:S.dl||null,prot:S.prot||null,gyms:S.gyms||[]});
async function packBackup(){
  const payload=enc.encode(JSON.stringify({app:'gymlog',v:1,at:Date.now(),data:snapData()}));
  let z=null;try{z=await pipe(payload,new CompressionStream('gzip'))}catch(e){}
  const {iv,ct}=await sealBytes(BKEY,z||payload);
  return JSON.stringify({app:'gymlog-enc',v:1,kdf:'PBKDF2-SHA256',iter:SYNC.iter,salt:SYNC.salt,iv:b64(iv),z:z?1:0,ct:b64(ct)});
}
async function openBackup(txt,keyOrPass){
  const o=JSON.parse(txt);if(o.app!=='gymlog-enc')throw new Error('fmt');
  const key=typeof keyOrPass==='string'?await deriveKey(keyOrPass,unb64(o.salt),o.iter):keyOrPass;
  let p;try{p=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(o.iv)},key,unb64(o.ct)))}catch(e){throw new Error('pass')}
  if(o.z)p=await pipe(p,new DecompressionStream('gzip'));
  return JSON.parse(dec.decode(p));
}
async function getToken(){const t=await idb.get('bk.token');if(!t||!BKEY)throw new Error('notoken');return dec.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:t.iv},BKEY,t.ct))}
async function gh(method,url,body,accept,tok){
  tok=tok||await getToken();
  const r=await fetch('https://api.github.com'+url,{method,cache:'no-store',headers:Object.assign({Authorization:'Bearer '+tok,Accept:accept||'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},body?{'Content-Type':'application/json'}:{}),body:body?JSON.stringify(body):undefined});
  return r;
}
const ghErr=r=>new Error(r.status===401||r.status===403?'token':r.status===404?'repo':'http'+r.status);
async function ensureBranch(tok){
  const R=SYNC.repo;let r=await gh('GET',`/repos/${R}/git/ref/heads/${SYNC.branch}`,null,null,tok);
  if(r.ok)return;if(r.status!==404&&r.status!==409)throw ghErr(r);
  const rr=await gh('GET',`/repos/${R}`,null,null,tok);if(!rr.ok)throw ghErr(rr);
  const def=(await rr.json()).default_branch;
  let br=await gh('GET',`/repos/${R}/git/ref/heads/${def}`,null,null,tok);
  if(!br.ok&&(br.status===404||br.status===409)){
    const init=await gh('PUT',`/repos/${R}/contents/README.md`,{message:'init',content:btoa('Gym log - encrypted backup\n'),branch:def},null,tok);
    if(!init.ok)throw ghErr(init);
    br=await gh('GET',`/repos/${R}/git/ref/heads/${def}`,null,null,tok);
  }
  if(!br.ok)throw ghErr(br);
  const sha=(await br.json()).object.sha;
  r=await gh('POST',`/repos/${R}/git/refs`,{ref:'refs/heads/'+SYNC.branch,sha},null,tok);
  if(!r.ok&&r.status!==422)throw ghErr(r);
}
async function putBackup(text){
  const url=`/repos/${SYNC.repo}/contents/${SYNC.path}`;
  for(let k=0;k<3;k++){
    let sha=rSha;
    if(!sha){const g=await gh('GET',`${url}?ref=${SYNC.branch}`);if(g.ok)sha=(await g.json()).sha;else if(g.status!==404)throw ghErr(g)}
    const p=await gh('PUT',url,Object.assign({message:'sync '+new Date().toISOString().slice(0,16),content:b64(enc.encode(text)),branch:SYNC.branch},sha?{sha}:{}));
    if(p.ok){try{rSha=(await p.json()).content.sha}catch(e){rSha=null}return}
    rSha=null;if(p.status!==409&&p.status!==422)throw ghErr(p);
  }
  throw new Error('conflict');
}
async function readRemote(tok){
  const r=await gh('GET',`/repos/${SYNC.repo}/contents/${SYNC.path}?ref=${SYNC.branch}`,null,'application/vnd.github.raw+json',tok);
  if(r.status===404)throw new Error('nofile');if(!r.ok)throw ghErr(r);return r.text();
}
async function runBackup(verify){
  if(!SYNC.on||!BKEY||running||!navigator.onLine)return false;
  running=true;const my=chg;let ok=false;
  try{
    if(!brOK){await ensureBranch();brOK=true}
    await putBackup(await packBackup());
    if(verify){const back=await openBackup(await readRemote(),BKEY);if(!back.data||back.data.sessions.length!==S.sessions.length)throw new Error('verify')}
    if(chg===my)SYNC.dirty=false;SYNC.missed=0;SYNC.last=Date.now();SYNC.n=S.sessions.length;SYNC.err='';ok=true;markBackup();
  }catch(e){SYNC.err=String(e.message||e);brOK=false;rSha=null}
  running=false;await saveSync();
  if(ok&&chg!==my)runBackup();
  refresh();return ok;
}
/* مسودة مفتوحة: ارفع بحد أقصى مرة كل 10 دقايق (الحفظ الفعلي بيرفع دايمًا) */
function queueDraftBackup(){if(SYNC.on&&Date.now()-(SYNC.last||0)>6e5)queueBackup()}
function queueBackup(session){if(!SYNC.on)return;chg++;SYNC.dirty=true;if(session)SYNC.missed++;saveSync();runBackup()}
const PUB_REPO='notimetocry29-dot/leviathan-';
const syncPublic=()=>SYNC.on&&String(SYNC.repo).toLowerCase()===PUB_REPO;
const syncMsg=e=>({token:tr('التوكن مرفوض أو منتهي','Token rejected or expired'),repo:tr('الريبو مش موجود أو التوكن ملوش صلاحية عليه','Repo not found or the token has no access to it'),conflict:tr('تعارض في الرفع، هيعيد المحاولة','Upload conflict, will retry'),verify:tr('الملف اترفع بس التحقق فشل','Uploaded but verification failed'),pass:tr('العبارة غلط','Wrong passphrase'),nofile:tr('مفيش نسخة في الريبو','No backup in the repo')}[e]||e);
async function enableSync(){
  const tok=$('#gTok').value.trim(),p1=$('#gP1').value,p2=$('#gP2').value,repo=$('#gRepo').value.trim();
  if(!tok||p1.length<6||p1!==p2||!/^[\w.-]+\/[\w.-]+$/.test(repo)){toast(T().syncBadIn);return}
  return enableSyncWith(tok,p1,repo);
}
async function enableSyncWith(tok,p1,repo){
  toast(T().syncBusy);
  try{
    const salt=crypto.getRandomValues(new Uint8Array(16));
    brOK=false;rSha=null;SYNC=Object.assign(SYNC,{repo,salt:b64(salt),iter:600000,on:true,dirty:true,missed:0,err:''});chg++;
    BKEY=await deriveKey(p1,salt,SYNC.iter);
    const {iv,ct}=await sealBytes(BKEY,enc.encode(tok));
    await idb.set('bk.token',{iv,ct});await idb.set('bk.key',BKEY);await saveSync();
    const ok=await runBackup(true);
    if(!ok){const e=SYNC.err;SYNC.on=false;BKEY=null;await saveSync();try{await idb.set('bk.token',null);await idb.set('bk.key',null)}catch(_){}toast(T().syncErr(syncMsg(e)));renderData();return}
    toast(T().syncOK);renderData();
  }catch(e){SYNC.on=false;await saveSync();toast(T().syncErr(syncMsg(String(e.message||e))))}
}
async function disableSync(){
  if(!await ask(T().syncConfOff,{danger:1}))return;
  SYNC.on=false;BKEY=null;await saveSync();try{await idb.set('bk.token',null);await idb.set('bk.key',null)}catch(e){}renderData();
}
async function restoreRemote(){
  const tok=$('#gTok').value.trim(),p1=$('#gP1').value,repo=$('#gRepo').value.trim();
  if(!tok||!p1||!/^[\w.-]+\/[\w.-]+$/.test(repo)){toast(T().syncBadIn);return}
  toast(T().syncBusy);
  try{
    SYNC.repo=repo;brOK=false;rSha=null;
    const o=await openBackup(await readRemote(tok),p1);
    if(!await applyRestore(o.data))return;
    if(!SYNC.on&&await ask(T().syncAfterRestore))await enableSyncWith(tok,p1,repo);
  }catch(e){toast(T().syncErr(syncMsg(String(e.message||e))))}
}
/* ================= الاسترجاع (ملف أو GitHub) ================= */
const HIST_MIG=5;/* آخر ترحيل بيستورد السجل القديم: بعد الاسترجاع مايتعادش أبدًا */
/* v114: أي رقم جاي من ملف بيتحوّل رقم فعلًا، والوحدة من قايمة ثابتة (ملف متلغّم مايقدرش يحط كود) */
const nn=(v,a,b,d)=>{const x=Number(v);return isFinite(x)?Math.min(b,Math.max(a,x)):d};
const UNITS=['','ث','خطوة','د'],okU=u=>UNITS.includes(u)?u:'';
const cleanEx=e=>({exId:String(e.exId||'h:'+e.name),name:String(e.name).slice(0,80),unit:okU(e.unit),core:!!e.core,goal:nn(e.goal,0,999,12),tsets:nn(e.tsets,1,20,3),treps:nn(e.treps,0,999,10),w:e.w===''||e.w==null?'':nn(e.w,0,2000,0),sets:e.sets.map(Number).filter(v=>isFinite(v)&&v>0).map(v=>Math.min(v,999)),dur:Array.isArray(e.dur)?e.dur.map(x=>nn(x,0,36000,0)):undefined,rir:e.rir==null?undefined:nn(e.rir,0,3,2),ss:e.ss?1:undefined,add:e.add?1:undefined,from:e.from?String(e.from).slice(0,80):undefined,ws:Array.isArray(e.ws)?e.ws.map(x=>nn(x,0,2000,0)):undefined,clean:!!e.clean,note:String(e.note||'').slice(0,500)});
const cleanT=t=>({ss:!!t.ss,id:String(t.id),name:String(t.name).slice(0,80),w:nn(t.w,0,2000,0),sets:nn(t.sets,1,20,3),reps:nn(t.reps,1,999,10),goal:nn(t.goal,1,999,12),unit:okU(t.unit),core:!!t.core,note:String(t.note||'').slice(0,1000)});
function cleanSession(s){
  if(!s||typeof s!=='object'||typeof s.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s.date)||!Array.isArray(s.ex))return null;
  const ex=s.ex.filter(e=>e&&typeof e.name==='string'&&Array.isArray(e.sets)).map(cleanEx);
  const cb=s.cb&&typeof s.cb==='object'?{k:s.cb.k==='fb'?'fb':'lt',dl:s.cb.dl?1:undefined,p:nn(s.cb.p,.3,1,.9),g:nn(s.cb.g,0,9999,8),i:nn(s.cb.i,0,9,0),n:nn(s.cb.n,1,9,1)}:undefined;
  const o={id:String(s.id||uid()),date:s.date,day:String(s.day||''),dayName:String(s.dayName||s.day||'?').slice(0,80),cycle:nn(s.cycle,1,9999,1),status:['full','core','part','imp'].includes(s.status)?s.status:'part',ts:nn(s.ts,0,9e15,new Date(s.date+'T12:00:00').getTime()),ex};
  if(s.imp)o.imp=1;if(cb)o.cb=cb;if(s.gym&&typeof s.gym==='string')o.gym=s.gym.slice(0,40);if(s.rdy!=null)o.rdy=nn(s.rdy,0,2,1);if(s.t0)o.t0=nn(s.t0,0,9e15,0)||undefined;return o;
}
function cleanRestore(d){
  if(!d||!d.program||!Array.isArray(d.program.days)||!Array.isArray(d.sessions))throw new Error('fmt');
  const days=d.program.days.filter(x=>x&&x.id&&Array.isArray(x.ex)).map(x=>({id:String(x.id),name:String(x.name||x.id).slice(0,40),ex:x.ex.filter(t=>t&&t.id&&typeof t.name==='string').map(cleanT)}));
  if(!days.length)throw new Error('fmt');
  const ss=d.sessions.map(cleanSession).filter(Boolean);
  return{days,ss,bad:d.sessions.length-ss.length};
}
async function applyRestore(d){
  const c=cleanRestore(d);
  if(!await ask(T().confRestore(c.ss.length),{danger:1}))return false;
  /* نسخة من اللي على الموبايل قبل الاسترجاع، عشان «تراجع» */
  try{await idb.set('state.prerestore',{at:Date.now(),data:JSON.parse(JSON.stringify(S))})}catch(e){}
  S={v:1,gyms:Array.isArray(d.gyms)?d.gyms.filter(g=>g&&typeof g.id==='string'&&typeof g.name==='string').map(g=>({id:g.id.slice(0,40),name:g.name.slice(0,20),del:g.del?1:undefined})):[],photos:(S&&S.photos)||[],program:Object.assign({},d.program,{days:c.days}),sessions:c.ss,settings:Object.assign({cycle:1},d.settings&&typeof d.settings==='object'?d.settings:{},{lang:LANG}),draft:null,fbDay:d.fbDay&&Array.isArray(d.fbDay.ex)?{id:'FB',name:String(d.fbDay.name||'Full Body').slice(0,40),ex:d.fbDay.ex.filter(t=>t&&t.id&&typeof t.name==='string').map(cleanT)}:undefined,sys:d.sys||undefined,myProgs:Array.isArray(d.myProgs)?d.myProgs.filter(p=>p&&typeof p.id==='string'&&typeof p.name==='string').map(p=>({id:p.id.slice(0,40),name:p.name.slice(0,30)})):[],custom:Array.isArray(d.custom)?d.custom:[],libOv:(d.libOv&&typeof d.libOv==='object')?d.libOv:{},exNotes:(d.exNotes&&typeof d.exNotes==='object')?d.exNotes:{},exMemo:(d.exMemo&&typeof d.exMemo==='object')?Object.fromEntries(Object.entries(d.exMemo).filter(([k,v])=>typeof v==='string').map(([k,v])=>[k.slice(0,80),v.slice(0,1200)])):{},steps:(d.steps&&typeof d.steps==='object')?d.steps:{},body:Array.isArray(d.body)?d.body:[],mig:Math.max(+d.mig||0,HIST_MIG)};
  if(S.draft&&(!Array.isArray(S.draft.ex)))S.draft=null;
  save();queueBackup();toast(c.bad?T().restoredSkip(c.bad):T().restored);go('home');return true;
}
async function undoRestore(){
  let p=null;try{p=await idb.get('state.prerestore')}catch(e){}
  if(!p||!p.data||!await ask(T().confUndoRestore))return;
  S=p.data;try{await idb.set('state.prerestore',null)}catch(e){}
  save();queueBackup();toast(T().undoDone);go('home');
}
window.addEventListener('online',()=>{if(SYNC.dirty)runBackup()});
const cellMd=s=>String(s??'').replace(/\|/g,'/').replace(/\r?\n/g,' ');
const rowMd=a=>'| '+a.map(cellMd).join(' | ')+' |';
function backupMD(){
  const L=T(),o=[];
  const now=new Date().toLocaleString(loc(),{year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
  o.push(`# ${L.mdTitle}`,'',`${L.mdExported}: ${now} · ${L.mdSessions}: ${S.sessions.length} · v${VER}`,'');
  o.push(`## ${L.mdProgram}`,'');
  for(const d of S.program.days){
    o.push(`### ${d.name}`,'',rowMd(L.mdCols),rowMd(L.mdCols.map(()=>'---')));
    d.ex.forEach((t,i)=>{const l=baseH(t.id);o.push(rowMd([i+1,t.name,fw(l?l.w:t.w),`${t.sets}×${t.reps}${t.unit?' '+unitTxt(t.unit):''}`,t.core?L.yes:'',t.note]))});
    o.push('',`${L.coreLine}: ${coreNames(d).join(' + ')}`,'');
  }
  o.push(`## ${L.mdLog}`,'');
  for(const s of done()){
    o.push(`### ${s.date} — ${s.dayName} · Cycle ${s.cycle} · ${L.st[s.status]||''}`,'');
    {const m=sessMeta(s);if(s.cb)m.push(s.cb.dl?tr('أسبوع خفيف ','Light week ')+cbPct(s.cb):tr(`رجوع بعد ${s.cb.g} يوم `,`Comeback after ${s.cb.g} days `)+cbPct(s.cb));if(m.length)o.push(m.join(' · '),'')}
    o.push(rowMd(L.mdSCols),rowMd(L.mdSCols.map(()=>'---')));
    for(const e of s.ex){const f=exFlags(e,s);o.push(rowMd([e.name+(e.core?' ★':'')+(f.length?' ('+f.join(' · ')+')':''),fw(e.w),setsStr(e),e.dur&&e.dur.some(x=>x>0)?e.dur.map(x=>x>0?mmss(x):'—').join(' / '):'',e.rir!=null?(e.rir===3?'3+':String(e.rir)):'',e.clean?L.yes:tr('لأ','no'),e.note]))}
    o.push('');
  }
  const data=JSON.stringify({app:'gymlog',v:1,exported:new Date().toISOString(),data:snapData()}).replace(/-->/g,'--\\u003e');
  o.push('---','',`<!-- GYMLOG-DATA · ${L.mdData}`,data,'-->','');
  return o.join('\n');
}
function jsonAt(t,i){
  let dep=0,str=false,esc=false;
  for(let k=i;k<t.length;k++){const c=t[k];
    if(str){if(esc)esc=false;else if(c==='\\')esc=true;else if(c==='"')str=false;continue}
    if(c==='"')str=true;else if(c==='{')dep++;else if(c==='}'){dep--;if(!dep)return t.slice(i,k+1)}}
  return null;
}
function parseBackup(txt){
  let t=String(txt||'').replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
  if(!t.trim())throw new Error('empty');
  /* لو برنامج تاني حوّل الملف (CSV بيضاعف علامات التنصيص، أو HTML) نرجّعه */
  if(t.indexOf('""app"":""gymlog""')>=0)t=t.replace(/""/g,'"');
  if(t.indexOf('&quot;app&quot;')>=0)t=t.replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
  const m=t.match(/<!--\s*GYMLOG-DATA[^\n]*\n([\s\S]*?)\n?-->/);
  if(m){try{const o=JSON.parse(m[1]);return o.data||o}catch(e){}}
  const a=t.search(/\{\s*"app"\s*:\s*"gymlog"/);
  if(a>=0){const j=jsonAt(t,a);if(j){const o=JSON.parse(j);return o.data||o}}
  const o=JSON.parse(t);return o.data||o;
}
function download(name,text,type){if(window.Android){try{Android.saveFile(name,type||'text/plain',String(text));return}catch(e){}}const b=new Blob([text],{type});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1500)}
function markBackup(){S.settings.lastBackup=Date.now();save()}
async function backupNow(){
  if(FS){try{const h=await idb.get('fh');if(h&&await writeLinked(h,true)){toast(T().savedFile);refresh();return}}catch(e){}}
  const nm=`gym-backup-${today()}`,t=backupMD();
  // بيسألك تحفظ فين: نافذة اختيار المكان لو المتصفح بيدعمها، وإلا قايمة المشاركة (Drive / Files) اللي بتختار منها المكان
  if(window.Android){nativeSave(nm+'.md',t);return}
  if(FS){try{const h=await showSaveFilePicker({suggestedName:nm+'.md',types:[{description:'Gym log',accept:{'text/markdown':['.md']}}]});const w=await h.createWritable();await w.write(t);await w.close();markBackup();toast(T().savedFile);refresh();return}catch(e){if(e.name==='AbortError')return}}
  const t0=Date.now();
  try{const f=new File([t],nm+'.txt',{type:'text/plain'});if(navigator.canShare&&navigator.canShare({files:[f]})){await navigator.share({files:[f]});markBackup();toast(T().sent);refresh();return}}catch(e){if(e.name==='AbortError'&&Date.now()-t0>900)return}
  download(nm+'.md',t,'text/markdown');markBackup();toast(T().dlDone);refresh();
}
/* داخل الـ APK: نافذة «احفظ في» بتاعة أندرويد (تقدر تختار Drive أو أي فولدر) */
function nativeSave(name,t){window.__glBk=true;try{Android.saveFile(name,'text/markdown',t)}catch(e){window.__glBk=false;download(name,t,'text/markdown')}}
async function shareBackup(){
  const t=backupMD();let err='';
  if(window.Android){nativeSave(`gym-backup-${today()}.md`,t);return}
  // أندرويد مش بيسمح بمشاركة .md، فبنبعته .txt (نفس المحتوى بالظبط)
  try{const f=new File([t],`gym-backup-${today()}.txt`,{type:'text/plain'});
    if(navigator.canShare&&navigator.canShare({files:[f]})){await navigator.share({files:[f]});markBackup();toast(T().sent);refresh();return}
  }catch(e){if(e.name==='AbortError')return;err=e.name}
  if(navigator.share&&t.length<60000){try{await navigator.share({text:t});markBackup();toast(T().sentText);refresh();return}catch(e){if(e.name==='AbortError')return;err=err||e.name}}
  download(`gym-backup-${today()}.md`,t,'text/markdown');markBackup();refresh();toast(T().shareFail(err));
}
window.__glLinked=(ok,name)=>{if(ok){S.settings.linked=name||'gym-log.md';markBackup();toast(T().linked)}else toast(T().linkFail);refresh()};
async function linkFile(){
  if(NL){try{Android.linkFile('gym-log.md',backupMD())}catch(e){toast(T().linkFail)}return}
  try{const h=await showSaveFilePicker({suggestedName:'gym-log.md',types:[{description:'Gym log',accept:{'text/markdown':['.md']}}]});
    await idb.set('fh',h);S.settings.linked=h.name;await writeLinked(h,true);toast(T().linked);refresh()}
  catch(e){if(e.name!=='AbortError')toast(T().linkFail)}
}
async function writeLinked(h,ask){
  let p=await h.queryPermission({mode:'readwrite'});
  if(p!=='granted'&&ask)p=await h.requestPermission({mode:'readwrite'});
  if(p!=='granted')return false;
  const w=await h.createWritable();await w.write(backupMD());await w.close();markBackup();return true;
}
async function autoFile(){if(NL){try{if(Android.linkedName()&&Android.writeLinked(backupMD()))markBackup()}catch(e){}return}if(!FS)return;try{const h=await idb.get('fh');if(h)await writeLinked(h,true)}catch(e){}}
function exportCSV(){
  const q=v=>{const s=String(v??'');return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s};
  const rows=[T().csvH];
  for(const s of done().reverse())for(const e of s.ex)rows.push([s.date,s.cycle,s.dayName,e.name,e.w,e.sets.join('/'),e.sets.length,e.sets.reduce((a,b)=>a+b,0),e.clean?'1':'0',e.core?'1':'0',e.note,Array.isArray(e.ws)?e.ws.join('/'):'',Array.isArray(e.dur)?e.dur.join('/'):'',e.rir!=null?e.rir:'',e.ss?'1':'',e.from?'swap:'+e.from:e.add?'add':'',gymName(s.gym),s.rdy!=null?s.rdy:'',s.cb?(s.cb.dl?'light':'comeback')+' '+Math.round(s.cb.p*100)+'%':'',s.t0?hm(s.t0):'',s.ts&&!s.imp?hm(s.ts):'',s.t0&&s.ts?Math.round((s.ts-s.t0)/60000):'',e.unit||'']);
  download(`gym-log-${today()}.csv`,'﻿'+rows.map(r=>r.map(q).join(',')).join('\r\n'),'text/csv');toast(T().csvDone);
}
/* ملف Excel (CSV) اللي التطبيق بيصدّره: بنقراه بالترتيب مش بأسماء الأعمدة، فبيشتغل عربي وإنجليزي */
function parseCSV(txt){
  txt=String(txt).replace(/^\uFEFF/,'');
  const rows=[];let row=[],f='',q=false;
  for(let i=0;i<txt.length;i++){
    const c=txt[i];
    if(q){if(c==='"'){if(txt[i+1]==='"'){f+='"';i++}else q=false}else f+=c}
    else if(c==='"')q=true;
    else if(c===','){row.push(f);f=''}
    else if(c==='\n'||c==='\r'){if(c==='\r'&&txt[i+1]==='\n')i++;row.push(f);f='';if(row.some(x=>x!==''))rows.push(row);row=[]}
    else f+=c;
  }
  row.push(f);if(row.some(x=>x!==''))rows.push(row);
  return rows;
}
function csvToSessions(txt){
  const rows=parseCSV(txt).slice(1),map=new Map();
  for(const r of rows){
    if(r.length<9||!/^\d{4}-\d{2}-\d{2}$/.test(r[0]))continue;
    const key=r[0]+'|'+r[1]+'|'+r[2];
    let s=map.get(key);
    if(!s){s={id:uid(),date:r[0],cycle:+r[1]||1,dayName:r[2]||'?',status:'imp',ts:new Date(r[0]+'T12:00:00').getTime(),ex:[]};map.set(key,s)}
    const sets=String(r[5]).split('/').map(Number).filter(v=>!isNaN(v)&&String(v)!=='');
    const ex={name:r[3],exId:'h:'+r[3],w:+r[4]||0,sets,unit:UNITS.includes(r[22])?r[22]:'',clean:r[8]==='1',core:r[9]==='1',note:r[10]||''};
    if(r[11]){const a=String(r[11]).split('/').map(Number);if(a.length===sets.length&&a.every(isFinite))ex.ws=a}
    if(r[12]){const a=String(r[12]).split('/').map(Number);if(a.every(isFinite))ex.dur=a}
    if(r[13]!==''&&r[13]!=null&&isFinite(+r[13]))ex.rir=+r[13];if(r[14]==='1')ex.ss=1;
    if(/^swap:/.test(r[15]||''))ex.from=r[15].slice(5);else if(r[15]==='add')ex.add=1;
    if(r[17]!==''&&r[17]!=null&&isFinite(+r[17]))s.rdy=+r[17];
    s.ex.push(ex);
  }
  return[...map.values()].filter(s=>s.ex.length);
}
async function csvMerge(txt){
  const add=csvToSessions(txt);if(!add.length)return false;
  const have=new Set(S.sessions.map(x=>x.date+'|'+x.cycle+'|'+x.dayName));
  const fresh=add.filter(x=>!have.has(x.date+'|'+x.cycle+'|'+x.dayName));
  if(!fresh.length){toast(tr('كل الجلسات دي موجودة عندك أصلًا','All these sessions are already in your log'));return true}
  if(!await ask(tr(`ده ملف Excel (CSV) مش نسخة كاملة. هيتضاف ${fresh.length} جلسة لسجلك من غير ما يمسح حاجة، والبرنامج والإعدادات مش هيتغيروا. أكمّل؟`,`This is an Excel (CSV) file, not a full backup. ${fresh.length} session(s) will be added to your log; nothing is deleted and your program and settings stay as they are. Continue?`)))return true;
  S.sessions=S.sessions.concat(fresh).sort((a,b)=>(a.ts||0)-(b.ts||0));
  save();queueBackup();toast(tr(`اتضاف ${fresh.length} جلسة ✓`,`Added ${fresh.length} session(s) ✓`));go('home');return true;
}
async function importText(txt){
  if(txt==null){toast(tr('مقدرتش أقرا الملف','Could not read the file'));return}
  let d;
  try{d=parseBackup(txt);cleanRestore(d)}
  catch(e){
    let ok=false;try{ok=await csvMerge(txt)}catch(e2){}
    if(!ok)toast(String(txt).trim()?T().badFile:tr('الملف ده فاضي — احفظ نسخة جديدة','This file is empty — save a new backup'));
    return}
  await applyRestore(d);
}
window.__glOpen=t=>{importText(t)};
function importFile(file){
  const r=new FileReader();
  r.onload=()=>{if(window.Android&&!NL&&!String(r.result||'').trim()){toast(tr('نسخة الـ APK دي مش بتعرف تقرا الملفات — نزّل آخر نسخة من التطبيق','This APK version cannot read files — install the latest app'));return}importText(r.result)};r.onerror=()=>importText(null);
  r.readAsText(file);
}
function refresh(){if(tab==='data')renderData();if(tab==='home'){const o=[...document.querySelectorAll('#view details')].map(x=>x.open);renderHome();document.querySelectorAll('#view details').forEach((x,k)=>{if(o[k])x.open=true})}}
/* حالة «التخزين محمي» و«تراجع الاسترجاع»: بتتقرا في الخلفية والصفحة بتترسم فورًا بآخر قيمة معروفة */
const DM={p:null,u:false};
async function dataMeta(){let p=null,u=false;
  try{p=navigator.storage&&navigator.storage.persisted?await navigator.storage.persisted():null}catch(e){}
  try{const pre=await idb.get('state.prerestore');u=!!(pre&&pre.data&&Date.now()-pre.at<864e5)}catch(e){}
  if(p!==DM.p||u!==DM.u){DM.p=p;DM.u=u;if(tab==='data')renderData()}}
const BMX=[['arm','الدراع (سم)','Arm (cm)'],['chest','الصدر (سم)','Chest (cm)'],['thigh','الفخد (سم)','Thigh (cm)'],['neck','الرقبة (سم)','Neck (cm)'],['bf','نسبة الدهون %','Body fat %']];
function bodySec(){const a=(S.body||[]).slice().sort((x,y)=>x.d<y.d?-1:1),last=a.slice(-8).reverse();
  const spark=(k,c)=>{const v=a.slice(-12).filter(x=>x[k]>0);if(v.length<2)return '';const lo=Math.min(...v.map(x=>x[k])),hi=Math.max(...v.map(x=>x[k])),r=hi-lo||1;return `<polyline class="${c}" points="${v.map((x,i)=>(4+i*(292/(v.length-1))).toFixed(1)+','+(56-(x[k]-lo)/r*48).toFixed(1)).join(' ')}"/>`};
  const sp=spark('w','a')+spark('c','b');
  return `<details class="fsec" data-fk="body"${fOpen.has('body')?' open':''}><summary>${tr('الجسم والقياسات (أسبوعي)','Body & measurements (weekly)')}<span class="pchev">⌄</span></summary><div class="fbody">
    <div class="fgrid"><label class="fld">${tr('وزن الجسم (كجم)','Bodyweight (kg)')}<input class="inp" id="bW" inputmode="decimal"></label><label class="fld">${tr('الوسط (سم)','Waist (cm)')}<input class="inp" id="bC" inputmode="decimal"></label></div>
    <details class="bmx"><summary>${tr('قياسات تانية (اختياري)','More measurements (optional)')}</summary><div class="fgrid">${BMX.map(([k,a,e])=>`<label class="fld">${tr(a,e)}<input class="inp" id="b_${k}" inputmode="decimal"></label>`).join('')}</div></details>
    <button class="btn pri w" data-a="bodySave">${tr('سجّل النهارده','Log today')}</button>
    ${sp?`<svg class="bspark" viewBox="0 0 300 64" preserveAspectRatio="none" aria-hidden="true">${sp}</svg>`:''}
    ${last.length?`<table class="bdt">${last.map(x=>`<tr><td>${fmtD(x.d)}</td><td class="en">${x.w>0?x.w+' kg':'—'}</td><td class="en">${x.c>0?x.c+' cm':'—'}${BMX.some(([k])=>x[k]>0)?`<div class="mu bmr">${BMX.filter(([k])=>x[k]>0).map(([k,a,e])=>`${tr(a.split(' ')[0],e.split(' ')[0])} ${x[k]}`).join(' · ')}</div>`:''}</td><td><button data-a="bodyDel" data-d="${x.d}" aria-label="${T().del}">×</button></td></tr>`).join('')}</table>`:`<div class="mu mt">${tr('سجّل مرة في الأسبوع، نفس اليوم ونفس الوقت (الصبح قبل الأكل).','Log once a week, same day and time (morning, before eating).')}</div>`}
  </div></details>`}
function renderData(){
  const L=T(),lb=S.settings.lastBackup,n=S.sessions.length;
  const persisted=DM.p,canUndo=DM.u;
  dataMeta();
  $('#view').innerHTML=`<button class="gdbtn" data-a="appGuide"><i>?</i><span class="sp">${tr('دليل التطبيق','App guide')}<small>${tr('كل حاجة في التطبيق وإزاي تستخدمها · عربي/English','Everything in the app and how to use it · Arabic/English')}</small></span><span class="pchev">‹</span></button><div class="fhead"><div class="mu">${L.onPhone}</div><div class="fbig">${n} <span class="mu">${L.sessions}</span></div>
    <div class="mu">${L.lastBk}: ${lb?new Date(lb).toLocaleString(loc(),{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}):L.never}</div>
    ${persisted===true?`<div class="mu">✓ ${L.persisted}</div>`:''}</div>
  <div class="thseg" role="group" aria-label="${L.themeT}"><button class="${(S.settings.theme||'iron')==='iron'?'on':''}" data-a="theme" data-k="iron">${THEMES.iron[LANG]}</button><button class="${S.settings.theme==='morning'?'on':''}" data-a="theme" data-k="morning">${THEMES.morning[LANG]}</button></div>
  <div class="qrow"><div class="mu">${tr('حجم الخط','Text size')}</div><div class="thseg">${[1,2,3].map(k=>`<button class="${(+S.settings.fs||1)===k?'on':''}" data-a="fs" data-k="${k}" style="font-size:${[14,16,18][k-1]}px">${[tr('عادي','Normal'),tr('أكبر','Larger'),tr('كبير','Large')][k-1]}</button>`).join('')}</div></div>
  ${swRow('safe',S.settings.safe,tr('ملف أمان','Safety profile'),tr('الأجهزة والكابل الأول في الاقتراحات والتبديل','Machines and cables first in suggestions and swaps'))}
  ${swRow('ram',S.settings.ram,tr('وضع رمضان','Ramadan mode'),tr('مجموعة أقل وراحة أطول. اتمرن بعد الفطار بساعة ونص لساعتين','One set less, longer rests. Train 1.5–2 h after iftar'))}
  ${swRow('qGest',qGestOn(),tr('بيت الشعر','Home verse'),tr('دوسة = نسخ · سحب = تنقل','Tap = copy · swipe = browse'))}
  ${bodySec()}
  ${photoSec()}
  <details class="fsec" data-fk="prot"${fOpen.has('prot')?' open':''}><summary>${tr('حماية بياناتك','Protect your data')}<span class="fst">${lb?'✓ '+tr('آخر نسخة','Last backup')+': '+new Date(lb).toLocaleDateString(loc(),{day:'numeric',month:'short'}):tr('لسه مفيش نسخة','No backup yet')}</span><span class="pchev">⌄</span></summary><div class="fbody"><div class="mu" style="margin-bottom:10px">${L.bkHint}</div>
    <button class="btn pri w" data-a="backup">${L.bkSave}</button>
    <button class="btn w mt" data-a="share">${L.bkShare}</button>
    <label class="btn w mt" style="cursor:pointer">${L.restore}<input type="file" id="imp" accept=".md,.txt,.json,.csv,text/markdown,text/plain,text/csv,application/json" hidden></label>
    ${canUndo?`<button class="btn w mt dan" data-a="undoRestore">${L.undoRestore}</button>`:''}
  <details class="fsub"><summary>${tr('متقدم','Advanced')}</summary>
  <details class="fsec" data-fk="sync"${fOpen.has('sync')?' open':''}><summary>${L.syncT}${SYNC.on?`<span class="pdot${SYNC.err?' er':''}" style="margin-inline-start:6px"></span>`:''}<span class="pchev">⌄</span></summary><div class="fbody">
    ${SYNC.on?`<div class="note-ok" style="margin:0 0 10px">${L.syncOnL} · ${L.syncLast}: ${SYNC.last?new Date(SYNC.last).toLocaleString(loc(),{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}):L.syncNever}${SYNC.dirty?' · '+L.syncWait(Math.max(1,SYNC.missed)):''}</div>${SYNC.err?`<div class="warn" style="margin:0 0 10px">${L.syncErr(esc(syncMsg(SYNC.err)))}</div>`:''}${syncPublic()?`<div class="warn" style="margin:0 0 10px">${L.syncPub}</div>`:''}
      <button class="btn pri w" data-a="syncNow">${L.syncNow}</button><button class="btn dan w mt" data-a="syncOff">${L.syncOffB}</button>`
    :`<div class="mu" style="margin-bottom:10px">${L.syncHint}</div>
      <label class="fld">${L.syncRepo}<input class="inp en" id="gRepo" placeholder="owner/gym-data" value="${esc(SYNC.repo)}" autocapitalize="off" autocomplete="off" style="text-align:left"></label>
      <label class="fld">${L.syncTok}<input class="inp en" id="gTok" type="password" autocomplete="off" style="text-align:left"></label>
      <label class="fld">${L.syncP1}<input class="inp" id="gP1" type="password" autocomplete="new-password"></label>
      <label class="fld">${L.syncP2}<input class="inp" id="gP2" type="password" autocomplete="new-password"></label>
      <div class="warn" style="margin:0 0 10px">${L.syncWarn}</div>
      <button class="btn pri w" data-a="syncOn">${L.syncEnable}</button>
      <button class="btn w mt" data-a="syncRestore">${L.syncRestore}</button><div class="mu mt">${L.syncRestoreHint}</div>`}</div></details>
  ${FS||NL?`<details class="fsec" data-fk="auto"${fOpen.has('auto')?' open':''}><summary>${L.autoT}<span class="pchev">⌄</span></summary><div class="fbody"><div class="mu" style="margin-bottom:10px">${S.settings.linked?L.autoLinked('<span class="en">'+esc(S.settings.linked)+'</span>'):L.autoHint}</div><button class="btn w" data-a="link">${S.settings.linked?L.relinkB:L.linkB}</button></div></details>`:''}
  <details class="fsec" data-fk="csv"${fOpen.has('csv')?' open':''}><summary>${L.csvT}<span class="pchev">⌄</span></summary><div class="fbody"><div class="mu" style="margin-bottom:10px">${L.csvHint}</div><button class="btn w" data-a="csv">${L.csvB}</button></div></details>
  <div class="fbody" style="padding-top:16px"><label class="fld" style="margin:0">${L.cycleL}<input class="inp" id="cyc0" inputmode="numeric" value="${esc(S.settings.cycle)}"></label></div>
  </details></div></details>
  <details class="fsec" data-fk="lang"${fOpen.has('lang')?' open':''}><summary>Language · اللغة<span class="pchev">⌄</span></summary><div class="fbody"><button class="btn w" data-a="lang">${L.langBtn}</button><div class="mu" style="margin:16px 0 8px">${tr("لغة الشروحات (شرح التمارين، «ليه؟»، دليل التطبيق)","Explanations language (exercise guides, «Why?», app guide)")}</div><div class="thseg" style="margin:0"><button class="${howLang()==='ar'?'on':''}" data-a="howLang" data-k="ar">عربي</button><button class="${howLang()==='en'?'on':''}" data-a="howLang" data-k="en">English</button></div></div></details>

  <div class="mu" style="text-align:center;margin:18px 0 0">${L.ver}: v${VER}</div>`;
  {const pi=$('#phIn');if(pi)pi.onchange=e=>{const f=e.target.files[0];if(f)phAdd(f);e.target.value=''}}phLoad();
  $('#imp').onchange=e=>{const f=e.target.files[0];if(f)importFile(f);e.target.value=''};
  $('#cyc0').onchange=e=>{const v=num(e.target.value);if(v>0){S.settings.cycle=v;save();toast(L.cycleSaved)}};
}


/* سحب لإعادة ترتيب التمارين في وضع التعديل */
(function(){
  let row=null;
  document.addEventListener('pointerdown',e=>{const g=e.target.closest('[data-grip]');if(!g)return;row=g.closest('.pr2');row.classList.add('drag');try{g.setPointerCapture(e.pointerId)}catch(_){}e.preventDefault()});
  document.addEventListener('pointermove',e=>{if(!row)return;const list=row.parentNode;const rs=[...list.children].filter(x=>x!==row);
    let before=null;for(const r of rs){const b=r.getBoundingClientRect();if(e.clientY<b.top+b.height/2){before=r;break}}
    if(before!==row.nextSibling)list.insertBefore(row,before)});
  const end=()=>{if(!row)return;const list=row.parentNode;row.classList.remove('drag');
    const order=[...list.children].map(x=>+x.dataset.i);const ex=day(pDay).ex;
    if(order.some((v,k)=>v!==k)){const ne=order.map(k=>ex[k]);ex.splice(0,ex.length,...ne);save();queueBackup()}
    row=null;renderProgram()};
  document.addEventListener('pointerup',end);document.addEventListener('pointercancel',end);
})();

/* ================= الأحداث ================= */
document.addEventListener('input',ev=>{if(ev.target.id==='libS'){libQ=ev.target.value;const r=$('#libR');if(r)r.innerHTML=libRowsHtml()}else if(ev.target.id==='lbS'){lbQ=ev.target.value;const l=$('#lbL');if(l)l.innerHTML=libRows()}});
document.addEventListener('toggle',e=>{const d=e.target;if(d.classList&&d.classList.contains('lgrp')&&d.dataset.g){d.open?lbOpenG.add(d.dataset.g):lbOpenG.delete(d.dataset.g)}if(d.classList&&d.classList.contains('lbn')&&d.open)lbFill(d);if(d.classList&&d.classList.contains('dtl')&&d.open)setTimeout(()=>d.scrollIntoView({behavior:'smooth',block:'start'}),30)},true);
const TABS=['home','hist','prog','lib','data'];
let px=0,py=0,pt=0,pok=false,pmode=0,pdx=0;
const swOK=e=>$('#sess').hidden&&$('#modal').hidden&&e.touches.length===1&&!(qGestOn()&&e.target.closest('.qt'))&&!e.target.closest('input,select,textarea,.chips,.ptabs,table,[data-grip],.pr2.drag');
document.addEventListener('touchstart',e=>{const t=e.touches[0];px=t.clientX;py=t.clientY;pt=Date.now();pmode=0;pdx=0;pok=swOK(e)},{passive:true});
document.addEventListener('touchmove',e=>{if(!pok)return;const t=e.touches[0],dx=t.clientX-px,dy=t.clientY-py;
  if(!pmode){if(Math.abs(dx)>10&&Math.abs(dx)>Math.abs(dy)*1.3)pmode=1;else if(Math.abs(dy)>10)pmode=2;else return}
  if(pmode!==1)return;pdx=dx;
  const i=TABS.indexOf(tab),nx=i+((LANG==='ar'?dx>0:dx<0)?1:-1),edge=nx<0||nx>=TABS.length,v=$('#view'),W=innerWidth;
  const m=edge?dx*.22:dx*.85;v.style.transition='none';v.style.transform=`translateX(${m}px)`;v.style.opacity=String(1-Math.min(.55,Math.abs(m)/W*.9))},{passive:true});
document.addEventListener('touchend',e=>{if(!pok||pmode!==1){pok=false;return}pok=false;
  const v=$('#view'),W=innerWidth,dx=pdx,vel=Math.abs(dx)/Math.max(1,Date.now()-pt);
  const dir=(LANG==='ar'?dx>0:dx<0)?1:-1,nx=TABS.indexOf(tab)+dir,go2=Math.abs(dx)>W*.22||(vel>.45&&Math.abs(dx)>28);
  const back=()=>{v.style.transition='transform .2s ease-out,opacity .2s';v.style.transform='';v.style.opacity='';setTimeout(()=>{v.style.transition=''},220)};
  if(!go2||nx<0||nx>=TABS.length){back();return}
  /* v67: الصفحة الجديدة بتتبدّل فورًا لحظة رفع الصباع (من غير انتظار «اختفاء») وتنزلق مكانها في 160ms */
  const sgn=dx<0?-1:1;v.style.transition='none';navTab(TABS[nx]);
  v.style.transform=`translateX(${-sgn*W*.16}px)`;v.style.opacity='.4';void v.offsetWidth;
  v.style.transition='transform .16s cubic-bezier(.2,.8,.2,1),opacity .14s';v.style.transform='';v.style.opacity='';setTimeout(()=>{v.style.transition=''},190)},{passive:true});
document.addEventListener('touchcancel',()=>{if(pmode===1){const v=$('#view');v.style.transform='';v.style.opacity='';}pok=false},{passive:true});
document.addEventListener('click',ev=>{
  if(ev.target.closest('.brand .lg')){newQuote();return}
  if(ev.target.closest('.brand .wmk')){openCredits();return}
  {const qe=ev.target.closest('.qt');if(qe&&tab==='home'&&qGestOn()){if(Date.now()-qSw>450)copyQuote(qe);return}}
  const tb=ev.target.closest('.tabs button');if(tb){navTab(tb.dataset.tab);return}
  if(ev.target.id==='modal'){closeModal();return}
  const b=ev.target.closest('[data-a]');if(!b)return;
  const a=b.dataset.a,i=+b.dataset.i,d=S.draft,L=T();
  switch(a){
    case 'lang':$('#toast').classList.remove('on');LANG=LANG==='en'?'ar':'en';S.settings.lang=LANG;save();applyLang();if(!$('#sess').hidden)renderSession();if(!$('#modal').hidden)closeModal();go(tab);break;
    case 'start':if(b.classList.contains('orb'))orbGo(b,()=>startSession(b.dataset.d));else startSession(b.dataset.d);break;
    case 'resume':if(b.classList.contains('orb'))orbGo(b,openSession);else openSession();break;
    case 'closeS':{const kept=S.draft&&S.draft.ex.some(x=>x.sets.some(v=>num(v)>0));flushSave();closeSession();if(S.draft)queueDraftBackup();if(kept)toast(tr('الجلسة متحفظة. كمّلها من الدايرة في الرئيسية','Session kept. Continue it from the circle on Home'));break}
    case 'shareDraft':shareDraft();break;
    case 'discard':ask(d.editing?L.confCancelEdit:L.confDiscard,{danger:1}).then(ok=>{if(ok){const _u=undoSnap();S.draft=null;openTips.clear();save();closeSession();offerUndo(tr('الجلسة اتلغت','Session discarded'),_u)}});break;
    case 'addset':d.ex[i].sets.push('');save();renderSession();break;
    case 'exGo':goEx(i);break;
    case 'setTap':{const j=+b.dataset.j,e=d.ex[curEx];if(num(e.sets[j])>0){openPick('s',j);break}
      e.sets[j]=String(e.treps);POP=j;setTimeout(()=>{POP=-1},400);try{navigator.vibrate&&navigator.vibrate(18)}catch(_){};saveSoon();if(!S.settings.hint1){S.settings.hint1=1;save();setTimeout(()=>toast(tr('دوس على الدايرة تاني لو عايز تغيّر العدّات أو وزن المجموعة دي','Tap the circle again to change the reps or this set\'s weight')),400)}
      /* سوبرسيت: من A لـ B من غير راحة، ومن B راحة وترجع لـ A */
      if(e.ss&&curEx<d.ex.length-1){goEx(curEx+1);break}
      if(curEx>0&&d.ex[curEx-1].ss){const a=d.ex[curEx-1];restStart(e);if(a.sets.some(v=>!(num(v)>0)))goEx(curEx-1);else renderSession();break}
      renderSession();restStart(e);break}
    case 'pickW':openPick('w');break;
    case 'pickOk':{const l=$('#pkl');if(!l||!pk)break;const v=pk.vals[Math.max(0,Math.min(pk.vals.length-1,Math.round(l.scrollTop/44)))],e=d.ex[curEx];
      if(pk.kind==='w'){const old=num(e.w),ps=d.cb?null:progState({sets:e.tsets,goal:e.goal},exHist(e.exId,d.editing));
        if(ps&&ps.k==='up'&&!e.unit&&v>(isNaN(old)?0:old)&&+e.goal>8){e.goal=8;e.treps=8;toast(tr('وزن جديد: الهدف النهارده 8 عدّات','New weight: today\'s target is 8 reps'))}
        e.w=String(v)}else{e.sets[pk.j]=String(v);if(!e.unit&&pk.wv!=null){e.ws=(e.ws||[]).slice();while(e.ws.length<e.sets.length)e.ws.push('');e.ws[pk.j]=pk.wv!==num(e.w)?String(pk.wv):''}}saveSoon();closeSheet();renderSession();break}
    case 'pwm':case 'pwp':{if(!pk||pk.wv==null)break;const e=d.ex[curEx],st=stepOf(e.name);pk.wv=Math.max(0,Math.round((pk.wv+(b.dataset.a==='pwp'?st:-st))*100)/100);$('#pwv').textContent=pk.wv;break}
    case 'stepSet':{const e=d.ex[curEx];S.steps=S.steps||{};S.steps[nk(e.name)]=+b.dataset.v;save();b.parentElement.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));renderSession();break}
    case 'rsAdd':if(d&&d.rest){d.rest.dur+=30;d.rest.done=0;saveSoon();restTick()}break;
    case 'rsSkip':if(d){d.rest=null;saveSoon();restTick()}break;
    case 'rir':{const e=d.ex[curEx],v=+b.dataset.v;e.rir=e.rir===v?null:v;saveSoon();renderSession();break}
    case 'tShort':{for(const e of d.ex){if(+e.tsets>2){e.tsets=2;e.sets=e.sets.slice(0,Math.max(2,e.sets.filter(v=>num(v)>0).length));if(e.dur)e.dur=e.dur.slice(0,e.sets.length)}}d.ex.sort((a,b)=>(b.core?1:0)-(a.core?1:0));curEx=Math.min(curEx,d.ex.length-1);save();closeSheet();renderSession();toast(tr('كل تمرين بقى مجموعتين، والأساسي الأول ✓','2 sets each, essentials first ✓'));break}
    case 'pain':{closeSheet();const e=d.ex[curEx];(async()=>{const go=await ask(tr('لو الوجع حاد أو في المفصل: وقّف التمرين ده النهارده. لو خفيف: نزّل الوزن 20% وكمّل بأداء أبطأ. تبدّله بتمرين تاني لنفس العضلة؟','If the pain is sharp or in the joint, stop this exercise today. If it is mild, drop the weight 20% and go slower. Swap it for another exercise for the same muscle?'),{yes:tr('بدّله','Swap it'),no:tr('نزّل الوزن 20%','Drop 20%')});
      e.note=((e.note||'')+' ⚠ '+tr('وجع','pain')).trim();
      if(go){const L0=libGet(e.name);libQ='';libG=L0?L0[1]:'all';libFor='swap';libModal()}else{const w=num(e.w);if(!e.unit&&w>0){const st=stepOf(e.name);e.w=String(Math.max(st,Math.round(w*.8/st)*st))}}
      save();renderSession()})();break}
    case 'protAdd':{const v=+b.dataset.v;const old=JSON.stringify({prot:S.prot||null});S.prot={d:today(),g:Math.max(0,protToday()+v)};save();queueBackup();const pe=document.querySelector('.prt');if(pe)pe.outerHTML=protHtml();offerUndo(`${v>0?'+':''}${v} ${tr('جم بروتين','g protein')} ✓`,old);break}
    case 'protG':{const cur=+S.settings.protG||150,nx=cur>=200?100:cur+10;S.settings.protG=nx;save();const pe=document.querySelector('.prt');if(pe)pe.outerHTML=protHtml();toast(tr(`هدف البروتين ${nx} جم (دوس تاني للتغيير)`,`Protein goal ${nx} g (tap again to change)`));break}
    case 'rdy':{const v=+b.dataset.v;d.rdy=v;save();renderSession();if(v===0)toast(tr('يوم تقيل: خليك على الأساسي، أو «معايا وقت قليل» من ⋯. الالتزام أهم من الرقم النهارده.','Rough day: stick to the essentials or use «short on time» from ⋯. Showing up beats the number today.'));break}
    case 'onbSys':{const id=b.dataset.id;if(id!==(S.sys&&S.sys.cur||'ul4'))switchSys(id);save();onbModal(2);break}
    case 'onbSkip':case 'onbDone':delete S.onb;S.settings.legend=1;save();closeModal();go('home');setTimeout(()=>guideModal(null,1),500);break;
    case 'appGuide':guideModal();break;
    case 'guideL':guideModal(b.dataset.l,!!b.dataset.o);break;
    case 'guideFull':guideModal(b.dataset.l);break;
    case 'rule':xModal('rule');break;
    case 'xLang':xModal(b.dataset.x,b.dataset.l);break;
    case 'progShare':progShareModal();break;
    case 'progCopy':copy(progCode());break;
    case 'progImp':{let days;try{days=progFromCode($('#pgIn').value)}catch(e){toast(tr('الكود ده مش سليم','That code is not valid'));break}
      ask(tr(`البرنامج فيه ${days.length} أيام. يحل محل برنامجك الحالي؟ (سجلك مش هيتأثر، وتقدر تتراجع)`,`This program has ${days.length} days. Replace your current program? (Your log is untouched, and you can undo)`)).then(ok=>{if(!ok)return;const _u=undoSnap();sysInit();S.sys.saved[S.sys.cur]={days:S.program.days};S.program.days=days;pDay=days[0].id;save();queueBackup();closeModal();go('prog');offerUndo(tr('البرنامج اتغيّر','Program replaced'),_u)});break}
    case 'ram':S.settings.ram=b.dataset.k==='on'?1:0;save();renderData();break;
    case 'ssTgl':{const e=d.ex[curEx];e.ss=!e.ss;const pd=S.program.days.find(x=>x.id===d.day),t=pd&&pd.ex.find(x=>x.id===e.exId);if(t)t.ss=e.ss;save();closeSheet();renderSession();toast(e.ss?tr('اتربط: بعد كل مجموعة هتروح للتمرين اللي بعده، والراحة بعد الاتنين','Linked: after each set you go to the next exercise; rest comes after both'):tr('السوبرسيت اتفك','Superset removed'));break}
    case 'phOpen':phOpen(b.dataset.id);break;
    case 'phCmp':phOpen(b.dataset.id,true);break;
    case 'phDel':ask(tr('تمسح الصورة دي نهائيًا؟','Delete this photo permanently?'),{danger:1}).then(async ok=>{if(!ok)return;const id=b.dataset.id;S.photos=(S.photos||[]).filter(x=>x.id!==id);try{await idb.set('ph:'+id,null)}catch(e){}save();closeModal();renderData()});break;
    case 'rep':reportModal(+b.dataset.d);break;
    case 'repCopy':copy(reportText(+b.dataset.d));break;
    case 'repShare':shareText(reportText(+b.dataset.d));break;
    case 'gymSet':{S.settings.gym=b.dataset.id==='main'?'':b.dataset.id;save();renderHome();const det=document.querySelector('.dtl');if(det)det.open=true;toast(tr('الأوزان هتتاخد من آخر مرة في الجيم ده','Weights now come from your last time at this gym'));break}
    case 'gymAdd':{const live=(S.gyms||[]).filter(g=>!g.del);modal(`<h3>${tr('الجيمات','Gyms')}</h3><div class="mu" style="margin-bottom:10px;line-height:1.8">${tr('لو بتتمرن في أكتر من مكان (جيم تاني، فندق في سفر، البيت)، الأجهزة بتختلف: الـ 50 في جهاز هنا مش زي الـ 50 هناك. سجّل كل مكان هنا، واختاره من «التفاصيل» قبل ما تبدأ، والتطبيق هيقترح الأوزان من آخر مرة لعبت في نفس المكان، ومش هيخلط أرقام جيم بجيم.','If you train in more than one place (another gym, a hotel, home), machines differ: 50 on one machine is not 50 on another. Add each place here and pick it in “Details” before you start; the app suggests weights from your last session in that same place and never mixes them.')}</div>
      ${live.length?`<div class="gyl">${live.map(g=>`<div class="gyi"><span class="sp">${esc(g.name)}</span><button class="btn sm ghost" data-a="gymDel" data-id="${esc(g.id)}">${tr('امسح','Delete')}</button></div>`).join('')}</div>`:''}
      <label class="fld">${tr('مكان جديد','New place')}<input class="inp" id="gymN" maxlength="20" placeholder="${tr('مثلاً: جيم الشغل','e.g. Work gym')}"></label><div class="row"><button class="btn pri sp" data-a="gymSave">${tr('ضيف','Add')}</button><button class="btn ghost" data-a="closeM">${T().cancel}</button></div>`);break}
    case 'memo':memoModal(b.dataset.n);break;
    case 'memoSave':{const n=b.dataset.n,t=($('#memoT').value||'').trim();S.exMemo=S.exMemo||{};if(t)S.exMemo[nk(n)]=t;else delete S.exMemo[nk(n)];save();queueBackup();memoDone();toast(tr('اتحفظت ✓','Saved ✓'));break}
    case 'memoDel':{S.exMemo&&delete S.exMemo[nk(b.dataset.n)];save();queueBackup();memoDone();break}
    case 'gymDel':(async()=>{const g=(S.gyms||[]).find(x=>x.id===b.dataset.id);if(!g)return;if(!await ask(tr(`تمسح «${g.name}»؟ جلساتك القديمة فيه هتفضل زي ما هي.`,`Delete “${g.name}”? Your past sessions there stay as they are.`),{danger:1,yes:tr('امسح','Delete')}))return;g.del=1;if(S.settings.gym===g.id)S.settings.gym='';save();queueBackup();closeModal();renderHome();})();break;
    case 'gymSave':{const n=($('#gymN').value||'').trim();if(!n){toast(T().nameReq);break}S.gyms=S.gyms||[];const g={id:'g'+uid(),name:n};S.gyms.push(g);S.settings.gym=g.id;save();closeModal();renderHome();break}
    case 'safe':S.settings.safe=b.dataset.k==='on'?1:0;save();renderData();break;
    case 'wStep':{const e=d.ex[curEx],st=stepOf(e.name),w=num(e.w)||0;e.w=String(Math.max(0,Math.round((w+(+b.dataset.v)*st)*100)/100));saveSoon();renderSession();break}
    case 'rdyGo':{d.rdy=+b.dataset.v;d.rdyAsk=1;save();closeSheet();if(d.rdy===0){ask(tr('يوم تقيل. تخلّي النهارده الأساسي بس؟ الالتزام أهم من الرقم.','Rough day. Keep today to the essentials? Showing up beats the number.'),{yes:tr('الأساسي بس','Essentials only'),no:tr('كمّل عادي','Keep going')}).then(ok=>{if(ok){const keep=d.ex.filter(x=>x.core);if(keep.length){d.ex=keep;curEx=0;save();renderSession()}}})}else toast(tr('اتسجّل ✓','Noted ✓'));break}
    case 'rdySkip':d.rdyAsk=1;save();closeSheet();break;
    case 'timeShort':{const sh=$('#sheet');sh.innerHTML=`<div class="sbk" data-a="closeSheet"></div><div class="sbx"><div class="mgh">${tr('وقتك ضيق النهارده','Short on time today')}</div>${d.ex.some(x=>x.core)&&!d.ex.every(x=>x.core)?`<button class="mrow" data-a="coreOnly">${tr('الأساسي بس','Essentials only')}<small>${tr('التمارين الأساسية بكل مجموعاتها','Essential exercises, all sets')}</small></button>`:''}<button class="mrow" data-a="tShort">${tr('مجموعتين لكل تمرين','Two sets each')}<small>${tr('كل التمارين، والأساسي الأول','Every exercise, essentials first')}</small></button></div>`;break}
    case 'swTgl':S.settings.swOn=S.settings.swOn?0:1;save();closeSheet();renderSession();toast(S.settings.swOn?tr('ساعة الإيقاف ظاهرة لكل التمارين','Stopwatch shown for every exercise'):tr('ساعة الإيقاف للتمارين اللي بالوقت بس','Stopwatch only for timed exercises'));break;
    case 'dateEd':{const x=$('#mdt');if(x)x.hidden=!x.hidden;break}
    case 'tools':toolsModal();break;
    case 'cbWhy':xModal('cb');break;
    case 'dlWhy':xModal('dl');break;
    case 'shareS':{const x=S.sessions.find(q=>q.id===b.dataset.id);if(x)shareModal(x);break}
    case 'clean':{const e=d.ex[curEx];e.clean=!e.clean;saveSoon();renderSession();break}
    case 'coreOnly':{const keep=d.ex.filter(x=>x.core);if(keep.length&&!d.editing){d.ex=keep;curEx=0;save();closeSheet();renderSession();toast(tr('اليوم بقى الأساسي بس ✓','Essentials only ✓'))}break}
    case 'bodySave':{const w=num($('#bW').value),c=num($('#bC').value),mx={};for(const [k] of BMX){const v=num(($('#b_'+k)||{}).value);if(v>0&&v<400)mx[k]=v}if(!(w>0)&&!(c>0)&&!Object.keys(mx).length){toast(tr('اكتب الوزن أو الوسط','Enter weight or waist'));break}
      S.body=S.body||[];const t=today();let r=S.body.find(x=>x.d===t);if(!r){r={d:t};S.body.push(r)}if(w>0)r.w=w;if(c>0)r.c=c;Object.assign(r,mx);fOpen.add('body');save();queueBackup();renderData();toast(tr('اتسجّل ✓','Logged ✓'));break}
    case 'bodyDel':S.body=(S.body||[]).filter(x=>x.d!==b.dataset.d);save();renderData();break
    case 'pickClr':{if(pk){const e=d.ex[curEx];e.sets[pk.j]='';if(e.dur&&e.dur[pk.j])e.dur[pk.j]=0;saveSoon();closeSheet();renderSession()}break}
    case 'pickRm':{if(pk&&d.ex[curEx].sets.length>1){d.ex[curEx].sets.splice(pk.j,1);if(d.ex[curEx].dur)d.ex[curEx].dur.splice(pk.j,1);saveSoon();closeSheet();renderSession()}break}
    case 'closeSheet':closeSheet();break;
    case 'menu':openMenu();break;
    case 'sw':swTap();break;
    case 'finish':finishSession();break;
    case 'copyDone':if(lastDone)copy(cardText(lastDone));break;
    case 'shareDone':if(lastDone)shareModal(lastDone);break;
    case 'imgDone':if(lastDone)shareImg(lastDone);break;
    case 'imgS':{const x=S.sessions.find(q=>q.id===b.dataset.id);if(x)shareImg(x);break}
    case 'doneClose':closeSession();go('home');break;
    case 'tgl':{const k=b.dataset.k;openTips.has(k)?openTips.delete(k):openTips.add(k);renderSession();break}
    case 'hist':closeSheet();exHistModal(b.dataset.id);break;
    case 'guide':openGuide();break;
    case 'sess':sessModal(b.dataset.id);break;
    case 'copyS':copy(cardText(S.sessions.find(x=>x.id===b.dataset.id)));break;
    case 'aiS':{const s=S.sessions.find(x=>x.id===b.dataset.id);if(s)shareText(aiText(s,s.id));break}
    case 'editS':editSession(b.dataset.id);break;
    case 'undoRestore':undoRestore();break;
    case 'delS':ask(L.confDel,{danger:1}).then(ok=>{if(ok){const _u=undoSnap();S.sessions=S.sessions.filter(x=>x.id!==b.dataset.id);if(S.draft&&S.draft.editing===b.dataset.id)S.draft=null;save();queueBackup();closeModal();go(tab);offerUndo(tr('الجلسة اتمسحت','Session deleted'),_u)}});break;
    case 'closeM':closeModal();break;
    case 'pday':pDay=b.dataset.d;renderProgram();break;
    case 'fbReset':ask(tr('ترجّع الفول بادي للاختيار التلقائي من برنامجك؟','Reset the full body to the automatic pick from your program?')).then(ok=>{if(ok){S.fbDay=null;fbDay();save();queueBackup();renderProgram();toast(tr('اترجع ✓','Reset ✓'))}});break;
    case 'exInfo':infoModal(i);break;
    case 'sysOpen':sysModal();break;
    case 'pedit':pEdit=!pEdit;renderProgram();break;
    case 'sysPick':ask(tr('هتبدّل النظام. تمارينك الحالية محفوظة وترجعلها. تكمّل؟','Switch system? Your current exercises are kept. Continue?')).then(ok=>{if(ok){switchSys(b.dataset.id);closeModal();renderProgram();toast(tr('النظام اتغيّر ✓','System changed ✓'))}});break;
    case 'libOpen':libQ='';libG='all';libFor='prog';libModal();break;
    case 'sxOpen':closeSheet();libQ='';libG='all';libFor='sess';libModal();break;
    case 'swOpen':{closeSheet();const cur=S.draft&&S.draft.ex[curEx],L0=cur&&libGet(cur.name);libQ='';libG=L0?L0[1]:'all';libFor='swap';libModal();break}
    case 'sxSwap':{const d=S.draft;if(!d)break;const n=b.dataset.n,old=d.ex[curEx];if(!old||nk(old.name)===nk(n)){closeModal();break}
      const e=draftEx(mk(n));e.core=old.core;e.from=old.from||old.name;if(d.cb)cbApply(e,d.cb);d.ex[curEx]=e;save();closeModal();renderSession();toast(tr('اتبدّل للجلسة دي ✓','Swapped for this session ✓'));break}
    case 'rtOpen':closeSheet();rtModal();break;
    case 'rtGo':{const w=Math.max(5,+num($('#rtW').value)||180),r=Math.max(0,+num($('#rtR').value)||0),n=Math.max(1,Math.min(50,+num($('#rtN').value)||5));S.settings.rt={w,r,n};save();if(RT)clearInterval(RT.iv);RT={t0:Date.now(),w,r,n,ph:''};wakeOn();beep(1);RT.iv=setInterval(rtTick,250);rtTick();break}
    case 'rtStop':rtEnd(false);closeModal();break;
    case 'sxProg':S.settings.sxProg=b.dataset.v==='1'?1:0;save();libModal();break;
    case 'sxAdd':{const d=S.draft;if(!d)break;const n=b.dataset.n;let k=d.ex.findIndex(e=>nk(e.name)===nk(n));
      if(k<0){const pd=S.program.days.find(x=>x.id===d.day);let t=null;
        if(pd&&S.settings.sxProg){t=pd.ex.find(x=>nk(x.name)===nk(n));if(!t){t=mk(n);pd.ex.push(t)}}
        const e=draftEx(t||mk(n));e.add=1;if(d.cb)cbApply(e,d.cb);d.ex.push(e);k=d.ex.length-1;save();queueBackup();
        toast(pd&&S.settings.sxProg?tr('اتضاف للجلسة وللبرنامج ✓','Added to the session and the program ✓'):tr('اتضاف للجلسة ✓','Added to the session ✓'))}
      else toast(tr('التمرين موجود في الجلسة','Already in this session'));
      closeModal();curEx=k;wAnim=true;renderSession();wAnim=false;$('#sess').scrollTop=0;break}
    case 'dlGo':startDeload();break;
    case 'dlSkip':S.dlSkip=today();save();renderHome();break;
    case 'cbGo':if(b.classList.contains('cbh')){try{navigator.vibrate&&navigator.vibrate(10)}catch(e){}}if(S.draft&&S.draft.cb&&!S.draft.editing){openSession();break}cbPreview();break;
    case 'tCore':{const t=day(pDay).ex[i];if(!t)break;t.core=!t.core;save();queueBackup();closeModal();renderProgram();break}
    case 'tMv':{const a=day(pDay).ex,j=i+(+b.dataset.v);if(j<0||j>=a.length)break;[a[i],a[j]]=[a[j],a[i]];save();queueBackup();closeModal();renderProgram();break}
    case 'libAddTo':{const dd=S.program.days.find(x=>x.id===b.dataset.d);if(!dd)break;if(dd.ex.some(t=>t.name===b.dataset.n)){toast(tr('موجود فعلًا في اليوم ده','Already in that day'));break}dd.ex.push(mk(b.dataset.n));save();queueBackup();closeModal();if(tab==='lib')renderLib();toast(tr(`اتضاف لـ ${dd.name} ✓`,`Added to ${dd.name} ✓`));break}
    case 'npNew':npModal();break;
    case 'npAddD':{const w=$('#npD'),k=w.querySelectorAll('.npd').length;if(k>=7)break;w.insertAdjacentHTML('beforeend',`<label class="fld">${tr('يوم','Day')} ${k+1}<input class="inp npd" maxlength="24" value="${tr('يوم','Day')} ${k+1}"></label>`);break}
    case 'npRmD':{const a=$('#npD').querySelectorAll('.fld');if(a.length>1)a[a.length-1].remove();break}
    case 'npSave':{const n=($('#npN').value||'').trim()||tr('برنامجي','My program'),dn=[...document.querySelectorAll('.npd')].map(x=>x.value.trim()).filter(Boolean);if(!dn.length){toast(T().nameReq);break}
      sysInit();S.myProgs=S.myProgs||[];const id='c'+uid();S.myProgs.push({id,name:n.slice(0,30)});S.sys.saved[S.sys.cur]={days:S.program.days};
      S.program.days=dn.map((x,k)=>({id:'D'+uid()+k,name:x.slice(0,24),ex:[]}));S.sys.cur=id;pDay=S.program.days[0].id;pEdit=true;save();queueBackup();closeModal();go('prog');toast(tr('اتعمل ✓ ضيف تمارين كل يوم','Created ✓ add each day\'s exercises'));break}
    case 'npDel':{const id=b.dataset.id,pg=(S.myProgs||[]).find(x=>x.id===id);if(!pg)break;ask(tr(`تمسح برنامج «${pg.name}»؟ الجلسات اللي لعبتها منه هتفضل في السجل.`,`Delete “${pg.name}”? Sessions you logged with it stay in history.`),{danger:1,yes:tr('امسح','Delete')}).then(ok=>{if(!ok)return;S.myProgs=S.myProgs.filter(x=>x.id!==id);if(S.sys&&S.sys.saved)delete S.sys.saved[id];save();queueBackup();sysModal()});break}
    case 'cbStart':closeModal();startComeback();break;
    case 'cbSwap':startComeback();break;
    case 'libG':libG=b.dataset.g;libModal();break;
    case 'cuNew':cuModal();break;
    case 'cuEdit':cuModal(b.dataset.n);break;
    case 'hwEdit':closeSheet();hwModal(b.dataset.n);break;
    case 'hwSave':hwSave(b.dataset.n);break;
    case 'hwReset':{const n=b.dataset.n,old=libHow(n);if(S.libOv)delete S.libOv[n];hwApply(n,old);toast(tr('رجع الأصلي ✓','Restored ✓'));break}
    case 'cuSave':cuSave(b.dataset.n);break;
    case 'cuDel':ask(tr('تحذف التمرين ده من مكتبتك؟ برنامجك وسجلك مش هيتأثروا.','Delete this exercise from your library? Your program and log are not affected.'),{danger:1}).then(ok=>{if(ok){S.custom=(S.custom||[]).filter(x=>x.name!==b.dataset.n);save();queueBackup();closeModal();renderLib()}});break;
    case 'fs':S.settings.fs=+b.dataset.k;applyFs();save();renderData();break;
    case 'qGest':S.settings.qGest=b.dataset.k==='off'?0:1;save();renderData();break;
    case 'howLang':S.settings.howLang=b.dataset.k==='en'?'en':'ar';save();renderData();break;
    case 'lbE':lbE=b.dataset.e;{const c=$('#lbEC'),l=$('#lbL');if(c)c.innerHTML=lbEChips();if(l)l.innerHTML=libRows()}break;
    case 'lbG':lbG=b.dataset.g;{const c=$('#lbC'),l=$('#lbL');if(c)c.innerHTML=lbChips();if(l)l.innerHTML=libRows()}break;
    case 'lbAdd':modal(`<h3>${tr('تضيفه لأنهي يوم؟','Add to which day?')}</h3><div class="mu en" style="margin-bottom:10px;text-align:start">${esc(b.dataset.n)}</div>${S.program.days.map(x=>`<button class="btn w" style="margin-bottom:8px" data-a="lbPick" data-d="${x.id}" data-n="${esc(b.dataset.n)}"><bdi>${esc(x.name)}</bdi></button>`).join('')}<button class="btn ghost w" data-a="closeM">${T().close}</button>`);break
    case 'lbPick':{const dd=day(b.dataset.d);if(dd){dd.ex.push(mk(b.dataset.n));save();queueBackup();closeModal();lbRefresh();toast(tr('اتضاف لـ ','Added to ')+dd.name+' ✓')}break}
    case 'libAdd':{const t=mk(b.dataset.n);day(pDay).ex.push(t);save();queueBackup();closeModal();renderProgram();toast(tr('اتضاف ✓','Added ✓'));break}
    case 'dayAdd':{const nd={id:'D'+uid(),name:tr('يوم جديد','New day'),ex:[]};S.program.days.push(nd);pDay=nd.id;save();queueBackup();renderProgram();dayModal();break}
    case 'dayEdit':dayModal();break;
    case 'daySave':{const v=$('#dName').value.trim();if(v){day(pDay).name=v;save();queueBackup()}closeModal();renderProgram();break}
    case 'dayDel':ask(tr('تحذف اليوم ده بتمارينه؟ السجل القديم مش هيتأثر.','Delete this day and its exercises? Your log is not affected.'),{danger:1}).then(ok=>{if(ok){const _u=undoSnap();S.program.days=S.program.days.filter(x=>x.id!==pDay);pDay=S.program.days[0].id;save();queueBackup();closeModal();renderProgram();offerUndo(tr('اليوم اتمسح','Day deleted'),_u)}});break;
    case 'editT':tplModal(i);break;
    case 'addT':cuModal();break;
    case 'saveT':saveTpl(i);break;
    case 'delT':ask(L.confDelEx,{danger:1}).then(ok=>{if(ok){const _u=undoSnap();day(pDay).ex.splice(i,1);save();queueBackup();closeModal();renderProgram();offerUndo(tr('التمرين اتشال','Exercise removed'),_u)}});break;
    case 'copyT':copy(tplCard(day(pDay)));break;
    case 'backup':backupNow();break;
    case 'share':shareBackup();break;
    case 'link':linkFile();break;
    case 'csv':exportCSV();break;
    case 'theme':S.settings.theme=b.dataset.k==='morning'?'morning':'iron';save();applyTheme();renderData();break;
    case 'syncOn':enableSync();break;
    case 'syncNow':{chg++;SYNC.dirty=true;runBackup(true).then(ok=>toast(ok?T().syncOK:T().syncErr(syncMsg(SYNC.err))));break}
    case 'syncOff':disableSync();break;
    case 'syncRestore':restoreRemote();break;
  }
});
const sess=$('#sess');
function onField(ev){
  const t=ev.target,d=S.draft;if(!d)return;
  if(t.id==='sDate'){d.date=t.value;saveSoon();return}
  if(t.id==='sCyc'){const n=num(t.value);if(n>0)d.cycle=n;save();return}
  const c=t.closest('.wmain');if(!c)return;const e=d.ex[+c.dataset.i],f=t.dataset.f;
  if(f==='w')e.w=t.value;else if(f==='s')e.sets[+t.dataset.j]=t.value;else if(f==='n')e.note=t.value;else return;
  saveSoon();updCore();
}
sess.addEventListener('input',onField);sess.addEventListener('change',onField);
let tx=0,ty=0,tsh=false;
let tt=0;
sess.addEventListener('touchstart',e=>{const t=e.touches[0];tx=t.clientX;ty=t.clientY;tt=Date.now();tsh=!!e.target.closest('#sheet,input')},{passive:true});
sess.addEventListener('touchend',e=>{if(!S.draft||tsh)return;const t=e.changedTouches[0],dx=t.clientX-tx,dy=t.clientY-ty,fast=Date.now()-tt<300;if(Math.abs(dx)<(fast?24:42)||Math.abs(dx)<Math.abs(dy))return;goEx(curEx+((LANG==='ar'?dx>0:dx<0)?1:-1))},{passive:true});
let gTap=false;
sess.addEventListener('touchstart',e=>{gTap=!!e.target.closest('.wname')},{passive:true});
sess.addEventListener('touchend',e=>{if(!gTap)return;gTap=false;if(!S.draft)return;const t=e.changedTouches[0],dx=t.clientX-tx,dy=t.clientY-ty;if(Math.abs(dx)<22&&Math.abs(dy)<22&&Date.now()-tt<700){e.preventDefault();openGuide()}},{passive:false});
sess.addEventListener('keydown',ev=>{if(ev.key!=='Enter'||ev.target.tagName!=='INPUT')return;const all=[...sess.querySelectorAll('input.inp')];const k=all.indexOf(ev.target);if(k>-1&&all[k+1]){ev.preventDefault();all[k+1].focus()}});

/* ================= التثبيت والتحديث ================= */
let updating=false,r=false;
if('serviceWorker' in navigator&&location.protocol!=='file:'){
  navigator.serviceWorker.register('sw.js?v='+VER).then(reg=>{
    reg.update().catch(()=>{});document.addEventListener('visibilitychange',()=>{if(!document.hidden)reg.update().catch(()=>{})});
    const show=()=>{if(reg.waiting&&navigator.serviceWorker.controller){const u=$('#updBtn');u.hidden=false;u.onclick=()=>{updating=true;saveUI();flushSave();reg.waiting&&reg.waiting.postMessage('skip')}}};
    show();reg.addEventListener('updatefound',()=>{const w=reg.installing;w&&w.addEventListener('statechange',()=>{if(w.state==='installed')show()})});
  }).catch(()=>{});
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(updating&&!r){r=true;location.reload()}});
}
/* تسخين: أول رسم للسجل والمكتبة بيبقى أبطأ، فبنعمله مرة في الخلفية وإنت على الرئيسية (من غير ما يبان) */
function warmTabs(){try{if(tab!=='home'||!$('#sess').hidden||!$('#modal').hidden)return;renderHistory();renderLib();renderHome()}catch(e){}}
function readUI(){try{return JSON.parse(localStorage.getItem('gymlog.ui')||'null')}catch(e){return null}}
function restoreUI(u){try{if(!u||Date.now()-u.at>12*36e5)return;
  if(u.t&&u.t!=='home')navTab(u.t);
  if(u.s&&S.draft)openSession();else if(u.y)setTimeout(()=>window.scrollTo(0,u.y),50)}catch(e){}}
window.addEventListener('scroll',()=>{clearTimeout(window.__st);window.__st=setTimeout(saveUI,250)},{passive:true});
window.addEventListener('pagehide',flushSave);
document.addEventListener('visibilitychange',()=>{if(document.hidden){flushSave();saveUI();if(S.draft)queueDraftBackup()}else if(!$('#sess').hidden)wakeOn()});
/* v134: مفيش أي قايمة أو تقويم من أندرويد جوّه التطبيق. أي <select> أو خانة تاريخ (دلوقتي أو بعدين) بتتبدّل تلقائي بزرار
   بيفتح لوحة بنفس الثيم. الـ select الأصلي بيفضل مخفي وبيتحدّث، فالكود القديم (.value و onchange) شغال زي ما هو */
const XP={el:null,done:null};
function xpClose(){const w=XP.el;if(!w)return;XP.el=null;const f=XP.done;XP.done=null;w.classList.remove('on');setTimeout(()=>w.remove(),180);if(f)f()}
function xpOpen(title,body,wire,done){xpClose();const w=document.createElement('div');w.id='xp';w.setAttribute('role','dialog');w.setAttribute('aria-modal','true');
  w.innerHTML=`<div class="xpb">${title?`<div class="xpt">${esc(title)}</div>`:''}${body}</div>`;
  w.addEventListener('click',e=>{if(e.target===w){e.stopPropagation();xpClose()}});
  document.body.appendChild(w);XP.el=w;XP.done=done||null;void w.offsetWidth;w.classList.add('on');wire(w);try{navigator.vibrate&&navigator.vibrate(6)}catch(e){}}
const xpTitle=el=>{const l=el.closest('label');if(l){let t='';l.childNodes.forEach(n=>{if(n.nodeType===3)t+=n.textContent});t=t.trim();if(t)return t}
  if(el.tagName==='SELECT'&&el.options[0]&&el.options[0].value===''&&el.classList.contains('psel'))return el.options[0].text;return ''};
const xpLabel=sel=>{const o=sel.options[sel.selectedIndex];return o?o.text:''};
function xpSync(sel){const b=sel.nextElementSibling;if(b&&b.classList.contains('xsel'))b.querySelector('span').textContent=xpLabel(sel)}
function xpFire(el,ev){el.dispatchEvent(new Event(ev,{bubbles:true}))}
function xpSelect(sel){const ph=sel.classList.contains('psel')&&sel.options[0]&&sel.options[0].value==='';
  let h='',i=0;const row=o=>{const k=i++;if(ph&&k===0)return '';return `<button type="button" class="xpo${o.selected&&!(ph&&o.value==='')?' on':''}" data-k="${k}"${o.disabled?' disabled':''}><span>${esc(o.text)}</span><i>✓</i></button>`};
  for(const c of sel.children){if(c.tagName==='OPTGROUP'){const r=[...c.children].map(row).join('');if(r)h+=`<div class="xpg">${esc(c.label)}</div>`+r}else h+=row(c)}
  xpOpen(xpTitle(sel),`<div class="xpl">${h}</div>`,w=>{
    const on=w.querySelector('.xpo.on');if(on)on.scrollIntoView({block:'center'});
    w.querySelector('.xpl').addEventListener('click',e=>{const b=e.target.closest('.xpo');if(!b||b.disabled)return;e.stopPropagation();
      const k=+b.dataset.k,ch=sel.selectedIndex!==k;sel.selectedIndex=k;xpClose();if(ch){xpFire(sel,'input');xpFire(sel,'change')}xpSync(sel)})})}
const XMN={ar:['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'],en:['January','February','March','April','May','June','July','August','September','October','November','December']};
const XWD={ar:['س','ح','ن','ث','ر','خ','ج'],en:['Mo','Tu','We','Th','Fr','Sa','Su']};
function xpDate(inp){const ar=LANG==='ar',v=/^\d{4}-\d{2}-\d{2}$/.test(inp.value)?inp.value:today(),td=today();
  let y=+v.slice(0,4),m=+v.slice(5,7)-1;const p2=n=>String(n).padStart(2,'0');
  const grid=()=>{const f=new Date(y,m,1).getDay(),st=ar?(f+1)%7:(f+6)%7,nd=new Date(y,m+1,0).getDate();let h='';
    for(let k=0;k<st;k++)h+='<i></i>';
    for(let d=1;d<=nd;d++){const iso=`${y}-${p2(m+1)}-${p2(d)}`,fu=iso>td;h+=`<button type="button" class="xd${iso===inp.value?' on':''}${iso===td?' td':''}" data-d="${iso}"${fu?' disabled':''}>${d}</button>`}
    return `<div class="xch"><button type="button" class="xcn" data-n="-1">‹</button><b>${XMN[ar?'ar':'en'][m]} <bdi class="en">${y}</bdi></b><button type="button" class="xcn" data-n="1">›</button></div><div class="xcw">${XWD[ar?'ar':'en'].map(x=>`<span>${x}</span>`).join('')}</div><div class="xcg">${h}</div><button type="button" class="xct" data-d="${td}">${tr('النهارده','Today')}</button>`};
  xpOpen(xpTitle(inp),`<div class="xcal" dir="${ar?'rtl':'ltr'}">${grid()}</div>`,w=>{const c=w.querySelector('.xcal');
    c.addEventListener('click',e=>{e.stopPropagation();const n=e.target.closest('.xcn');
      if(n){m+=+n.dataset.n;if(m<0){m=11;y--}if(m>11){m=0;y++}c.innerHTML=grid();return}
      const d=e.target.closest('[data-d]');if(!d||d.disabled)return;const ch=inp.value!==d.dataset.d;inp.value=d.dataset.d;xpClose();if(ch){xpFire(inp,'input');xpFire(inp,'change')}xpSyncD(inp)})})}
function xpSyncD(inp){const b=inp.nextElementSibling;if(b&&b.classList.contains('xsel'))b.querySelector('span').textContent=inp.value?fmtD(inp.value):'—'}
function xpEnhance(root){(root||document).querySelectorAll('select:not([data-xp]),input[type=date]:not([data-xp])').forEach(el=>{el.dataset.xp='1';
  const d=el.tagName==='INPUT',b=document.createElement('button');b.type='button';b.className=(el.className||'')+' xsel';if(el.id)b.dataset.for=el.id;
  b.innerHTML=`<span></span><i aria-hidden="true">${d||el.classList.contains('psel')?'':'⌄'}</i>`;el.classList.add('xhid');el.tabIndex=-1;el.after(b);d?xpSyncD(el):xpSync(el);
  if(!d)el.addEventListener('change',()=>setTimeout(()=>xpSync(el)));else el.addEventListener('change',()=>xpSyncD(el));
  b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();if(el.disabled)return;d?xpDate(el):xpSelect(el)})})}
new MutationObserver(ms=>{for(const m of ms)if(m.addedNodes.length){xpEnhance();break}}).observe(document.body,{childList:true,subtree:true});
xpEnhance();
/* أمان زيادة: لو أي select اتلمس بطريقة ما، اللوحة بتاعتنا هي اللي تفتح مش بتاعة النظام */
document.addEventListener('mousedown',e=>{const t=e.target;if(t&&(t.tagName==='SELECT'||(t.tagName==='INPUT'&&t.type==='date'))){e.preventDefault();t.tagName==='SELECT'?xpSelect(t):xpDate(t)}},true);
const UI0=readUI();
boot().then(()=>{if(migTheme()){delete S.settings.thGr;delete S.settings.thDawn;save()}applyLang();if(S.impN){const k=S.impN;S.impN=0;save();setTimeout(()=>toast(T().histNote(k)),600)}go('home');restoreUI(UI0);if(S.onb)setTimeout(()=>onbModal(1),700);else if(!S.settings.legend){S.settings.legend=1;save();setTimeout(()=>guideModal(null,1),1200)}if(S.mig6ask){delete S.mig6ask;save();setTimeout(async()=>{if(await ask(tr('التطبيق بقى بيعتبر أداءك نضيف من الأول، وانت بتعلّم «مش نضيف» بس لو حصلت مرجحة. نعتبر جلساتك اللي فاتت نضيفة كمان، علشان قاعدة الزيادة تبدأ تحسب منها؟','Form now counts as clean by default; you mark «not clean» only when it is not. Count your past sessions as clean too, so the progression rule can use them?'),{yes:tr('أيوه','Yes'),no:tr('لأ','No')})){for(const x of S.sessions)if(!x.imp)for(const e of x.ex)e.clean=true;save();queueBackup();go(tab)}},900)}setTimeout(()=>('requestIdleCallback' in window?requestIdleCallback(warmTabs,{timeout:4000}):warmTabs()),2500);if(pendMig){toast(T().migNote);pendMig=false}if(SYNC.on&&SYNC.dirty)setTimeout(runBackup,1500)});
