/* ===================== MOTION, SEQUENCES, DIRECTORS ===================== */
const Seq={q:[],t:0,
  after(s,fn,tag){this.q.push({at:this.t+s,fn,tag})},
  update(dt){this.t+=dt;for(let i=0;i<this.q.length;){const e=this.q[i];if(e.at<=this.t){this.q.splice(i,1);try{e.fn()}catch(err){console.error(err)}}else i++}},
  clear(tag){this.q=tag?this.q.filter(e=>e.tag!==tag):[]}};
const clone=o=>JSON.parse(JSON.stringify(o));
function logEvent(label){if(REC.on)REC.events.push({t:REC.t,label})}
ParticleText.prototype.impulse=function(x,y,st){
  if(this.mode==='off'||this.vis<.05)return;const R=6*st,p=this.c.pos;
  for(let i=0;i<this.count;i++){const dx=p[i*3]-x,dy=p[i*3+1]-y,d=Math.hypot(dx,dy)+.2;if(d<R){const f=(1-d/R)**2*st*16;this.vx[i]+=dx/d*f;this.vy[i]+=dy/d*f;this.vz[i]+=rr(-1,1)*f*.3}}
};
function centroid(){let x=0,y=0;const n=letters.length||1;for(const l of letters){x+=l.x;y+=l.y}Fx.cx=x/n;Fx.cy=y/n;return[Fx.cx,Fx.cy]}
function physicsGuard(){if(['gravity','magnet','orbit'].includes(S.physics))setPhysics('still')}
function setPhysics(id){S.physics=id;Fx.wx=Fx.wy=0;logEvent('PHYSICS '+id.toUpperCase());syncUI()}
function setTool(id){S.tool=id;if(id!=='grab')RANGE.active=false;syncUI()}

/* ---- persistent kinetic overlays + hero bend ---- */
function applyOverlays(t,dt){
  const M=S.motion,calm=S.calm?.5:1;
  for(let i=0;i<letters.length;i++){
    const l=letters[i];
    if(l.flipT===undefined){l.flipT=1;l.flipD=0;l.flipBase=0}
    l.ox=l.oy=l.oz=l.orz=l.orx=l.ory=0;l.osx=l.osy=1;const u=l.fs*.2*calm;
    if(M.wave){const w=Math.sin(t*4-i*.55);l.oy+=w*u*M.wave;l.orz+=w*.12*M.wave*calm;l.oz+=Math.cos(t*4-i*.55)*u*.5*M.wave}
    if(M.bounce){const b=Math.abs(Math.sin(t*3.2+i*1.3));l.oy+=b*u*1.4*M.bounce;l.osy*=1+(1-b)*.12*M.bounce;l.osx*=1-(1-b)*.06*M.bounce}
    if(M.spin&&!S.calm)l.orz+=t*(1.2+(i%3)*.7)*(i%2?1:-1)*M.spin;
    if(M.stretch){const d=Math.hypot(l.x-PTR.x,l.y-PTR.y),f=Math.exp(-d*.35);l.osx*=1+Math.min(1.2,Math.abs(PTR.vx)*.035*f)*M.stretch;l.osy*=1+Math.min(1.2,Math.abs(PTR.vy)*.035*f)*M.stretch}
    if(l.flipT<1){if(l.flipD>0)l.flipD-=dt;else l.flipT=Math.min(1,l.flipT+dt/1.0)}
    const fe=EASE.io(l.flipT);l.ory+=l.flipBase+fe*TAU;l.oz+=Math.sin(fe*Math.PI)*l.fs*.35;
    if(M.melt){l.meltTarget=.5+.35*Math.sin(t*.5+i*.9)*calm;l.mm=true}else if(l.mm){l.meltTarget=0;l.mm=false}
    if(l.grabbed){const sp=Math.hypot(l.vx,l.vy);l.osx*=1.07+Math.min(.12,sp*.004);l.osy*=1.07-Math.min(.05,sp*.002)}
    else if(PTR.present&&!PTR.down&&(S.physics==='still'||S.physics==='repulse')&&!Fx.phase){
      const dx=l.x-PTR.x,dy=l.y-PTR.y,d=Math.hypot(dx,dy);
      if(d<2.6&&PTR.speed>1){const f=(1-d/2.6)*Math.min(1,PTR.speed/12);l.orz+=clamp(PTR.vx*.006,-.2,.2)*f*(Fx.hero?1.6:.6);l.sqv+=f*PTR.speed*dt*(Fx.hero?7:2);l.sqx=Math.abs(dy)>Math.abs(dx)?-1:1}
    }
  }
  if(Fx.hero&&PTR.present&&PTR.speed>1&&!Auto.fn)heroBend(dt);
}
function heroBend(dt){
  const R=2.6+PTR.speed*.05,gain=.6+Math.min(PTR.speed/25,1.4);
  for(const l of letters){
    const dx=PTR.x-l.fx,dy=PTR.y-l.fy;if(dx*dx+dy*dy>(R+l.rad)**2)continue;
    const c=Math.cos(l.frz),s=Math.sin(l.frz);l.rebuildBoost=.16;
    l.sculpting=false;l.sculpt('push',(dx*c+dy*s)/l.fsx,(-dx*s+dy*c)/l.fsy,PTR.vx*c+PTR.vy*s,-PTR.vx*s+PTR.vy*c,R,dt,gain*.9,-s,-c);
  }
}

/* ---- kinetic presets ---- */
function toggleMotion(id){
  if(cinemaOn||PLAY.active||Reel.running)return;
  if(id==='explode')return explode();
  if(id==='rebuild')return scatterRebuild();
  if(id==='shatter')return shatterAll();
  if(id==='flip')return flipAll();
  physicsGuard();S.motion[id]=S.motion[id]?0:1;Snd.tick();logEvent(id.toUpperCase()+(S.motion[id]?' ON':' OFF'));syncUI();
}
function explode(power){
  power=power||13;physicsGuard();Fx.springBoost=.22;const[cx,cy]=centroid();
  for(const l of letters){if(l.broken)continue;const dx=l.x-cx+rr(-.6,.6),dy=l.y-cy+rr(-.6,.6),d=Math.hypot(dx,dy)+.3;
    l.vx+=dx/d*power*rr(.7,1.3);l.vy+=dy/d*power*rr(.7,1.3)+3;l.wz+=rr(-9,9)*(S.calm?.3:1);l.sqv+=l.mp.soft?8:2}
  CAM.shake+=.8;Snd.impact(1.6);SP.burst(cx,cy,60,9);SP.ring(cx,cy,1.4);logEvent('EXPLODE');
}
function scatterRebuild(){
  if(Fx.breaking||Fx.rebuilding||Fx.phase)return;physicsGuard();
  for(const l of letters){l.vx+=rr(-14,14);l.vy+=rr(-10,12);l.wz+=rr(-8,8)}
  Fx.phase='free';Snd.impact(1);logEvent('REBUILD');
  Seq.after(1.0,()=>{Fx.phase='rebuild';Fx.springBoost=1;letters.forEach((l,i)=>l.rbAt=Fx.clock+i*.07);Snd.rebuild()},'sr');
  Seq.after(2.8,()=>{if(Fx.phase==='rebuild')Fx.phase=null},'sr');
}
function shatterAll(){
  physicsGuard();letters.forEach((l,i)=>breakLetter(l,l.x+rr(-.5,.5),l.y-.5,6,2.4+i*.05));CAM.shake+=.6;logEvent('SHATTER');
}
function flipAll(){letters.forEach((l,i)=>{if(l.flipT===undefined){l.flipT=1;l.flipD=0;l.flipBase=0}l.flipBase+=TAU;l.flipT=0;l.flipD=i*.08});Snd.tick();logEvent('FLIP')}

/* ---- BREAK -> PARTICLES -> REBUILD ---- */
function breakAll(){
  if(Fx.breaking||PLAY.active||cinemaOn&&!Reel.running&&!Demo.on)return;
  if(PT.mode!=='off'&&Fx.broken)return;
  Fx.breaking=true;Fx.broken=true;Fx.rebuilding=false;Seq.clear('brk');Seq.clear('rb');
  const[cx,cy]=centroid();Fx.phase='sep';logEvent('BREAK');Snd.tone&&Snd.impact(.5);CAM.goalDist=Math.min(CAM.goalDist,.92);
  const k=S.calm?.6:1;
  Seq.after(.55*k,()=>{Fx.phase='float'},'brk');
  Seq.after(1.1*k,()=>{
    Fx.phase='free';
    for(const l of letters){const dx=l.x-cx,dy=l.y-cy,d=Math.hypot(dx,dy)+.3;l.vx+=dx/d*rr(6,12);l.vy+=dy/d*rr(6,12)+2;l.wz+=rr(-7,7)}
    PT.enter();PT.explode(S.calm?5:9,cx,cy);SP.burst(cx,cy,60,10);SP.ring(cx,cy,1.6);CAM.shake+=.9;Snd.impact(1.8);Snd.shatter();
  },'brk');
  Seq.after(1.6*k,()=>{Fx.breaking=false},'brk');
}
function rebuildAll(){
  if(PLAY.active||Fx.rebuilding)return;
  for(const l of letters){if(l.broken)rebuildLetter(l);l.restore();l.sq=0;l.grabbed=false}
  GRAB.list=[];
  if(PT.mode==='off'){if(Fx.broken||Fx.phase){Fx.phase=null;Fx.broken=false}Snd.rebuild();logEvent('REBUILD');return}
  Fx.rebuilding=true;Fx.breaking=false;Seq.clear('brk');Fx.phase='rebuild';Fx.springBoost=1;
  letters.forEach((l,i)=>{l.rbAt=Fx.clock+i*.06});
  PT.onRebuilt=()=>{Fx.phase=null;Fx.broken=false;Fx.rebuilding=false;Fx.breaking=false;SP.ring(0,0,1.4)};
  PT.rebuild();logEvent('REBUILD');
  Seq.after(5.5,()=>{if(Fx.rebuilding){Fx.phase=null;Fx.rebuilding=false;Fx.broken=false}},'rb');
}
function toggleParticles(){
  if(PT.mode==='off'){physicsGuardParticles();PT.enter();logEvent('PARTICLES ON')}else{rebuildAll();logEvent('PARTICLES OFF')}
  syncUI();
}
function physicsGuardParticles(){if(S.physics==='gravity'||S.physics==='orbit'||S.physics==='magnet')setPhysics('still')}

/* ---- morph between words (particle correspondence) ---- */
async function morphWords(a,b){
  if(Fx.breaking||Fx.rebuilding||PLAY.active||!a||!b||PT.morph)return;
  const f=FONT[S.font],w=effWeight(f,S.weight);await ensureFont(f,w);
  setText(a,{reset:true});resetScene();await new Promise(r=>setTimeout(r,60));
  const lay=layoutText(b,S,V,layoutOffY);
  logEvent('MORPH');
  PT.startMorph(lay.slots,lay.fs,S.calm?1.6:2.6,B=>{
    S.text=b;relayout({reset:true});
    for(const l of letters){l.dissolve=l.dissolveTarget=1}
    PT.build();
    const n=PT.count;
    for(let i=0;i<n;i++){const q=B[i];PT.li[i]=Math.min(q.li,letters.length-1);PT.tx[i]=q.lx;PT.ty[i]=q.ly;PT.tz[i]=rr(-.3,.3)}
    PT.mode='home';PT.frozen=false;
    Seq.after(.5,()=>{for(const l of letters){l.dissolveRate=1.2;l.dissolveTarget=0}},'mo');
    Seq.after(1.6,()=>{PT.visT=0;Seq.after(1.2,()=>{if(PT.mode==='home'&&!Fx.breaking){PT.finishExit()}},'mo')},'mo');
    Snd.rebuild();
    if($('#textIn'))$('#textIn').value=b;
  });
  Snd.burst();
}

/* ---- camera actions ---- */
const camPush=()=>{CAM.goalDist=.66;CAM.goalTx=CAM.goalTy=0;logEvent('PUSH IN')};
const camPull=()=>{CAM.goalDist=1.35;CAM.goalTx=CAM.goalTy=0;logEvent('PULL OUT')};
const camReset=()=>{CAM.goalDist=1;CAM.goalTx=CAM.goalTy=0;CAM.extraAz=0};
function camFocus(){
  const l=SEL.size?letters[[...SEL][0]]:(hover||letters[0]);if(!l)return;
  CAM.goalTx=l.x;CAM.goalTy=l.y;CAM.goalDist=.46;logEvent('FOCUS');
}
const camShake=()=>{CAM.shake+=1.2;Snd.impact(.8)};

/* ---- look (serialisable) ---- */
function snapshotLook(){const o={};for(const k of SAVE_KEYS)o[k]=typeof S[k]==='object'?clone(S[k]):S[k];o.mats=letters.map(l=>l.mat);return o}
const DEFAULT_LOOK=(()=>{const o={};for(const k of SAVE_KEYS)o[k]=typeof S[k]==='object'?clone(S[k]):S[k];return o})();
async function applyLook(look,opts){
  opts=opts||{};
  for(const k of SAVE_KEYS)if(k in look)S[k]=typeof look[k]==='object'?clone(look[k]):look[k];
  if(look.motion)S.motion=Object.assign({wave:0,bounce:0,spin:0,stretch:0,melt:0,glitch:0},look.motion);
  const f=FONT[S.font];await ensureFont(f,effWeight(f,S.weight));
  relayout(opts);
  const idx=Math.max(0,MATS.indexOf(S.material));
  letters.forEach((l,i)=>{l.mat=(look.mats&&look.mats.length===letters.length)?look.mats[i]:idx});
  if(look.frame!==undefined)layoutViewport();
  applyPalette();G.uDepth.value=Math.max(.05,S.depth*(Fx.fs||1)*.6);
  syncUI();
}
function setMaterial(id){
  const idx=MATS.indexOf(id);if(idx<0)return;
  if(!SEL.size||S.select==='all')S.material=id;
  for(const l of selArr()){l.mat=idx;l.refreshMaterial()}
  if(!SEL.size||S.select==='all')letters.forEach(l=>{l.mat=idx;l.refreshMaterial()});
  Snd.tick();logEvent('MATERIAL '+id.toUpperCase());syncUI();
}
function setPalette(id){S.palette=id;applyPalette();Snd.tick();logEvent('COLOR '+id.toUpperCase());syncUI()}

const TPRESETS=[
 ['editorial','Editorial',{font:'playfair',weight:500,tracking:-.02,size:1,material:'paper',palette:'paper',physics:'float',camMode:'drift',depth:.15}],
 ['bold','Bold',{font:'archivo',weight:400,tracking:.0,size:1.25,material:'rubber',palette:'electric',physics:'still',camMode:'drift',depth:.5,motion:{bounce:1}}],
 ['minimal','Minimal',{font:'manrope',weight:300,tracking:.12,size:.8,material:'glass',palette:'mono',physics:'float',camMode:'drift',depth:.25}],
 ['future','Future',{font:'unbounded',weight:300,tracking:.1,size:.9,material:'neon',palette:'void',physics:'still',camMode:'orbit',depth:.3,motion:{wave:1}}],
 ['organic','Organic',{font:'fraunces',weight:800,tracking:0,size:1,material:'liquid',palette:'sunset',physics:'float',camMode:'drift',depth:.4,motion:{melt:1}}],
 ['glitch','Glitch',{font:'spacemono',weight:700,tracking:.02,size:1,material:'pixel',palette:'electric',physics:'chaos',camMode:'still',depth:.35,motion:{glitch:1}}],
 ['cinematic','Cinematic',{font:'bebas',weight:400,tracking:.18,size:1.1,material:'chrome',palette:'void',physics:'still',camMode:'orbit',depth:.45}],
 ['playful','Playful',{font:'bungee',weight:400,tracking:.03,size:1.05,material:'rubber',palette:'sunset',physics:'still',camMode:'follow',depth:.45,motion:{bounce:1}}],
];
const CURATED=[
 {font:'anton',weight:400,material:'chrome',palette:'void',physics:'still',tracking:.05,camMode:'orbit',fx:'explode'},
 {font:'unbounded',weight:900,material:'liquid',palette:'sunset',physics:'float',tracking:0,motion:{melt:1},camMode:'drift'},
 {font:'playfair',weight:700,material:'glass',palette:'ice',physics:'float',tracking:.04,motion:{wave:1},camMode:'follow'},
 {font:'archivo',weight:400,material:'rubber',palette:'electric',physics:'gravity',tracking:.02,camMode:'drift',fx:'explode'},
 {font:'bebas',weight:400,material:'neon',palette:'electric',physics:'still',tracking:.2,motion:{wave:1},camMode:'orbit'},
 {font:'fraunces',weight:800,material:'paper',palette:'paper',physics:'wind',tracking:-.01,camMode:'drift'},
 {font:'spacemono',weight:700,material:'pixel',palette:'void',physics:'chaos',motion:{glitch:1},camMode:'still'},
 {font:'syne',weight:800,material:'ice',palette:'ice',physics:'still',camMode:'orbit',fx:'shatter'},
 {font:'bungee',weight:400,material:'rubber',palette:'sunset',physics:'still',motion:{bounce:1},camMode:'follow'},
 {font:'climate',weight:400,material:'liquid',palette:'mono',physics:'float',motion:{melt:1},camMode:'drift'},
 {font:'dmserif',weight:400,material:'smoke',palette:'chrome',physics:'wind',camMode:'drift'},
 {font:'rubikmono',weight:400,material:'chrome',palette:'chrome',physics:'still',motion:{wave:1},camMode:'orbit',fx:'flip'},
];
let lastCur=-1;
async function applyPreset(p){
  const base={motion:{wave:0,bounce:0,spin:0,stretch:0,melt:0,glitch:0}};
  resetScene();await applyLook(Object.assign(base,p),{});Snd.tick();
}
async function surprise(){
  if(PLAY.active||Reel.running)return;
  let i;do{i=(Math.random()*CURATED.length)|0}while(i===lastCur);lastCur=i;
  const p=CURATED[i];await applyPreset(p);
  Seq.after(.5,()=>{if(p.fx==='explode')explode(11);else if(p.fx==='shatter')shatterAll();else if(p.fx==='flip')flipAll();else letters.forEach((l,k)=>l.spawn(k*.05))});
  logEvent('SURPRISE');toast('Surprise: '+FONT[p.font].name+' / '+MATNAME[p.material]);
}

/* ---- reset ---- */
function resetScene(){
  Seq.clear();clearShards();PT.mode='off';PT.visT=0;PT.vis=0;PT.morph=null;PT.frozen=false;PT.c.obj.visible=false;S.pmode=false;
  Fx.phase=null;Fx.breaking=false;Fx.broken=false;Fx.rebuilding=false;Fx.springBoost=1;GRAB.list=[];SP.clear();
  for(const l of letters){
    l.dissolve=l.dissolveTarget=0;l.hidden=false;l.broken=false;l.shards=0;l.D.fill(0);l.DV.fill(0);l.defActive=false;l.defAwake=false;l.uploadDeform();
    l.melt=l.meltTarget=0;l.crack=0;l.sq=l.sqv=0;l.vx=l.vy=l.wz=0;l.x=l.homeX;l.y=l.homeY;l.rz=0;l.z=0;l.rx=l.ry=0;l.alpha=1;l.grabbed=false;
  }
  CAM.goalDist=1;CAM.goalTx=CAM.goalTy=0;CAM.extraAz=0;CAM.extraDist=1;
}

/* ---- REEL: auto-directed 10s title sequence ---- */
const Reel={running:false,variant:null};
const REEL_DEFAULT={phys:'gravity',ptool:'swirl',cam:'drift',j:1,vortex:true,flip:false,power:10};
const randomVariant=()=>({phys:pick(['gravity','float','chaos','wind']),ptool:pick(['swirl','attract','repel']),cam:pick(['drift','orbit','follow']),j:rr(.88,1.12),vortex:Math.random()<.65,flip:Math.random()<.4,power:rr(8,14)});
function runReel(o){
  o=o||{};if(Reel.running||PLAY.active)return;
  const dur=o.dur||10,k=dur/10,v=o.variant||REEL_DEFAULT;Reel.running=true;Reel.variant=v;
  closePanel();document.body.classList.add('reel');
  Demo.abort();Auto.fn=null;
  const prev={frame:S.frame,cam:S.camMode,phys:S.physics};Reel.prev=prev;
  if(!o.forExport&&!o.keepFrame&&!S.frame){S.frame=9/16}
  layoutViewport();
  resetScene();S.physics='still';S.camMode=v.cam;
  relayout({reset:true});
  letters.forEach((l,i)=>l.spawn(.15+i*.07));CAM.dist=1.3;CAM.goalDist=1;Fx.sigOn=false;
  syncUI();hideResult();
  if(!o.noRecord)recStart();
  const T=(s,fn)=>Seq.after(s*k*v.j,fn,'reel');
  T(1.0,()=>{S.physics=v.phys;for(const l of letters){l.vx+=rr(-3,3);l.vy+=rr(1,6);l.wz+=rr(-2,2)}CAM.goalDist=.9;logEvent('PHYSICS')});
  if(v.flip)T(2.2,()=>flipAll());
  T(3.0,()=>{S.physics='still';breakAll()});
  T(5.0,()=>{
    S.ptool=v.ptool;
    Auto.t=0;Auto.fn=t=>({x:Math.cos(t*2.2)*3.2*(V.W/17.8+.35),y:Math.sin(t*(v.ptool==='swirl'?2.2:2.9))*2.4*(V.H/10),down:v.ptool!=='repel'&&Math.sin(t*3)>0});
    if(v.vortex)PT.vortex(0,0,1.3);
  });
  T(6.9,()=>{Auto.fn=null;PTR.present=false;PTR.down=false});
  T(7.0,()=>{rebuildAll();CAM.goalDist=.95});
  T(9.0,()=>{CAM.goalDist=.82;Fx.sigOn=true});
  Seq.after(dur,()=>{
    Reel.running=false;if(!o.noRecord)recStop();
    S.camMode=prev.cam;
    if(!o.forExport&&!cinemaOn){document.body.classList.remove('reel');showResult()}
    if(o.onEnd)o.onEnd();
  },'reel');
}
function abortReel(){
  if(!Reel.running)return;Seq.clear('reel');Reel.running=false;Auto.fn=null;if(REC.on)recStop();document.body.classList.remove('reel');
}
const resultEl=$('#result');
function showResult(){resultEl.classList.add('on')}
function hideResult(){resultEl.classList.remove('on')}
function leaveReelFrame(){
  hideResult();document.body.classList.remove('reel');
  if(Reel.prev){S.frame=Reel.prev.frame;S.physics=Reel.prev.phys}
  layoutViewport();relayout({reset:true});resetScene();Fx.sigOn=false;syncUI();
}
async function remix(){
  if(!letters.length)return;
  let i;do{i=(Math.random()*CURATED.length)|0}while(i===lastCur);lastCur=i;
  const c=Object.assign({},CURATED[i]);delete c.fx;delete c.physics;
  await applyPreset(c);
  runReel({variant:randomVariant(),keepFrame:true});
}

/* ---- DEMO ("watch demo") ---- */
const Demo={on:false,abort(){if(!this.on)return;this.on=false;Seq.clear('demo');Auto.fn=null;$('#demoCap').classList.remove('on');if(cinemaOn)exitCinema()}};
function cap(t){const e=$('#demoCap');if(t){e.textContent=t;e.classList.add('on')}else e.classList.remove('on')}
async function runDemo(){
  if(Demo.on)return;Snd.init();Demo.on=true;
  await enterStudio({text:'TEJA PRIYAN',demo:true});
  const T=(s,fn)=>Seq.after(s,()=>{if(Demo.on)fn()},'demo');
  T(.6,()=>cap('Type anything. Every letter is an object.'));
  T(3.0,()=>{setMaterial('chrome');cap('Pick a material. Chrome.')});
  T(5.0,()=>{setPhysics('gravity');cap('Add gravity. Letters fall and bounce.')});
  T(8.6,()=>{const l=letters[0];if(l){l.vx=17;l.vy=13;l.wz=-9;l.grabbed=false}cap('Grab a letter. Throw it.')});
  T(11.6,()=>{setMaterial('liquid');cap('Switch to liquid. Same letters, new behaviour.')});
  T(13.4,()=>{setPhysics('still');setTool('push');cap('Sculpt with the cursor.');
    Auto.t=0;Auto.fn=t=>({x:-V.W*.32+Math.min(t/3,1)*V.W*.64,y:Math.sin(t*3)*.7,down:t<3.3})});
  T(17.2,()=>{Auto.fn=null;PTR.present=false;PTR.down=false;setTool('grab');cap('Break it.');breakAll()});
  T(20.8,()=>{cap('Rebuild it.');rebuildAll()});
  T(24.6,()=>{cap('Then play it back in cinema.');enterCinema({live:true})});
  T(29.6,()=>{exitCinema();cap('Your turn. Grab a letter.')});
  T(32.5,()=>{cap('');Demo.on=false});
}
