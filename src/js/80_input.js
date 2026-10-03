/* ===================== SYSTEMS, LAYOUT, INPUT, TOOLS, HUD ===================== */
let SP,DU,PT,mode='landing',layoutOffY=0,cinemaOn=false;
const SCULPT=new Set(['push','pull','twist','inflate','pinch','melt']);
function initSystems(){
  const q=Q[S.quality];
  if(PT){group.remove(PT.c.obj);group.remove(SP.c.obj);group.remove(DU.c.obj);CLOUDS.length=0}
  DU=new Dust(S.quality==='performance'?120:260);SP=new Sparks(S.quality==='performance'?900:2200);PT=new ParticleText(q.parts);
  group.add(DU.c.obj);group.add(PT.c.obj);group.add(SP.c.obj);
  for(const c of CLOUDS)paintCloud(c);
}
const selArr=()=>SEL.size?[...SEL].map(i=>letters[i]).filter(Boolean):letters.slice();
function syncSel(){if(S.select==='all'){SEL.clear();letters.forEach(l=>SEL.add(l.idx))}else if(S.select==='single'&&SEL.size>1){const f=[...SEL][0];SEL.clear();SEL.add(f)}}

function relayout(o){
  o=o||{};updateBounds();
  const lay=layoutText(S.text,S,V,layoutOffY),n=lay.slots.length;
  if(o.fs){const sc=o.fs/lay.fs;lay.slots.forEach(sl=>{sl.x*=sc;sl.y*=sc});lay.fs=o.fs}
  G.uDepth.value=Math.max(.05,S.depth*lay.fs*.6);
  const pm=PT&&PT.mode!=='off';
  while(letters.length<n){const l=new Letter(letters.length);l.isNew=true;letters.push(l)}
  while(letters.length>n){const l=letters.pop();SEL.delete(l.idx);l.dispose()}
  lay.slots.forEach((sl,i)=>{
    const l=letters[i];l.setGlyph(sl.g,lay.fs,sl.x,sl.y);
    if(l.isNew||o.reset){l.x=sl.x;l.y=sl.y+(o.spawn?rr(.6,2.4):0);l.vx=l.vy=0;l.rz=l.wz=0;l.z=0;if(o.spawn||l.isNew)l.spawn(i*.04);l.dissolve=l.dissolveTarget=pm?1:0;l.isNew=false}
  });
  if(pm&&!(PT.morph)&&PT.mode!=='morph')PT.build();
  if(S.select==='all')syncSel();
  if(!(PT&&PT.morph))pruneGlyphs(new Set(letters.map(l=>l.g)));
  Fx.fs=lay.fs;
}
function setText(str,o){S.text=str;relayout(o)}
let fontTimer=0;
async function refont(o){
  const f=FONT[S.font],w=effWeight(f,S.weight);await ensureFont(f,w);relayout(o);
}
if(document.fonts&&document.fonts.addEventListener)document.fonts.addEventListener('loadingdone',()=>{clearTimeout(fontTimer);fontTimer=setTimeout(()=>{clearGlyphs();relayout()},250)});

/* ---- pointer ---- */
const ptrs=new Map();let pinch=null,orbit=null,hover=null,lpTimer=0,lastTap={t:0,x:0,y:0};
const RANGE={active:false,anchor:-1};let selKeep=false;
const Auto={fn:null,t:0};
function hitLetter(px,py,pad){
  let best=null,bd=1e9;
  for(const l of letters){
    if(l.hidden||l.broken||l.dissolve>.6||!l.g)continue;
    const dx=px-l.fx,dy=py-l.fy,c=Math.cos(l.frz),s=Math.sin(l.frz),lx=dx*c+dy*s,ly=-dx*s+dy*c;
    if(Math.abs(lx)<=l.hx*1.1+pad&&Math.abs(ly)<=l.hy*1.1+pad){const d=dx*dx+dy*dy;if(d<bd){bd=d;best=l}}
  }
  return best;
}
function setPtr(e){
  const r=canvas.getBoundingClientRect();PTR.sx=e.clientX;PTR.sy=e.clientY;PTR.present=true;
  PTR.inside=e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom;
}
function updatePointer(dt){
  if(Auto.fn){
    Auto.t+=dt;const r=Auto.fn(Auto.t);PTR.x=r.x;PTR.y=r.y;PTR.down=!!r.down;PTR.present=true;PTR.nx=PTR.x/(V.W/2);PTR.ny=PTR.y/(V.H/2);
  }else if(PTR.present){const p=screenToLocal(PTR.sx,PTR.sy,0);PTR.x=p.x;PTR.y=p.y;PTR.nx=p.nx;PTR.ny=p.ny}
  const k=1-Math.exp(-dt*14),d=Math.max(dt,1e-3);
  if(PTR.present){PTR.vx+=((PTR.x-PTR.px)/d-PTR.vx)*k;PTR.vy+=((PTR.y-PTR.py)/d-PTR.vy)*k}else{PTR.vx*=.9;PTR.vy*=.9}
  PTR.vx=clamp(PTR.vx,-90,90);PTR.vy=clamp(PTR.vy,-90,90);
  PTR.speed=Math.hypot(PTR.vx,PTR.vy);PTR.px=PTR.x;PTR.py=PTR.y;
  hover=(PTR.present&&!PTR.down&&!Auto.fn)?hitLetter(PTR.x,PTR.y,isTouch?.3:.05):null;
}
function beginGrab(hit,px,py){
  GRAB.list=[];let arr=[hit],group=false;
  if(S.select==='all'){arr=letters.filter(l=>!l.broken&&!l.hidden);group=true}
  else if(S.select==='range'&&SEL.has(hit.idx)&&SEL.size>1){arr=[...SEL].map(i=>letters[i]).filter(l=>l&&!l.broken);group=true}
  GRAB.group=group;
  for(const l of arr){
    const dx=px-l.x,dy=py-l.y,c=Math.cos(l.rz),s=Math.sin(l.rz);
    GRAB.list.push({l,gx:dx*c+dy*s,gy:-dx*s+dy*c,ox:l.x-px,oy:l.y-py});l.grabbed=true;
  }
  for(const o of letters){if(o.grabbed)continue;const dx=o.x-hit.x,dy=o.y-hit.y,d=Math.hypot(dx,dy)+.3;if(d<3.2){o.vx+=dx/d*1.4;o.vy+=dy/d*1.4}}
  Snd.grab();SP.burst(px,py,9,3.5);
}
function endGrab(){
  if(!GRAB.list.length)return;
  for(const gi of GRAB.list){const l=gi.l;l.grabbed=false;l.vx=lerp(l.vx,PTR.vx,.6);l.vy=lerp(l.vy,PTR.vy,.6)}
  Snd.release(PTR.speed);GRAB.list=[];
}
function toolAtPoint(dt){
  const R=S.brush;
  if(S.tool==='cut'){
    for(const l of brushTargets()){
      if(l.broken||l.hidden)continue;const dx=PTR.x-l.fx,dy=PTR.y-l.fy;
      if(Math.hypot(dx,dy)<R+l.rad*.6){const c=Math.cos(l.frz),s=Math.sin(l.frz);breakLetter(l,PTR.x,PTR.y,3+PTR.speed*.25,3.4,[dx*c+dy*s,-dx*s+dy*c]);logEvent('CUT')}
    }
  }else if(S.tool==='rebuild'){
    for(const l of brushTargets()){
      const dx=PTR.x-l.fx,dy=PTR.y-l.fy;
      if(Math.hypot(dx,dy)<R+l.rad*.8&&(l.broken||l.defActive||l.crack>0||l.meltTarget>0)){rebuildLetter(l);l.sq=0}
    }
  }
}
function brushTargets(){if(S.select==='all')return letters;return SEL.size?[...SEL].map(i=>letters[i]).filter(Boolean):letters}
function applySculpt(dt){
  for(const l of letters)l.sculpting=false;
  if(!PTR.down||PLAY.active)return;
  if(SCULPT.has(S.tool)){
    const R=S.brush*(S.calm?.7:1),gain=(.7+Math.min(PTR.speed/15,1.3))*(S.calm?.6:1);
    for(const l of brushTargets()){
      if(l.broken||l.hidden||l.dissolve>.6)continue;
      const dx=PTR.x-l.fx,dy=PTR.y-l.fy;if(dx*dx+dy*dy>(R+l.rad*1.6)**2)continue;
      const c=Math.cos(l.frz),s=Math.sin(l.frz);
      l.sculpting=true;l.sculpt(S.tool,(dx*c+dy*s)/l.fsx,(-dx*s+dy*c)/l.fsy,PTR.vx*c+PTR.vy*s,-PTR.vx*s+PTR.vy*c,R,dt,gain,-s,-c);
    }
    if(Math.random()<.25*PTR.speed*dt+.02)SP.burst(PTR.x,PTR.y,1,2);
  }else if(S.tool==='cut'||S.tool==='rebuild')toolAtPoint(dt);
}
function onDown(e){
  const p=screenToLocal(e.clientX,e.clientY,0);PTR.x=p.x;PTR.y=p.y;PTR.px=p.x;PTR.py=p.y;PTR.down=true;PTR.downSpeed=PTR.speed;
  const hit=(PT.mode==='home'||PT.mode==='free'||PT.mode==='rebuild')&&PT.vis>.3?null:hitLetter(p.x,p.y,e.pointerType==='touch'?.35:.08);
  const now=performance.now(),dbl=now-lastTap.t<320&&Math.hypot(e.clientX-lastTap.x,e.clientY-lastTap.y)<34;lastTap={t:now,x:e.clientX,y:e.clientY};
  if(dbl){doImpact(p.x,p.y,1.4+Math.min(PTR.speed/20,1.2));PT.impulse(p.x,p.y,1.4);return}
  const tool=S.tool;
  if(PT.mode!=='off'&&S.ptool==='vortex'){PT.vortex(p.x,p.y,1);Snd.tick()}
  if(S.select==='range'&&tool==='grab'&&hit&&!SEL.has(hit.idx)){RANGE.active=true;RANGE.anchor=hit.idx;SEL.clear();SEL.add(hit.idx);Snd.tick();return}
  if(hit&&S.select!=='all'&&!(S.select==='range'&&SEL.has(hit.idx))){selKeep=false;SEL.clear();SEL.add(hit.idx)}
  else if(!hit&&S.select!=='all'&&S.select!=='range')SEL.clear();
  if(tool==='grab'){
    if(hit)beginGrab(hit,p.x,p.y);
    else{const st=1+Math.min(PTR.speed/18,1.2)+(now-PTR.lastDown<260?.4:0);PTR.lastDown=now;doImpact(p.x,p.y,st);PT.impulse(p.x,p.y,st);logEvent('IMPACT')}
  }else if(SCULPT.has(tool)){Snd.tick()}
  else toolAtPoint(0);
  if(e.pointerType==='touch'&&tool!=='grab'&&hit){
    clearTimeout(lpTimer);lpTimer=setTimeout(()=>{if(PTR.down&&!GRAB.list.length&&Math.hypot(PTR.sx-e.clientX,PTR.sy-e.clientY)<12){beginGrab(hit,PTR.x,PTR.y);if(navigator.vibrate)navigator.vibrate(12)}},450);
  }
}
function onUp(){
  PTR.down=false;clearTimeout(lpTimer);endGrab();RANGE.active=false;
  if(S.select==='single'&&!selKeep)SEL.clear();
  for(const l of letters)l.sculpting=false;
}
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{
  canvas.focus({preventScroll:true});Snd.init();
  try{canvas.setPointerCapture(e.pointerId)}catch(_){}
  ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  Demo.abort();
  if(PLAY.active||Exp.busy||cinemaOn||Reel.running)return;
  if(ptrs.size===2){const a=[...ptrs.values()];pinch={d:Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y),z:CAM.goalDist};onUp();return}
  setPtr(e);
  if(e.button===2||e.button===1){orbit={x:e.clientX,y:e.clientY,rx:S.rotX,ry:S.rotY};return}
  onDown(e);
});
canvas.addEventListener('pointermove',e=>{
  if(ptrs.has(e.pointerId))ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pinch&&ptrs.size>=2){const a=[...ptrs.values()];const d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);CAM.goalDist=clamp(pinch.z*pinch.d/Math.max(d,20),.35,2.4);return}
  if(orbit){S.rotY=clamp(orbit.ry+(e.clientX-orbit.x)*.005,-.9,.9);S.rotX=clamp(orbit.rx+(e.clientY-orbit.y)*.005,-.9,.9);return}
  if(Auto.fn)return;
  setPtr(e);
  if(RANGE.active&&PTR.down){const p=screenToLocal(e.clientX,e.clientY,0),h=hitLetter(p.x,p.y,.1);if(h){SEL.clear();for(let i=Math.min(RANGE.anchor,h.idx);i<=Math.max(RANGE.anchor,h.idx);i++)SEL.add(i)}}
  tagMove(e);
});
const pend=e=>{ptrs.delete(e.pointerId);if(ptrs.size<2)pinch=null;if(ptrs.size===0){orbit=null;onUp();if(e.pointerType==='touch')PTR.present=false}};
canvas.addEventListener('pointerup',pend);canvas.addEventListener('pointercancel',pend);
canvas.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse'&&!PTR.down){PTR.present=false;tagEl.classList.remove('on')}});
canvas.addEventListener('wheel',e=>{e.preventDefault();CAM.goalDist=clamp(CAM.goalDist*Math.exp(e.deltaY*.0012),.35,2.4)},{passive:false});
const tagEl=$('#cursorTag');
function tagMove(e){
  if(e.pointerType!=='mouse'||mode!=='studio'||cinemaOn||V.exp){tagEl.classList.remove('on');return}
  tagEl.style.transform=`translate(${e.clientX+16}px,${e.clientY+14}px)`;tagEl.classList.add('on');
}
function updateTag(){
  if(mode!=='studio'){return}
  const name=(PT.mode!=='off'&&PT.vis>.3)?S.ptool:S.tool;tagEl.textContent=name;
  canvas.style.cursor=hover?'grab':(SCULPT.has(S.tool)?'crosshair':'default');
  if(PTR.down&&GRAB.list.length)canvas.style.cursor='grabbing';
}
/* ---- keyboard ---- */
window.addEventListener('keydown',e=>{
  const tg=e.target;if(tg&&(tg.tagName==='INPUT'||tg.tagName==='TEXTAREA'||tg.isContentEditable))return;
  if(mode!=='studio')return;
  const k=e.key;
  if(k==='Escape'){if(cinemaOn)exitCinema();else{SEL.clear();selKeep=false;closePanel()}return}
  if(/^[1-9]$/.test(k)){const t=TOOLS[+k-1];if(t){setTool(t[0]);return}}
  if(k==='ArrowRight'||k==='ArrowLeft'){
    e.preventDefault();const n=letters.length;if(!n)return;
    const cur=SEL.size?[...SEL].pop():(k==='ArrowRight'?-1:n),nx=clamp(cur+(k==='ArrowRight'?1:-1),0,n-1);
    if(e.shiftKey&&SEL.size){const a=Math.min(...SEL),b=Math.max(...SEL);if(k==='ArrowRight')SEL.add(Math.min(n-1,b+1));else SEL.add(Math.max(0,a-1))}else{SEL.clear();SEL.add(nx)}
    selKeep=true;Snd.tick();return;
  }
  if(k==='a'&&(e.metaKey||e.ctrlKey)){e.preventDefault();letters.forEach(l=>SEL.add(l.idx));return}
  if(k===' '){if(tg&&tg.tagName==='BUTTON')return;e.preventDefault();const l=SEL.size?letters[[...SEL][0]]:null;const x=l?l.x:0,y=l?l.y:0;doImpact(x,y,1.5);PT.impulse(x,y,1.5);return}
  if(k==='b'||k==='B'){breakAll();return}
  if(k==='r'||k==='R'){rebuildAll();return}
});
canvas.addEventListener('keydown',e=>{if(e.key==='Tab')return});

/* ---- HUD ---- */
function drawHud(t){
  hctx.clearRect(0,0,V.cw,V.ch);
  if(V.exp||cinemaOn||mode==='landing'&&!Demo.on)return;
  const col=PALS[S.palette].ui;hctx.strokeStyle=col;hctx.lineWidth=1.5;hctx.lineCap='round';
  const sel=S.select==='all'?null:SEL;
  const bracket=(l,alpha)=>{
    const c=Math.cos(l.frz),s=Math.sin(l.frz),w=l.hx+.18,h=l.hy+.18,cs=[[-w,-h],[w,-h],[w,h],[-w,h]].map(([x,y])=>projectLocal(l.fx+x*c-y*s,l.fy+x*s+y*c,l.fz));
    hctx.globalAlpha=alpha;
    for(let i=0;i<4;i++){
      const a=cs[i],b=cs[(i+1)%4],d=cs[(i+3)%4],L=9;
      const ux=b.x-a.x,uy=b.y-a.y,ul=Math.hypot(ux,uy)||1,vx=d.x-a.x,vy=d.y-a.y,vl=Math.hypot(vx,vy)||1;
      hctx.beginPath();hctx.moveTo(a.x+ux/ul*L,a.y+uy/ul*L);hctx.lineTo(a.x,a.y);hctx.lineTo(a.x+vx/vl*L,a.y+vy/vl*L);hctx.stroke();
    }
  };
  if(sel&&sel.size&&!PLAY.active)for(const i of sel){const l=letters[i];if(l&&!l.hidden&&!l.broken)bracket(l,.9)}
  if(S.select==='all'&&letters.length&&!PLAY.active){
    let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
    for(const l of letters){if(l.hidden)continue;for(const[dx,dy]of[[-l.hx,-l.hy],[l.hx,l.hy],[-l.hx,l.hy],[l.hx,-l.hy]]){const p=projectLocal(l.fx+dx,l.fy+dy,0);x0=Math.min(x0,p.x);y0=Math.min(y0,p.y);x1=Math.max(x1,p.x);y1=Math.max(y1,p.y)}}
    if(x1>x0){x0-=14;y0-=14;x1+=14;y1+=14;hctx.globalAlpha=.7;const L=14;
      for(const[x,y,sx,sy]of[[x0,y0,1,1],[x1,y0,-1,1],[x1,y1,-1,-1],[x0,y1,1,-1]]){hctx.beginPath();hctx.moveTo(x+sx*L,y);hctx.lineTo(x,y);hctx.lineTo(x,y+sy*L);hctx.stroke()}}
  }
  if(hover&&!PTR.down&&!SEL.has(hover.idx)&&S.select!=='all')bracket(hover,.35);
  if(PTR.present&&(mode==='studio')&&!isTouch||PLAY.active){
    const p=projectLocal(PTR.x,PTR.y,0);
    if(SCULPT.has(S.tool)||S.tool==='cut'||S.tool==='rebuild'){
      const q=projectLocal(PTR.x+S.brush,PTR.y,0),r=Math.hypot(q.x-p.x,q.y-p.y);
      hctx.globalAlpha=PTR.down?.9:.5;hctx.setLineDash([4,5]);hctx.beginPath();hctx.arc(p.x,p.y,r,0,TAU);hctx.stroke();hctx.setLineDash([]);
    }
    hctx.globalAlpha=.9;hctx.beginPath();hctx.arc(p.x,p.y,PTR.down?5:3,0,TAU);hctx.stroke();
  }
  hctx.globalAlpha=1;
}
