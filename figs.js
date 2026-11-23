/* چيم لوج — رسم توضيحي بسيط للتمرين.
   هيكل ثابت الأطوال (جانبي وأمامي) بزوايا + أنماط حركة. A = أول الشدّ، B = آخره.
   الإيقاع: صعود ١ث، ثبات ٠.٣، نزول ٣ث، ثبات ٠.٢ (نفس إيقاع التمرين). أي تمرين مالوش نمط دقيق = من غير رسم. */
(function(){
const R=a=>a*Math.PI/180,lerp=(a,b,t)=>a+(b-a)*t;
const L={tor:40,ua:24,fa:22,th:32,sh:30,ft:12};
const PT=(o,a,l)=>[o[0]+l*Math.cos(R(a)),o[1]+l*Math.sin(R(a))];
const F=n=>n.toFixed(1);
function ik(o,t,l1,l2,b){const dx=t[0]-o[0],dy=t[1]-o[1],d=Math.hypot(dx,dy)||.01;
  const dd=Math.min(l1+l2-.01,Math.max(Math.abs(l1-l2)+.01,d)),base=Math.atan2(dy,dx);
  const A=Math.acos(Math.max(-1,Math.min(1,(l1*l1+dd*dd-l2*l2)/(2*l1*dd))));
  return{mid:[o[0]+l1*Math.cos(base+b*A),o[1]+l1*Math.sin(base+b*A)],end:[o[0]+dd*Math.cos(base),o[1]+dd*Math.sin(base)]}}
function joints(p){
  const hip=p.hip,sho=PT(hip,p.tor,p.tl||L.tor),head=PT(sho,p.tor+(p.hdo||0),11);
  let elb,han;const ar=p.arm||{a:[90,90]};
  if(ar.a){elb=PT(sho,ar.a[0],L.ua);han=PT(elb,ar.a[1],L.fa)}
  else{const T=ar.h||[sho[0]+ar.r[0],sho[1]+ar.r[1]],r=ik(sho,T,L.ua,L.fa,p.b||1);elb=r.mid;han=r.end}
  let kne,ank;const lg=p.leg||{k:[90,90]};
  if(lg.k){kne=PT(hip,lg.k[0],L.th);ank=PT(kne,lg.k[1],L.sh)}
  else{const r=ik(hip,lg.f,L.th,L.sh,p.lb||-1);kne=r.mid;ank=r.end}
  const toe=PT(ank,p.ft||0,p.ftl||L.ft);let kn2=null,an2=null,to2=null;
  if(p.leg2){const r=ik(hip,p.leg2.f,L.th,L.sh,p.lb2||-1);kn2=r.mid;an2=r.end;to2=PT(an2,p.ft2==null?(p.ft||0):p.ft2,L.ft)}
  return{hip,sho,head,elb,han,kne,ank,toe,kn2,an2,to2}}
function mix(A,B,t){
  if(Array.isArray(A))return A.map((v,i)=>mix(v,B[i],t));
  if(A&&typeof A==='object'){const o={};for(const k in A)o[k]=(k in B)?mix(A[k],B[k],t):A[k];return o}
  if(typeof A==='number')return lerp(A,B,t);return A}
const ease=t=>.5-.5*Math.cos(Math.PI*t);
const CYC=[1000,300,3000,200],TOT=4500;
function sAt(ms){let t=ms%TOT;if(t<CYC[0])return ease(t/CYC[0]);t-=CYC[0];if(t<CYC[1])return 1;t-=CYC[1];if(t<CYC[2])return 1-ease(t/CYC[2]);return 0}
/* ---- رسم ---- */
const ln=(a,b,c='fq')=>`<line x1="${F(a[0])}" y1="${F(a[1])}" x2="${F(b[0])}" y2="${F(b[1])}" class="${c}"/>`;
const pl=(pts,c)=>`<polyline points="${pts.map(p=>F(p[0])+','+F(p[1])).join(' ')}" class="${c}"/>`;
const rc=(x,y,w,h,c='fq')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" class="${c}"/>`;
const ci=(p,r,c='fq')=>`<circle cx="${F(p[0])}" cy="${F(p[1])}" r="${r}" class="${c}"/>`;
const FL=(y=123)=>`<line x1="6" y1="${y}" x2="194" y2="${y}" class="fq"/>`;
const bar=h=>ci(h,8)+ci(h,1.6,'fb');
const dbl=h=>ci(h,4.5,'fq fw');
const eqOf=(k,h)=>k==='bb'?bar(h):k==='db'?dbl(h):k==='ez'?ci(h,5)+ci(h,1.4,'fb'):'';
function draw(spec,p){
  const j=joints(p),hl=new Set(spec.hl||[]),c=k=>hl.has(k)?'fhl':'fbd';
  let s='<g>'+(spec.eq?spec.eq(j,p):'')+'</g>';
  // الأطراف البعيدة (باهتة)
  const off=[-3,-1.5];const sh=q=>[q[0]+off[0],q[1]+off[1]];
  s+=`<g class="ffar">`+pl([sh(j.sho),sh(j.elb),sh(j.han)],'fbd');
  if(j.kn2)s+=pl([j.hip,j.kn2,j.an2,j.to2],'fbd');else s+=pl([sh(j.hip),sh(j.kne),sh(j.ank),sh(j.toe)],'fbd');
  s+='</g>';
  s+=ln(j.hip,j.sho,c('tor')+' fbd0');
  s+=`<circle cx="${F(j.head[0])}" cy="${F(j.head[1])}" r="6.5" class="fh"/>`;
  s+=pl([j.hip,j.kne],c('th'))+pl([j.kne,j.ank],c('sh'))+ln(j.ank,j.toe,'fbd');
  s+=pl([j.sho,j.elb],c('ua'))+pl([j.elb,j.han],c('fa'));
  return s}
/* ---- أمامي ---- */
function drawFront(spec,p){
  const cx=100,sy=p.sy,sw=14,hy=sy+40;let s='<g>'+(spec.eq?spec.eq(p):'')+'</g>';
  const hl=new Set(spec.hl||[]),c=k=>hl.has(k)?'fhl':'fbd';
  const arm=(sg)=>{const S=[cx+sg*sw,sy];let E,H;
    if(p.arm.a){E=PT(S,sg>0?p.arm.a[0]:180-p.arm.a[0],L.ua);H=PT(E,sg>0?p.arm.a[1]:180-p.arm.a[1],L.fa)}
    else{const T=[cx+sg*p.arm.h[0],p.arm.h[1]],r=ik(S,T,L.ua,L.fa,sg*(p.arm.b||1));E=r.mid;H=r.end}
    return[S,E,H]};
  const a1=arm(1),a2=arm(-1);
  s+=ln([cx-sw,sy],[cx+sw,sy],'fbd')+ln([cx,sy],[cx,hy],c('tor'))+`<circle cx="${cx}" cy="${sy-13}" r="6.5" class="fh"/>`;
  const seated=p.seat;
  if(seated){s+=pl([[cx-8,hy],[cx-14,hy+2],[cx-14,hy+32]],'fbd')+pl([[cx+8,hy],[cx+14,hy+2],[cx+14,hy+32]],'fbd')}
  else s+=ln([cx-6,hy],[cx-9,123],'fbd')+ln([cx+6,hy],[cx+9,123],'fbd');
  s+=pl(a1,c('ua'))+pl(a2,c('ua'));
  p._h=[a1[2],a2[2]];
  return s}
/* ============ الأنماط ============ */
const PAT={};
const benchFlat=(x0=14,x1=100)=>rc(x0,104,x1-x0,6)+ln([x0+16,110],[x0+16,123])+ln([x1-16,110],[x1-16,123]);
/* ضغط نايم */
PAT.press_lying=o=>{const inc=o.inc||0,e=o.eq||'bb',dec=o.dec;
  const a=inc?-inc:(dec?18:0);const tor=180+(inc||0)-(dec?18:0);
  const hip=[80,99],up=[Math.cos(R(tor+90)),Math.sin(R(tor+90))],fw=[Math.cos(R(tor+180)),Math.sin(R(tor+180))];
  const sho=PT(hip,tor,40);
  const hA=[sho[0]+up[0]*17+fw[0]*13,sho[1]+up[1]*17+fw[1]*13],hB=[sho[0]+up[0]*45+fw[0]*3,sho[1]+up[1]*45+fw[1]*3];
  const base={hip,tor,leg:{f:[110,120]},lb:-1,ft:0,b:1};
  const pad=ln([hip[0]-up[0]*5+fw[0]*14,hip[1]-up[1]*5+fw[1]*14],[sho[0]-up[0]*5-fw[0]*18,sho[1]-up[1]*5-fw[1]*18],'fq fw');
  const legs=ln([hip[0]-up[0]*5,hip[1]-up[1]*5],[hip[0]-up[0]*5,123])+ln([sho[0]-up[0]*5,sho[1]-up[1]*5],[sho[0]-up[0]*5,123]);
  return{A:{...base,arm:{h:hA}},B:{...base,arm:{h:hB}},hl:['tor','ua'],eq:j=>FL()+(o.floor?'':pad+legs+(o.smith?ln([hA[0]-4,10],[hA[0]-4,120])+ln([hB[0]+10,10],[hB[0]+10,120]):''))+eqOf(e,j.han)}};
/* ضغط جهاز جالس */
PAT.press_machine=o=>{const hip=[68,98],tor=-98,sho=PT(hip,tor,40);
  const base={hip,tor,leg:{f:[110,120]},lb:-1,ft:0,b:-1};const inc=o.inc?-12:0;
  return{A:{...base,arm:{h:[sho[0]+14,sho[1]+10]}},B:{...base,arm:{h:[sho[0]+44,sho[1]+10+inc]}},hl:['tor','ua'],
   eq:j=>FL()+rc(52,101,36,5)+ln([sho[0]-8,sho[1]-8],[hip[0]-10,hip[1]],'fq fw')+ln([j.han[0]+2,j.han[1]-12],[j.han[0]+2,j.han[1]+12],'fq fw')}};
/* ضغط كتف */
PAT.press_vertical=o=>{const e=o.eq||'bb',st=!!o.stand;
  const hip=st?[100,60]:[86,97],tor=-90,sho=PT(hip,tor,40);
  const base=st?{hip,tor,leg:{f:[100,121]},lb:-1,ft:0,b:1}:{hip,tor,leg:{f:[118,120]},lb:-1,ft:0,b:1};
  return{A:{...base,arm:{h:[sho[0]+15,sho[1]-8]}},B:{...base,arm:{h:[sho[0]+4,sho[1]-45]}},hl:['ua','tor'],view:st?'0 -44 200 184':'0 -38 200 178',
   eq:j=>FL()+(st?'':rc(66,100,44,5)+ln([62,100],[62,40],'fq fw'))+(o.smith?ln([sho[0]+14,8],[sho[0]+14,120]):'')+eqOf(e,j.han)}};
/* ضغط (Push-Up) */
PAT.pushup=o=>{const hh=o.hand||0,fh=o.foot||0,T=[150,123-fh-3],Hx=48,Hy=123-hh;
  const mk=(sy)=>{const d=102,dy=T[1]-sy,Sx=T[0]-Math.sqrt(d*d-dy*dy),S=[Sx,sy],u=[(T[0]-Sx)/d,dy/d];
    const hip=[S[0]+u[0]*40,S[1]+u[1]*40],tor=Math.atan2(S[1]-hip[1],S[0]-hip[0])*180/Math.PI;
    return{hip,tor,arm:{h:[Hx,Hy]},b:-1,leg:{f:T},lb:-1,ft:0,hdo:0}};
  const top=Hy-45,bot=Hy-14-(o.diamond?0:0);
  return{A:mk(bot),B:mk(top),hl:['tor','ua'],eq:j=>FL()+(hh?rc(Hx-14,123-hh,28,hh):'')+(fh?rc(T[0]-6,123-fh,30,fh):'')}};
/* ديبس على متوازي */
PAT.dip=o=>{const H=[96,66];const mk=(sy,tor)=>{const sho=[H[0]-2,sy],hip=PT(sho,tor+180,40);
  return{hip,tor,arm:{h:H},b:-1,leg:{k:[100,150]},ft:90}};
  return{A:mk(H[1]-18,-96),B:mk(H[1]-45,-92),hl:['ua','tor'],eq:()=>ln([H[0]-12,H[1]],[H[0]+14,H[1]],'fq fw')+ln([H[0]-8,H[1]],[H[0]-8,123])+FL()}};
/* سحب أمامي */
PAT.pulldown=o=>{const hip=[84,99],tor=-100,sho=PT(hip,tor,40),w=o.wide?7:0;
  const base={hip,tor,leg:{f:[116,120]},lb:-1,ft:0,b:1};
  return{A:{...base,arm:{h:[sho[0]+6+w,sho[1]-45]}},B:{...base,arm:{h:[sho[0]+15,sho[1]+4]}},hl:['tor','ua'],
   eq:j=>FL()+rc(70,102,40,5)+rc(96,86,20,6)+ln(j.han,[j.han[0],6])+ci([j.han[0],5],3.5)+ln([j.han[0]-9,j.han[1]],[j.han[0]+9,j.han[1]],'fq fw')}};
/* عقلة */
PAT.pullup=o=>{const H=[100,6];const mk=(sy,tor)=>{const sho=[100,sy],hip=PT(sho,tor+180,40);
  return{hip,tor,arm:{h:H},b:1,leg:{k:[92,170]},ft:0}};
  return{A:mk(54,-90),B:mk(22,-92),hl:['tor','ua'],eq:()=>ln([70,H[1]],[130,H[1]],'fq fw'),view:'0 -6 200 172'}};
/* تجديف جالس */
PAT.row_seated=o=>{const hip=[66,98],tor=-92,sho=PT(hip,tor,40);
  const base={hip,tor,leg:{f:[112,104]},lb:-1,ft:-80,b:1};
  return{A:{...base,arm:{h:[sho[0]+44,sho[1]+14]}},B:{...base,arm:{h:[sho[0]+8,sho[1]+16]}},hl:['tor','ua'],
   eq:j=>FL()+rc(50,101,34,5)+rc(112,98,18,5)+ln(j.han,[188,j.han[1]])+ln([j.han[0],j.han[1]-5],[j.han[0],j.han[1]+5],'fq fw')}};
/* تجديف منحني (بار/دمبل) */
PAT.row_hinged=o=>{const e=o.eq||'bb',hip=[88,62],tor=-42,sho=PT(hip,tor,40);
  const base={hip,tor,leg:{f:[96,121]},lb:-1,ft:0,b:-1};
  return{A:{...base,arm:{h:[sho[0]+2,sho[1]+45]}},B:{...base,arm:{h:[sho[0]-2,sho[1]+27]}},hl:['tor','ua'],eq:j=>FL()+eqOf(e,j.han)}};
/* سحب دراع مفرودة */
PAT.straight_arm=o=>{const hip=[96,66],tor=-72,sho=PT(hip,tor,40);
  const base={hip,tor,leg:{f:[98,121]},lb:-1,ft:0,b:1};
  return{A:{...base,arm:{h:[sho[0]+34,sho[1]-30]}},B:{...base,arm:{h:[sho[0]+8,sho[1]+44]}},hl:['tor','ua'],view:'0 -34 200 174',
   eq:j=>FL()+ln(j.han,[sho[0]+60,8])+ci([sho[0]+60,8],3.5)}};
/* فيس بول */
PAT.face_pull=o=>{const hip=[96,60],tor=-90,sho=PT(hip,tor,40);
  const base={hip,tor,leg:{f:[98,121]},lb:-1,ft:0,b:-1};
  return{A:{...base,arm:{h:[sho[0]+44,sho[1]+2]}},B:{...base,arm:{h:[sho[0]+14,sho[1]-8]}},hl:['ua','tor'],
   eq:j=>FL()+ln(j.han,[186,sho[1]+2])+ci([186,sho[1]+2],3.5)}};
/* كيرل واقف */
PAT.curl=o=>{const e=o.eq||'db',st=o.stand!==false;
  if(o.preacher){const hip=[80,96],tor=-95,sho=PT(hip,tor,40);
    const base={hip,tor,leg:{f:[112,120]},lb:-1,ft:0};
    return{A:{...base,arm:{a:[55,55]}},B:{...base,arm:{a:[55,-62]}},hl:['ua','fa'],
     eq:j=>FL()+rc(64,100,34,5)+ln([sho[0]+4,sho[1]+8],[sho[0]+34,sho[1]+30],'fq fw')+eqOf(e,j.han)}}
  if(o.incline){const hip=[90,98],tor=-132,sho=PT(hip,tor,40);
    const base={hip,tor,leg:{f:[120,120]},lb:-1,ft:0};
    return{A:{...base,arm:{a:[92,92]}},B:{...base,arm:{a:[92,-70]}},hl:['ua','fa'],
     eq:j=>FL()+ln([sho[0]-8,sho[1]-6],[hip[0]-6,hip[1]+4],'fq fw')+rc(76,101,28,5)+eqOf(e,j.han)}}
  const hip=[100,60],tor=-90;
  const base={hip,tor,leg:{f:[100,121]},lb:-1,ft:0};
  return{A:{...base,arm:{a:[92,90]}},B:{...base,arm:{a:[92,-62]}},hl:['ua','fa'],
   eq:j=>FL()+(e==='cable'?ln(j.han,[168,121])+ci([168,121],3.5):eqOf(e,j.han))}};
/* بوشداون */
PAT.pushdown=o=>{const hip=[96,60],tor=-90;const base={hip,tor,leg:{f:[98,121]},lb:-1,ft:0};
  return{A:{...base,arm:{a:[92,-28]}},B:{...base,arm:{a:[92,88]}},hl:['fa','ua'],
   eq:j=>FL()+ln(j.han,[146,6])+ci([146,5],3.5)+ln([j.han[0]-3,j.han[1]],[j.han[0]+3,j.han[1]],'fq fw')}};
/* تراي فوق الراس */
PAT.overhead_ext=o=>{const e=o.eq||'db',hip=[100,60],tor=-90;const base={hip,tor,leg:{f:[100,121]},lb:-1,ft:0};
  return{A:{...base,arm:{a:[-80,150]}},B:{...base,arm:{a:[-84,270]}},hl:['fa','ua'],view:'0 -40 200 180',
   eq:j=>FL()+(e==='cable'?ln(j.han,[52,121])+ci([52,121],3.5):dbl(j.han))}};
/* سكَل كراشر */
PAT.skull=o=>{const hip=[80,99],tor=180,sho=PT(hip,tor,40);
  const base={hip,tor,leg:{f:[110,120]},lb:-1,ft:0};
  return{A:{...base,arm:{a:[-90,168]}},B:{...base,arm:{a:[-90,270]}},hl:['fa','ua'],
   eq:j=>FL()+benchFlat(20,100)+eqOf(o.eq||'ez',j.han)}};
/* سكوات */
PAT.squat=o=>{const e=o.eq||'bb',T=[100,121],kind=o.kind||'back';
  const mk=(hip,tor)=>{const sho=PT(hip,tor,40);let h;
    h=kind==='goblet'?[sho[0]+13,sho[1]+8]:kind==='front'?[sho[0]+11,sho[1]+2]:[sho[0]-2,sho[1]-3];
    return{hip,tor,arm:{h},b:kind==='back'?1:-1,leg:{f:T},lb:-1,ft:0}};
  return{A:mk([76,96],-52),B:mk([100,60],-90),hl:['th','tor'],
   eq:j=>FL()+(o.smith?ln([j.sho[0]+16,8],[j.sho[0]+16,121])+ln([j.sho[0]-14,8],[j.sho[0]-14,121]):'')+(kind==='goblet'?dbl(j.han):e==='bb'?bar(kind==='back'?[j.sho[0]-2,j.sho[1]-3]:j.han):'')}};
/* ليج بريس */
PAT.leg_press=o=>{const hip=[52,96],tor=-132,sho=PT(hip,tor,40);
  const mk=a=>({hip,tor,arm:{h:[sho[0]+8,sho[1]+20]},b:-1,leg:{f:a},lb:-1,ft:-122});
  const A=[hip[0]+34,hip[1]-24],B=PT(hip,-42,61.6);
  return{A:mk(A),B:mk(B),hl:['th','sh'],eq:j=>{const n=[Math.cos(R(-132)),Math.sin(R(-132))];const p=[j.ank[0]+5,j.ank[1]-4];
    return ln([30,122],[120,40],'fq')+ln([p[0]-14*n[0]*-1,p[1]-14*n[1]*-1],[p[0]+14*n[0]*-1,p[1]+14*n[1]*-1],'fq fw')+ln([hip[0]-6,hip[1]+6],[sho[0]-4,sho[1]-2],'fq fw')+FL()}}};
/* هاك سكوات */
PAT.hack=o=>{const T=[104,121];const mk=(hip)=>{const tor=-108,sho=PT(hip,tor,40);return{hip,tor,arm:{h:[sho[0]+4,sho[1]+38]},b:-1,leg:{f:T},lb:-1,ft:0}};
  return{A:mk([76,95]),B:mk([96,62]),hl:['th','tor'],eq:j=>FL()+ln([54,110],[116,12],'fq fw')+ln([j.sho[0]-2,j.sho[1]-4],[j.hip[0]-2,j.hip[1]+2],'fq fw')}};
/* هينج: روماني / ديدلفت / جود مورنينج */
PAT.hinge=o=>{const e=o.eq||'bb',kind=o.kind||'rdl';
  const mk=(hip,tor)=>{const sho=PT(hip,tor,40);return{hip,tor,arm:kind==='gm'?{h:[sho[0]-2,sho[1]-3]}:{h:[sho[0],sho[1]+45]},b:-1,leg:{f:[100,121]},lb:-1,ft:0}};
  const A=kind==='dl'?mk([72,96],-42):kind==='gm'?mk([78,66],-30):mk([78,66],-30),B=mk([100,60],-90);
  return{A,B,hl:['th','tor'],eq:j=>FL()+(kind==='gm'?bar([j.sho[0]-2,j.sho[1]-3]):eqOf(e,j.han))}};
/* لانج */
PAT.lunge=o=>{const F1=[112,121],R1=o.bulg?[48,100]:[60,119],ft2=o.bulg?60:-20;
  const mk=(hip)=>{const sho=PT(hip,-90,40);return{hip,tor:-90,arm:{h:[sho[0],sho[1]+45]},b:1,leg:{f:F1},lb:-1,ft:0,leg2:{f:R1},lb2:-1,ft2}};
  return{A:mk([86,88]),B:mk([86,60]),hl:['th','sh'],eq:j=>FL()+(o.bulg?rc(30,100,30,5)+ln([38,105],[38,123])+ln([54,105],[54,123]):'')+dbl(j.han)}};
/* فرد الرجل */
PAT.leg_ext=o=>{const hip=[66,96],tor=-100;const base={hip,tor,arm:{h:[PT(hip,tor,40)[0]+16,PT(hip,tor,40)[1]+24]},b:-1};
  return{A:{...base,leg:{k:[0,92]},ft:0},B:{...base,leg:{k:[0,2]},ft:0},hl:['th'],eq:j=>FL()+rc(50,101,40,5)+ln([66,102],[66,123])+ln([j.ank[0]+4,j.ank[1]-7],[j.ank[0]+4,j.ank[1]+7],'fq fw')+ln([PT(hip,tor,40)[0]-8,PT(hip,tor,40)[1]-4],[hip[0]-8,hip[1]],'fq fw')}};
/* ليج كيرل */
PAT.leg_curl=o=>{if(o.seated){const hip=[66,96],tor=-95,sho=PT(hip,tor,40);const base={hip,tor,arm:{h:[sho[0]+16,sho[1]+24]},b:-1,ft:0};
    return{A:{...base,leg:{k:[0,2]}},B:{...base,leg:{k:[0,102]}},hl:['th','sh'],eq:j=>FL()+rc(50,101,40,5)+ln([66,102],[66,123])+ln([hip[0]+6,hip[1]-9],[hip[0]+32,hip[1]-9],'fq fw')}}
  const hip=[104,99],tor=180;const base={hip,tor,arm:{a:[100,100]},b:1,ft:0};
  return{A:{...base,leg:{k:[0,0]}},B:{...base,leg:{k:[0,-104]}},hl:['th','sh'],eq:j=>FL()+rc(54,103,104,5)+ln([66,108],[66,123])+ln([146,108],[146,123])}};
/* هيب ثراست / كوبري */
PAT.hip_thrust=o=>{const e=o.eq||'db',fl=o.floor,sy=fl?119:92;const mk=(hip,tor)=>({hip,tor,arm:{a:[90,90]},b:1,leg:{f:[112,121]},lb:-1,ft:0});
  const sho=[44,sy];const A=fl?[84,119]:[78,sy+20],B=fl?[80,103]:[84,sy];
  const tr=h=>Math.atan2(sho[1]-h[1],sho[0]-h[0])*180/Math.PI;
  return{A:mk(A,tr(A)),B:mk(B,tr(B)),hl:['th','tor'],eq:j=>FL()+(fl?'':rc(22,96,34,5)+ln([30,101],[30,123]))+(e==='bw'?'':dbl([j.hip[0],j.hip[1]-5]))}};
/* سمانة */
PAT.calf=o=>{if(o.seated){const mk=(hy,ay,ft)=>({hip:[70,hy],tor:-95,arm:{h:[84,hy-14]},b:-1,leg:{f:[104,ay]},lb:-1,ft,ftl:13.8});
    return{A:mk(86,121,0),B:mk(78,113,45),hl:['sh'],eq:j=>FL()+rc(104,76,24,5)+rc(64,89,40,4)+ln([104,89],[104,76]).replace('fq','fq fw')}}
  const mk=(hy,ax,ay,ft)=>({hip:[ax,hy],tor:-90,arm:{r:[2,44]},b:1,leg:{f:[ax,ay]},lb:-1,ft,ftl:13.8});
  return{A:mk(60,96.2,121.9,0),B:mk(49,100.5,111.4,46),hl:['sh'],eq:j=>FL()+(o.eq==='db'?dbl(j.han):'')}};
/* بلانك (ثبات) */
PAT.plank=o=>{const T=[152,121],S=[52,96];const d=Math.hypot(T[0]-S[0],T[1]-S[1]),u=[(T[0]-S[0])/d,(T[1]-S[1])/d];
  const hip=[S[0]+u[0]*40,S[1]+u[1]*40],tor=Math.atan2(S[1]-hip[1],S[0]-hip[0])*180/Math.PI;
  const p={hip,tor,arm:{a:[90,0]},b:1,leg:{f:T},lb:-1,ft:0};return{A:p,B:p,hl:['tor'],still:1,eq:()=>FL()}};
/* سيت أب / كرنش */
PAT.situp=o=>{const mk=(tor)=>{const hip=[96,119],sho=PT(hip,tor,40);return{hip,tor,arm:{h:PT(sho,tor+180+25,18)},b:-1,leg:{f:[124,119]},lb:-1,ft:0}};
  return{A:mk(180),B:mk(262),hl:['tor'],eq:()=>FL()}};
/* رفع رجل / ركبة (متدلي) */
PAT.leg_raise=o=>{const H=[100,6],sho=[100,52],hip=[100,92];const base={hip,tor:-90,arm:{h:H},b:1,hdo:0};
  return{A:{...base,leg:{k:[90,92]}},B:{...base,leg:{k:o.knee?[8,100]:[4,4]}},hl:['th'],eq:()=>ln([70,H[1]],[130,H[1]],'fq fw'),view:'0 -8 200 176'}};
PAT.leg_raise_lying=o=>{const hip=[96,119];const base={hip,tor:180,arm:{a:[0,0]},b:1,ft:0};
  return{A:{...base,leg:{k:[-2,-2]}},B:{...base,leg:{k:[-92,-92]}},hl:['th'],eq:()=>FL()}};
/* رفرفة أمامي */
PAT.front_raise=o=>{const hip=[100,60],base={hip,tor:-90,leg:{f:[100,121]},lb:-1,ft:0};
  return{A:{...base,arm:{a:[90,90]}},B:{...base,arm:{a:[2,2]}},hl:['ua'],eq:j=>FL()+dbl(j.han)}};
/* بُل أوفر (دمبل) */
PAT.pullover=o=>{const hip=[84,99],tor=180,sho=PT(hip,tor,40);const base={hip,tor,leg:{f:[112,120]},lb:-1,ft:0,b:1};
  return{A:{...base,arm:{h:[sho[0]-38,sho[1]+26]}},B:{...base,arm:{h:[sho[0]+4,sho[1]-45]}},hl:['tor','ua'],eq:j=>FL()+benchFlat(20,104)+dbl(j.han)}};
/* أمامي: رفرفة جانبي */
PAT.lateral=o=>{const base={sy:34,arm:{a:[90,90]}};return{front:1,A:{...base,arm:{a:[88,84]}},B:{...base,arm:{a:[4,2]}},hl:['ua'],eq:p=>FL()+(o.cable?'':'')+''}};
PAT.fly_front=o=>{const mk=(x,y)=>({sy:34,arm:{h:[x,y],b:o.rev?-1:1}});
  const open=mk(62,34),close=mk(4,50);return{front:1,A:o.rev?close:open,B:o.rev?open:close,hl:['ua','tor'],eq:()=>FL()}};
PAT.shrug=o=>{const mk=sy=>({sy,arm:{a:[90,90]}});return{front:1,A:mk(34),B:mk(27),hl:['tor'],eq:p=>FL()}};
/* كارديو: مشي/جري على السير */
PAT.walk=o=>({loop:1,eq:()=>FL()+ln([20,123],[180,123-(o.inc?12:0)],'fq fw'),hl:['th','sh'],fn:ms=>{
  const T=o.run?640:1100,ph=(ms%T)/T*2*Math.PI,sw=o.run?36:26,hip=[100,60-(o.run?Math.abs(Math.sin(ph))*3:0)];
  const th=90+sw*Math.sin(ph),sh=th+ (o.run?60:34)*Math.max(0,Math.cos(ph)*.9+.1);
  const th2=90-sw*Math.sin(ph),sh2=th2+(o.run?60:34)*Math.max(0,-Math.cos(ph)*.9+.1);
  const tor=-90-(o.inc?10:o.run?6:0);
  return{hip,tor,arm:{a:[90-sw*.9*Math.sin(ph),-10-sw*.5*Math.sin(ph)+60]},b:1,leg:{k:[th,sh]},ft:0}}});
PAT.bike=o=>({loop:1,eq:()=>FL()+ci([98,100],11)+ln([98,100],[60,64],'fq fw')+ln([60,64],[52,56],'fq fw')+ln([98,100],[118,64],'fq fw')+ln([118,64],[134,56],'fq fw')+rc(44,54,16,4),hl:['th','sh'],fn:ms=>{
  const T=1600,ph=(ms%T)/T*2*Math.PI,hip=[72,62],ped=[98+11*Math.cos(ph),100+11*Math.sin(ph)];
  return{hip,tor:-52,arm:{h:[128,58]},b:1,leg:{f:ped},lb:-1,ft:0}}});

/* ============ الخريطة: اسم التمرين → نمط ============ */
const MAP={
"Barbell Bench Press":['press_lying',{}],"Incline Barbell Press":['press_lying',{inc:30}],"Decline Bench Press":['press_lying',{dec:1}],
"Flat Dumbbell Press":['press_lying',{eq:'db'}],"Incline Dumbbell Press":['press_lying',{inc:30,eq:'db'}],"Floor Press":['press_lying',{floor:1,eq:'db'}],
"Smith Machine Bench Press":['press_lying',{smith:1}],"Incline Smith Press":['press_lying',{inc:30,smith:1}],
"Chest Press Machine":['press_machine',{}],
"Push-Up":['pushup',{}],"Incline Push-Up":['pushup',{hand:22}],

"Romanian Deadlift":['hinge',{kind:'rdl',eq:'db'}],
"Barbell Row":['row_hinged',{}],"Seated Row":['row_seated',{}],"Machine Row":['row_seated',{}],
"Lat Pulldown":['pulldown',{}],"Wide-Grip Pulldown":['pulldown',{wide:1}],"Close-Grip Pulldown":['pulldown',{}],"Neutral-Grip Pulldown":['pulldown',{}],

"Overhead Press":['press_vertical',{stand:1}],"DB Shoulder Press":['press_vertical',{eq:'db'}],
"Lateral Raises":['lateral',{}],"Front Raise":['front_raise',{}],
"Barbell Curl":['curl',{eq:'bb'}],"EZ Bar Curl":['curl',{eq:'ez'}],"Reverse Curl":['curl',{eq:'bb'}],"Biceps Curl":['curl',{eq:'db'}],"Hammer Curl":['curl',{eq:'db'}],"Cable Curl":['curl',{eq:'cable'}],
"Skull Crusher":['skull',{}],"Triceps Pushdown":['pushdown',{}],"Rope Pushdown":['pushdown',{}],
"Overhead Triceps Extension (DB)":['overhead_ext',{}],
"Back Squat":['squat',{}],"Front Squat":['squat',{kind:'front'}],"Goblet Squat":['squat',{kind:'goblet'}],"Smith Machine Squat":['squat',{smith:1}],
"Leg Press":['leg_press',{}],"Reverse Lunge":['lunge',{}],"Bulgarian Split Squat":['lunge',{bulg:1}],
"Leg Extension":['leg_ext',{}],"Hip Thrust":['hip_thrust',{}],"Glute Bridge":['hip_thrust',{floor:1,eq:'bw'}],
"Leg Curl":['leg_curl',{}],"Seated Leg Curl":['leg_curl',{seated:1}],
"Seated Calf Raise":['calf',{seated:1}],
"Plank":['plank',{}],"Hanging Knee Raise":['leg_raise',{knee:1}],"Hanging Leg Raise":['leg_raise',{}],"Lying Leg Raise":['leg_raise_lying',{}],
"Incline Treadmill Walk":['walk',{inc:1}],"Treadmill Run":['walk',{run:1}],"Outdoor Walking":['walk',{}],"Stationary Bike":['bike',{}]
};
const CROP={skull:'0 38 200 92',pullover:'0 38 200 92',plank:'0 40 200 90',situp:'0 40 200 90',pushup:'0 44 200 86',leg_raise_lying:'0 50 200 78',hip_thrust:'0 44 200 86'};
const cache={};
function spec(name){if(name in cache)return cache[name];const m=MAP[name];let sp=null;if(m&&PAT[m[0]]){try{sp=PAT[m[0]](m[1]);if(sp&&!sp.view){if(CROP[m[0]]&&!(m[1].hand||m[1].foot))sp.view=CROP[m[0]];else if(m[0]==='press_lying'&&!m[1].inc&&!m[1].dec)sp.view='0 36 200 94'}}catch(e){sp=null}}return cache[name]=sp}
const has=name=>!!spec(name);
const reduce=()=>{try{return matchMedia('(prefers-reduced-motion:reduce)').matches}catch(e){return false}};
function frame(sp,ms){
  if(sp.loop)return draw(sp,sp.fn(ms));
  const p=mix(sp.A,sp.B,sAt(ms));return sp.front?drawFront(sp,p):draw(sp,p)}
function still(sp){
  if(sp.loop)return draw(sp,sp.fn(300));
  const f=sp.front?drawFront:draw;return '<g opacity=".3">'+f(sp,sp.A)+'</g>'+f(sp,sp.B)}
/* svg جاهز: بيتحرّك من الحلقة العامة */
function svg(name,cls){const sp=spec(name);if(!sp)return '';
  return `<svg class="fsv ${cls||''}" data-fig="${String(name).replace(/"/g,'&quot;')}" viewBox="${sp.view||'0 0 200 140'}" aria-hidden="true" focusable="false"><g class="fgx">${reduce()?still(sp):frame(sp,0)}</g></svg>`}
let raf=0,t0=0;
function tick(now){raf=0;if(document.hidden||reduce())return;const els=document.querySelectorAll('svg.fsv[data-fig]');if(!els.length)return;
  raf=requestAnimationFrame(tick);
  if(!t0)t0=now;const ms=now-t0;
  els.forEach(el=>{if(el.getBoundingClientRect().width<2)return;const sp=spec(el.getAttribute('data-fig'));if(!sp)return;const g=el.firstElementChild;if(g)g.innerHTML=frame(sp,ms)})}
function kick(){if(!raf&&!document.hidden&&!reduce())raf=requestAnimationFrame(tick)}
document.addEventListener('visibilitychange',kick);
/* بيتأكد إن الحلقة شغّالة بعد أي إعادة رسم للشاشة */
new MutationObserver(kick).observe(document.documentElement,{childList:true,subtree:true});
window.__SPEC=spec;window.Figs={has,svg,kick,count:()=>Object.keys(MAP).filter(has).length,names:()=>Object.keys(MAP).filter(has)};
window.__PAT=PAT;window.__FIGS_ENGINE={joints,mix,draw,drawFront,sAt,TOT};
})();
