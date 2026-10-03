/* ===================== TIMELINE: state recording, playback, cinema ===================== */
const LF=16,CN=26,DQ=64,MAXREC=20;
const REC={on:false,t:0,frames:[],events:[],spark:[],sfx:[],meta:null,fc:0};
let TAKE=null;
const PLAY={active:false,t:0,dir:1,speed:1,loop:false,paused:true,sparkI:0,sfxI:0,savedLook:null,savedS:null,onEnd:null,busy:false};
const PB={shards:new Map(),c:new Float32Array(CN)};
const RAW={};
['grab','release','impact','bounce','shatter','rebuild','burst'].forEach(n=>{RAW[n]=Snd[n];Snd[n]=a=>{if(REC.on)REC.sfx.push({t:REC.t,n,a});RAW[n](a)}});

function recStart(){
  if(REC.on||PLAY.active)return;
  Object.assign(REC,{on:true,t:0,frames:[],events:[],spark:[],sfx:[],fc:0});
  REC.meta={n:letters.length,aspect:V.aspect,fs:Fx.fs,text:S.text,look:snapshotLook(),pR:Math.max(V.W,V.H)*.9,W:V.W,H:V.H};
  REC.defStart=shardDefs.length;Snd.recStart();syncUI();
}
function recStop(silent){
  if(!REC.on)return;REC.on=false;
  if(REC.frames.length>4){
    TAKE={dur:REC.t,frames:REC.frames,events:REC.events,spark:REC.spark,sfx:REC.sfx,defs:shardDefs.slice(),meta:REC.meta,pIdx:[]};
    TAKE.frames.forEach((f,i)=>{if(f.P)TAKE.pIdx.push(i)});
    if(!silent)toast('Take saved · '+fmtT(TAKE.dur)+'s — press play, or open Cinema');
  }else if(!silent)toast('Take too short — hold RECORD while you perform');
  if(!silent)Snd.recStop();
  syncUI();
}
function captureFrame(){
  const n=letters.length,L=new Float32Array(n*LF);let D=null;
  for(let i=0;i<n;i++){
    const l=letters[i],o=i*LF;
    L[o]=l.fx;L[o+1]=l.fy;L[o+2]=l.fz;L[o+3]=l.frx;L[o+4]=l.fry;L[o+5]=l.frz;L[o+6]=l.fsx;L[o+7]=l.fsy;L[o+8]=l.alpha;L[o+9]=l.dissolve;L[o+10]=l.crack;L[o+11]=l.melt;L[o+12]=l.wob;L[o+13]=l.mat;L[o+14]=(l.hidden||l.broken)?1:0;L[o+15]=S.motion.glitch;
    if(l.defActive){D=D||{};const q=new Int8Array(NODES*NODES*3);for(let k=0;k<q.length;k++)q[k]=clamp(Math.round(l.D[k]*DQ),-127,127);D[i]=q}
  }
  const sh=new Float32Array(shardsLive.length*10);
  shardsLive.forEach((s,i)=>{const o=i*10;sh[o]=s.def.id;sh[o+1]=s.cell;sh[o+2]=s.x;sh[o+3]=s.y;sh[o+4]=s.z;sh[o+5]=s.rx;sh[o+6]=s.ry;sh[o+7]=s.rz;sh[o+8]=s.alpha;sh[o+9]=0});
  const C=new Float32Array(CN),cp=camera.position;
  C[0]=cp.x;C[1]=cp.y;C[2]=cp.z;C[3]=CAM.tx;C[4]=CAM.ty;C[5]=0;C[6]=group.rotation.x;C[7]=group.rotation.y;C[8]=group.rotation.z;C[9]=G.uDepth.value;
  C[10]=LC.x;C[11]=LC.y;C[12]=(S.cursorLight&&PTR.present)?1:0;C[13]=PALIDS.indexOf(S.palette);C[14]=bgMat.uniforms.uAlpha.value;C[15]=S.keyI;C[16]=S.rimI;C[17]=S.ambI;C[18]=postMat.uniforms.uGrain.value;
  C[19]=PTR.x;C[20]=PTR.y;C[21]=PTR.down?1:0;C[22]=sigMat.opacity;C[23]=PTR.present?1:0;C[24]=PT.mode!=='off'?PT.vis:0;C[25]=PT.count;
  let P=null;
  if(REC.fc%2===0&&PT.mode!=='off'&&PT.vis>.01&&PT.count>0){
    const R=REC.meta.pR,n2=PT.count;P=new Uint16Array(n2*2);const p=PT.c.pos;
    for(let i=0;i<n2;i++){P[i*2]=clamp(Math.round((p[i*3]/R*.5+.5)*65535),0,65535);P[i*2+1]=clamp(Math.round((p[i*3+1]/R*.5+.5)*65535),0,65535)}
  }
  REC.fc++;
  REC.frames.push({t:REC.t,L,D,S:sh,C,P});
}
const frameIndex=(fr,t)=>{let lo=0,hi=fr.length-1;while(lo<hi){const m=(lo+hi+1)>>1;if(fr[m].t<=t)lo=m;else hi=m-1}return lo};

async function startPlayback(o){
  o=o||{};
  if(!TAKE||!TAKE.frames.length){toast('Nothing recorded yet — press RECORD and perform');return false}
  if(REC.on)recStop(true);
  if(Reel.running||PLAY.busy)return false;
  PLAY.busy=true;
  const m=TAKE.meta;
  if(!PLAY.active){PLAY.savedLook=snapshotLook();PLAY.savedS={palette:S.palette,keyI:S.keyI,rimI:S.rimI,ambI:S.ambI,depth:S.depth}}
  Seq.clear();Auto.fn=null;GRAB.list=[];PT.morph=null;clearShards();SP.clear();
  const look=Object.assign({},m.look);
  await applyLook(look,{reset:true,fs:m.fs});
  for(const l of letters){l.dissolve=l.dissolveTarget=0}
  PLAY.active=true;PLAY.paused=false;PLAY.dir=o.dir||1;PLAY.t=PLAY.dir>0?0:TAKE.dur;PLAY.onEnd=o.onEnd||null;
  PLAY.speed=o.speed||PLAY.speed||1;if(o.loop!==undefined)PLAY.loop=o.loop;
  PLAY.sparkI=0;PLAY.sfxI=0;PLAY.busy=false;
  CAM.fit=Math.max(1,m.aspect/V.aspect);
  syncUI();return true;
}
async function stopPlayback(){
  if(!PLAY.active)return;
  PLAY.active=false;PLAY.paused=true;
  for(const[k,sm]of PB.shards)releaseShardMesh(sm);PB.shards.clear();
  CAM.fit=1;PT.mode='off';PT.vis=0;PT.visT=0;PT.c.obj.visible=false;SP.clear();
  Object.assign(S,PLAY.savedS||{});PTR.present=false;PTR.down=false;
  resetScene();
  if(PLAY.savedLook)await applyLook(PLAY.savedLook,{reset:true});
  sigMat.opacity=0;Fx.sigOn=false;
  syncUI();
}
function seekTo(t){
  PLAY.t=clamp(t,0,TAKE.dur);SP.clear();
  const sp=TAKE.spark,sf=TAKE.sfx;let i=0;while(i<sp.length&&sp[i].t<PLAY.t)i++;PLAY.sparkI=i;i=0;while(i<sf.length&&sf[i].t<PLAY.t)i++;PLAY.sfxI=i;
}
function playbackStep(dt){
  const T=TAKE;if(!T)return;
  if(!PLAY.paused){
    PLAY.t+=dt*PLAY.speed*PLAY.dir;
    if(PLAY.dir>0&&PLAY.t>=T.dur){
      if(PLAY.loop){PLAY.t=0;PLAY.sparkI=0;PLAY.sfxI=0;SP.clear()}
      else{PLAY.t=T.dur;PLAY.paused=true;const f=PLAY.onEnd;PLAY.onEnd=null;syncUI();if(f)f()}
    }else if(PLAY.dir<0&&PLAY.t<=0){
      if(PLAY.loop)PLAY.t=T.dur;else{PLAY.t=0;PLAY.paused=true;syncUI()}
    }
    if(PLAY.dir>0){
      while(PLAY.sparkI<T.spark.length&&T.spark[PLAY.sparkI].t<=PLAY.t){const s=T.spark[PLAY.sparkI++];SP.burst(s.x,s.y,s.n,s.speed,s.z)}
      while(PLAY.sfxI<T.sfx.length&&T.sfx[PLAY.sfxI].t<=PLAY.t){const s=T.sfx[PLAY.sfxI++];if(RAW[s.n])RAW[s.n](s.a)}
    }
  }
  applyAt(PLAY.t);
}
function applyAt(t){
  const fr=TAKE.frames,ia=frameIndex(fr,t),a=fr[ia],b=fr[Math.min(ia+1,fr.length-1)],u=b!==a?clamp((t-a.t)/(b.t-a.t),0,1):0;
  const n=letters.length;
  if(a.L.length===n*LF){
    const L=a.L,L2=b.L;
    for(let i=0;i<n;i++){
      const l=letters[i],o=i*LF,f=k=>lerp(L[o+k],L2[o+k],u);
      l.fx=f(0);l.fy=f(1);l.fz=f(2);l.frx=f(3);l.fry=f(4);l.frz=f(5);l.fsx=f(6);l.fsy=f(7);l.alpha=f(8);l.dissolve=f(9);l.crack=f(10);l.melt=f(11);l.wob=f(12);
      const m=L[o+13]|0;if(l.mat!==m){l.mat=m;l.refreshMaterial()}
      l.hidden=L[o+14]>.5;l.x=l.fx;l.y=l.fy;l.z=l.fz;l.rz=l.frz;l.rx=l.frx;l.ry=l.fry;l.vx=l.vy=l.wz=0;l.pop=1;l.popT=1;l.dissolveTarget=l.dissolve;
      const da=a.D&&a.D[i],db=b.D&&b.D[i];
      if(da||db){const D=l.D;for(let k=0;k<D.length;k++)D[k]=((da?da[k]:0)*(1-u)+(db?db[k]:0)*u)/DQ;l.uploadDeform();l.defActive=true;l.defAwake=false}
      else if(l.defActive){l.D.fill(0);l.uploadDeform();l.defActive=false}
      l.U.uWobble.value=l.wob;l.U.uGlitch.value=L[o+15];l.pushMesh();
    }
  }
  applyShards(a,b,u);
  applyParticles(t,ia);
  const c=PB.c;for(let k=0;k<CN;k++)c[k]=lerp(a.C[k],b.C[k],u);
  const tx=c[3],ty=c[4],tz=c[5],dx=c[0]-tx,dy=c[1]-ty,dz=c[2]-tz,fit=CAM.fit*CAM.extraDist,ax=CAM.extraAz,ca=Math.cos(ax),sa=Math.sin(ax);
  camera.position.set(tx+(dx*ca+dz*sa)*fit,ty+dy*fit,tz+(-dx*sa+dz*ca)*fit);camera.lookAt(tx,ty,tz);finishCamera();
  group.rotation.set(c[6],c[7],c[8]);G.uDepth.value=c[9];
  const pal=PALIDS[a.C[13]|0];if(pal&&pal!==S.palette){S.palette=pal;applyPalette()}
  S.keyI=c[15];S.rimI=c[16];S.ambI=c[17];updateLights(c[10],c[11],c[12]>.5);
  bgMat.uniforms.uAlpha.value=c[14];sigMat.opacity=c[22];
  PTR.x=c[19];PTR.y=c[20];PTR.down=c[21]>.5;PTR.present=c[23]>.5;
}
function applyShards(a,b,u){
  const S1=a.S,S2=b.S,seen=new Set(),bm=new Map();
  for(let o=0;o<S2.length;o+=10)bm.set(S2[o]*8+S2[o+1],o);
  for(let o=0;o<S1.length;o+=10){
    const id=S1[o],cell=S1[o+1],key=id*8+cell,def=TAKE.defs[id],l=def&&letters[def.letterIdx];if(!l)continue;
    let sm=PB.shards.get(key);if(!sm){sm=acquireShardMesh();bindShard(sm,l,def,cell);PB.shards.set(key,sm)}
    const ob=bm.get(key),B=ob!==undefined?S2:S1,o2=ob!==undefined?ob:o,uu=ob!==undefined?u:0,g=k=>lerp(S1[o+k],B[o2+k],uu);
    sm.mesh.position.set(g(2),g(3),g(4));sm.mesh.rotation.set(g(5),g(6),g(7));sm.mesh.scale.set(1,1,1);syncShardMesh(sm,g(8));seen.add(key);
  }
  for(const[key,sm]of PB.shards)if(!seen.has(key)){releaseShardMesh(sm);PB.shards.delete(key)}
}
function applyParticles(t,ia){
  const fr=TAKE.frames,pIdx=TAKE.pIdx,C=fr[ia].C,vis=C[24],cnt=C[25]|0;
  PT.mode='play';
  if(vis<.01||!pIdx.length||cnt===0){PT.vis=0;PT.c.obj.visible=false;return}
  let lo=0,hi=pIdx.length-1;while(lo<hi){const m=(lo+hi+1)>>1;if(pIdx[m]<=ia)lo=m;else hi=m-1}
  const fa=fr[pIdx[lo]],fb=fr[pIdx[Math.min(lo+1,pIdx.length-1)]];
  if(!fa.P){PT.c.obj.visible=false;return}
  let u=fb!==fa?clamp((t-fa.t)/(fb.t-fa.t),0,1):0;const Pa=fa.P;let Pb=fb.P||Pa;if(Pb.length!==Pa.length){Pb=Pa;u=0}
  const R=TAKE.meta.pR,n=Math.min(Pa.length/2,PT.n),p=PT.c.pos;
  for(let i=0;i<n;i++){
    p[i*3]=((lerp(Pa[i*2],Pb[i*2],u)/65535)-.5)*2*R;p[i*3+1]=((lerp(Pa[i*2+1],Pb[i*2+1],u)/65535)-.5)*2*R;p[i*3+2]=0;
    PT.c.alpha[i]=.75;PT.c.size[i]=.045*(.7+PT.sd[i]*.6);
  }
  PT.c.setCount(n);PT.vis=vis;PT.c.mat.uniforms.uOpacity.value=vis;PT.c.obj.visible=true;PT.c.upload();
}
function tlToggle(){
  if(!TAKE)return;
  if(!PLAY.active){startPlayback({});return}
  if(PLAY.paused&&(PLAY.t>=TAKE.dur-.01&&PLAY.dir>0||PLAY.t<=.01&&PLAY.dir<0)){PLAY.t=PLAY.dir>0?0:TAKE.dur;seekTo(PLAY.t)}
  PLAY.paused=!PLAY.paused;syncUI();
}
function tlReverse(){
  if(!TAKE)return;
  if(!PLAY.active){startPlayback({dir:-1});return}
  PLAY.dir=-1;PLAY.paused=false;SP.clear();syncUI();
}
function tlLoop(){PLAY.loop=!PLAY.loop;syncUI()}
function tlSpeed(){const s=[.25,.5,1,2],i=s.indexOf(PLAY.speed);PLAY.speed=s[(i+1)%s.length];syncUI()}

/* ---- cinema ---- */
const Cin={t:0,dur:10};
async function enterCinema(o){
  o=o||{};if(cinemaOn||Exp.busy)return;
  closePanel();hideResult();cinemaOn=true;document.body.classList.add('cinema');
  try{const d=document.documentElement;if(d.requestFullscreen)d.requestFullscreen().catch(()=>{})}catch(e){}
  Cin.t=0;$('#cinemaBar').classList.remove('on');CAM.goalDist=1;
  const done=()=>$('#cinemaBar').classList.add('on');
  if(o.live){Cin.dur=5;return}
  if(TAKE){Cin.dur=TAKE.dur;const ok=await startPlayback({onEnd:done});if(!ok)exitCinema()}
  else{Cin.dur=10;runReel({keepFrame:true,onEnd:done})}
}
async function exitCinema(){
  if(!cinemaOn)return;cinemaOn=false;
  document.body.classList.remove('cinema');
  try{if(document.fullscreenElement)document.exitFullscreen().catch(()=>{})}catch(e){}
  $('#cinemaBar').classList.remove('on');CAM.extraDist=1;CAM.extraAz=0;
  if(PLAY.active)await stopPlayback();
  if(Reel.running)abortReel();
  document.body.classList.remove('reel');hideResult();
  if(Reel.prev&&!Demo.on){resetScene();relayout({reset:true});Fx.sigOn=false}
  if(PT.mode!=='off'&&!Demo.on){/* keep */}
  layoutViewport();syncUI();
}
document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement&&cinemaOn&&!Exp.busy)exitCinema()});
