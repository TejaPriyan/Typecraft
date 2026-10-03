/* ===================== UI ===================== */
const el=(tag,cls,html)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(html!==undefined)e.innerHTML=html;return e};
let toastT=0;
function toast(msg,ms){const t=$('#toast');t.textContent=msg;t.classList.add('on');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('on'),ms||2800)}
const panelEl=$('#panel'),dockEl=$('#dock');
let openTab=null;
const TABS=[['type','TYPE'],['motion','MOTION'],['material','MATERIAL'],['physics','PHYSICS'],['effect','EFFECT'],['camera','CAMERA']];
function closePanel(){openTab=null;panelEl.classList.remove('open');syncUI()}
function closeModals(){$('#mExport').classList.remove('on');$('#mProj').classList.remove('on')}
function togglePanel(id){openTab=openTab===id?null:id;renderPanel();syncUI();setTimeout(layoutViewport,0)}

const chips=(items,isOn,onPick,styleFn)=>{
  const d=el('div','chips');
  for(const[id,label]of items){const b=el('button','chip'+(isOn(id)?' on':''),label);b.type='button';b.setAttribute('aria-pressed',isOn(id)?'true':'false');b.onclick=()=>onPick(id);if(styleFn)styleFn(b,id);d.append(b)}
  return d;
};
const sec=(title,...kids)=>{const s=el('div','sec');if(title)s.append(el('p','lab',title));s.append(...kids);return s};
function slider(label,min,max,step,get,set,fmt,dis){
  const w=el('label','sl'),out=el('output'),inp=document.createElement('input');
  inp.type='range';inp.min=min;inp.max=max;inp.step=step;inp.value=get();inp.setAttribute('aria-label',label);
  const show=()=>{out.textContent=fmt?fmt(+inp.value):(+inp.value).toFixed(2)};show();
  inp.addEventListener('input',()=>{set(+inp.value);show()});
  w.append(el('span','',label),out,inp);if(dis){inp.disabled=true;w.style.opacity=.4}
  return w;
}
const grid=(...k)=>{const g=el('div','sliders');g.append(...k);return g};
let rlq=0;const relayoutSoon=()=>{if(rlq)return;rlq=requestAnimationFrame(()=>{rlq=0;refont()})};
const selNote=()=>SEL.size&&S.select!=='all'?SEL.size+' selected letter'+(SEL.size>1?'s':''):'all letters';

function renderPanel(){
  panelEl.innerHTML='';
  if(!openTab){panelEl.classList.remove('open');return}
  panelEl.classList.add('open');
  const P=panelEl;
  if(openTab==='type'){
    const f=FONT[S.font];
    const fc=chips(FONTS.map(x=>[x.id,x.name]),id=>S.font===id,id=>{S.font=id;refont();renderPanel()},(b,id)=>{b.style.fontFamily=`"${FONT[id].fam}",${FONT[id].fb||'sans-serif'}`});
    const upBtn=el('button','chip','+ Upload Font');upBtn.type='button';upBtn.style.border='1px dashed var(--acc)';upBtn.style.color='var(--acc)';
    const upInp=document.createElement('input');upInp.type='file';upInp.accept='.ttf,.otf,.woff,.woff2';upInp.style.display='none';
    upInp.onchange=e=>{if(e.target.files&&e.target.files[0])loadCustomFontFile(e.target.files[0])};
    upBtn.onclick=()=>upInp.click();fc.append(upBtn,upInp);
    P.append(sec('Font',fc));
    P.append(sec('Type',grid(
      slider('Size',.4,1.5,.01,()=>S.size,v=>{S.size=v;relayoutSoon()}),
      slider('Weight',f.vf?f.wmin:400,f.vf?f.wmax:800,50,()=>f.vf?S.weight:f.w0,v=>{S.weight=v;relayoutSoon()},v=>f.vf?String(Math.round(v)):'fixed',!f.vf),
      slider('Tracking',-.08,.5,.005,()=>S.tracking,v=>{S.tracking=v;relayoutSoon()}),
      slider('Line height',.7,1.6,.01,()=>S.lineH,v=>{S.lineH=v;relayoutSoon()})
    )));
    P.append(sec('Alignment',chips([['left','Left'],['center','Center'],['right','Right']],id=>S.align===id,id=>{S.align=id;relayout();renderPanel()})));
    P.append(sec('Presets',chips(TPRESETS.map(p=>[p[0],p[1]]),()=>false,id=>{const p=TPRESETS.find(x=>x[0]===id);applyPreset(p[2])})));
  }else if(openTab==='motion'){
    const M=[['explode','Explode'],['rebuild','Rebuild'],['wave','Wave'],['bounce','Bounce'],['spin','Spin'],['stretch','Stretch'],['melt','Melt'],['shatter','Shatter'],['flip','Flip'],['glitch','Glitch']];
    P.append(sec('Kinetic modes',chips(M,id=>!!S.motion[id],toggleMotion)));
    P.append(el('p','note','Wave, bounce, spin, stretch, melt and glitch stay on until you toggle them. Explode, rebuild, shatter and flip play once. Stretch follows your cursor speed.'));
  }else if(openTab==='material'){
    P.append(sec('Material · applies to '+selNote(),chips(MATS.map(m=>[m,MATNAME[m]]),id=>selArr().every(l=>MATS[l.mat]===id),setMaterial)));
    P.append(sec('Colour',chips(PALIDS.map(k=>[k,PALS[k].name]),id=>S.palette===id,setPalette,(b,id)=>{b.insertAdjacentHTML('afterbegin',`<span class="sw" style="background:${PALS[id].c1}"></span>`)})));
    P.append(el('p','note','Materials change behaviour, not just colour: rubber bounces, paper flutters, smoke rises, ice cracks on hard hits, liquid wobbles.'));
  }else if(openTab==='physics'){
    P.append(sec('Mode',chips(PHYS,id=>S.physics===id,id=>{setPhysics(id);renderPanel()})));
    P.append(sec('Forces',grid(
      slider('Gravity',0,60,1,()=>S.gravity,v=>S.gravity=v,v=>v.toFixed(0)),
      slider('Bounce',0,1.2,.01,()=>S.bounce,v=>S.bounce=v),
      slider('Friction',0,1,.01,()=>S.friction,v=>S.friction=v),
      slider('Air resistance',0,3,.01,()=>S.air,v=>S.air=v),
      slider('Cursor force',.3,2.5,.01,()=>S.force,v=>S.force=v),
      slider('Sculpt memory',0,1,.01,()=>S.memory,v=>S.memory=v)
    )));
    P.append(el('p','note','Sculpt memory: high keeps the shapes you push, low lets letters spring back. Fast cursor movement hits harder.'));
  }else if(openTab==='effect'){
    P.append(sec('Break and rebuild',(()=>{const r=el('div','row');const b1=el('button','chip','Break'),b2=el('button','chip','Rebuild');b1.onclick=breakAll;b2.onclick=rebuildAll;r.append(b1,b2);return r})()));
    P.append(sec('Particle type',chips([['toggle','Particle type'],['repel','Repel'],['attract','Attract'],['swirl','Swirl'],['vortex','Vortex'],['explode','Explode'],['freeze','Freeze'],['rebuild','Rebuild']],
      id=>id==='toggle'?PT.mode!=='off':id==='freeze'?PT.frozen:S.ptool===id,
      id=>{
        if(id==='toggle')toggleParticles();
        else if(id==='explode'){if(PT.mode==='off')PT.enter();PT.explode(10,PTR.x,PTR.y)}
        else if(id==='freeze'){PT.frozen=!PT.frozen}
        else if(id==='rebuild')rebuildAll();
        else{S.ptool=id;if(PT.mode==='off')toggleParticles()}
        renderPanel();
      })));
    P.append(el('p','note','Particles remember their letter. Move the cursor through them; with Vortex selected, click to drop a vortex.'));
    const a=el('input','fld');a.value=Fx.morphA||'TEJA';a.placeholder='Word A';a.setAttribute('aria-label','Word A');a.oninput=()=>Fx.morphA=a.value;
    const b=el('input','fld');b.value=Fx.morphB||'MOTION';b.placeholder='Word B';b.setAttribute('aria-label','Word B');b.oninput=()=>Fx.morphB=b.value;
    const go=el('button','chip on','Morph');go.onclick=()=>{Fx.morphA=a.value;Fx.morphB=b.value;morphWords(a.value.toUpperCase(),b.value.toUpperCase())};
    const r=el('div','row');r.append(a,b,go);P.append(sec('Morph between words',r));
    P.append(sec('Sculpt brush',grid(slider('Brush size',.5,3.5,.05,()=>S.brush,v=>S.brush=v))));
  }else if(openTab==='camera'){
    P.append(sec('Camera behaviour',chips([['drift','Slow drift'],['follow','Follow cursor'],['orbit','Orbit'],['still','Still']],id=>S.camMode===id,id=>{S.camMode=id;renderPanel()})));
    const act=[['push','Push in',camPush],['pull','Pull out',camPull],['focus','Focus selected',camFocus],['shake','Shake',camShake],['reset','Reset',camReset]];
    const r=el('div','chips');act.forEach(([id,l,fn])=>{const b=el('button','chip',l);b.onclick=fn;r.append(b)});P.append(sec('Moves',r));
    P.append(sec('Depth and rotation',grid(
      slider('Extrusion',0,1,.01,()=>S.depth,v=>{S.depth=v;G.uDepth.value=Math.max(.05,v*(Fx.fs||1)*.6)}),
      slider('Tilt X',-.9,.9,.01,()=>S.rotX,v=>S.rotX=v),slider('Tilt Y',-.9,.9,.01,()=>S.rotY,v=>S.rotY=v),slider('Roll Z',-.9,.9,.01,()=>S.rotZ,v=>S.rotZ=v)
    )));
    P.append(sec('Lighting',grid(
      slider('Key light',0,2,.01,()=>S.keyI,v=>S.keyI=v),slider('Rim light',0,2,.01,()=>S.rimI,v=>S.rimI=v),slider('Ambient',0,1,.01,()=>S.ambI,v=>S.ambI=v)
    ),chips([['cur','Cursor is a light']],()=>S.cursorLight,()=>{S.cursorLight=!S.cursorLight;renderPanel()})));
    P.append(sec('Film and performance',grid(slider('Film grain',0,.3,.005,()=>S.grain,v=>S.grain=v)),
      chips([['calm','Calm motion']],()=>S.calm,()=>{S.calm=!S.calm;renderPanel()}),
      chips([['high','High'],['balanced','Balanced'],['performance','Performance']],id=>S.quality===id,id=>{setQuality(id);renderPanel()})));
  }
}
function setQuality(q){
  if(S.quality===q&&GEO.layers===Q[q].layers&&glyphRes===Q[q].res)return;
  S.quality=q;glyphRes=Q[q].res;SH.on=Q[q].shadow;
  if(PLAY.active)stopPlayback();
  resetScene();clearGlyphs();ensureGeo();initSystems();layoutViewport();relayout();
  for(const l of letters)l.refreshMaterial();toast('Quality: '+q);
}

/* ---- dock ---- */
const dockBtn={};
function buildDock(){
  const mk=(id,label,cls,fn)=>{const b=el('button','btn'+(cls?' '+cls:''),label);b.id='d_'+id;b.type='button';b.onclick=fn;dockEl.append(b);dockBtn[id]=b;return b};
  const vr=()=>dockEl.append(el('span','vr'));
  TABS.forEach(([id,l])=>mk(id,l,'',()=>togglePanel(id)));
  vr();mk('break','Break','',breakAll);mk('rebuild','Rebuild','',rebuildAll);vr();
  mk('surprise','✦ Surprise me','',surprise);mk('remix','Remix','',remix);mk('reel','Reel','',()=>runReel({variant:REEL_DEFAULT}));vr();
  mk('rec','<i class="dot"></i>Record','rec',()=>{if(REC.on)recStop();else{if(PLAY.active)stopPlayback().then(recStart);else recStart()}});
  dockBtn.rec.innerHTML='<i class="dot"></i>Record';
  // tools rail
  const tools=$('#tools');
  TOOLS.forEach(([id,l],i)=>{const b=el('button','',l);b.type='button';b.dataset.tool=id;b.title=l+' ('+(i+1)+')';b.onclick=()=>setTool(id);tools.append(b)});
  tools.append(el('span','sep'));
  [['single','Single'],['range','Range'],['all','All']].forEach(([id,l])=>{const b=el('button','',l);b.type='button';b.dataset.sel=id;b.onclick=()=>{S.select=id;if(id==='all')syncSel();else if(id==='single'&&SEL.size>1)syncSel();syncUI()};tools.append(b)});
}
let lastTL='';
function syncUI(){
  for(const[id]of TABS)dockBtn[id]&&dockBtn[id].classList.toggle('on',openTab===id);
  $$('#tools button[data-tool]').forEach(b=>b.classList.toggle('on',b.dataset.tool===S.tool));
  $$('#tools button[data-sel]').forEach(b=>b.classList.toggle('on',b.dataset.sel===S.select));
  if(dockBtn.rec){dockBtn.rec.classList.toggle('live',REC.on);}
  if(dockBtn.break){dockBtn.break.disabled=Fx.breaking||PLAY.active;dockBtn.rebuild.disabled=Fx.rebuilding||PLAY.active}
  const snd=$('#btnSound');snd.textContent=S.sound?'🔊 Sound on':'🔇 Sound off';snd.setAttribute('aria-pressed',S.sound?'true':'false');
  $('#tlPlay').textContent=PLAY.active&&!PLAY.paused?'⏸':'▶';$('#tlLoop').classList.toggle('on',PLAY.loop);$('#tlLoop').setAttribute('aria-pressed',PLAY.loop?'true':'false');
  $('#tlSpeed').textContent=(PLAY.speed===.25?'¼':PLAY.speed===.5?'½':PLAY.speed)+'×';$('#tlRev').classList.toggle('on',PLAY.active&&PLAY.dir<0&&!PLAY.paused);
  $('#tl').classList.toggle('on',!!TAKE||REC.on);
  renderMarks();
  const ae=document.activeElement;if(openTab&&!(ae&&ae.type==='range'&&panelEl.contains(ae)))renderPanel();
  setTimeout(layoutViewport,0);
}
let marksKey='';
function renderMarks(){
  const key=TAKE?TAKE.dur+'|'+TAKE.events.length:'';if(key===marksKey)return;marksKey=key;
  const m=$('#marks');m.innerHTML='';if(!TAKE)return;
  for(const e of TAKE.events){const i=el('i');i.style.left=(e.t/TAKE.dur*100)+'%';i.title=e.label;m.append(i)}
}
function updateTimeline(){
  let txt,val=null;
  if(REC.on){txt='● '+fmtT(REC.t)+' / '+MAXREC+'s';dockBtn.rec.innerHTML='<i class="dot"></i>Stop '+fmtT(REC.t)+'s'}
  else{
    if(dockBtn.rec&&dockBtn.rec.textContent.indexOf('Stop')===0)dockBtn.rec.innerHTML='<i class="dot"></i>Record';
    if(TAKE){const t=PLAY.active?PLAY.t:0;txt=fmtT(t)+' / '+fmtT(TAKE.dur)+'s';val=Math.round(t/TAKE.dur*1000)}
  }
  const key=txt+'|'+val;if(key===lastTL||txt===undefined)return;lastTL=key;
  $('#tcode').textContent=txt;if(val!==null&&document.activeElement!==$('#scrub'))$('#scrub').value=val;
  $('#scrub').disabled=REC.on;
}
$('#scrub').addEventListener('input',async e=>{
  if(!TAKE||REC.on)return;const t=(+e.target.value)/1000*TAKE.dur;
  if(!PLAY.active){await startPlayback({});}
  PLAY.paused=true;seekTo(t);syncUI();
});
$('#tlPlay').onclick=tlToggle;$('#tlRev').onclick=tlReverse;$('#tlLoop').onclick=tlLoop;$('#tlSpeed').onclick=tlSpeed;

/* ---- top bar ---- */
const textIn=$('#textIn');
function autosize(){textIn.style.height='44px';textIn.style.height=Math.min(96,Math.max(44,textIn.scrollHeight))+'px'}
textIn.addEventListener('input',()=>{
  if(REC.on){recStop();toast('Recording stopped — the text changed')}
  if(PLAY.active)stopPlayback();
  Snd.init();autosize();
  S.text=textIn.value;
  const f=FONT[S.font];ensureFont(f,effWeight(f,S.weight)).then(()=>relayout({}));
});
textIn.addEventListener('keydown',e=>{e.stopPropagation()});
async function loadCustomFontFile(file){
  if(!file)return;
  try{
    const buffer=await file.arrayBuffer();
    const cleanName=file.name.replace(/\.[^/.]+$/,"").replace(/[^a-zA-Z0-9_\-\s]/g,"").trim().slice(0,16)||'Custom';
    const fam='CustomFont_'+Date.now();
    const face=new FontFace(fam,buffer);
    await face.load();
    document.fonts.add(face);
    const id='cust_'+Date.now();
    const entry={id,name:'✦ '+cleanName,fam,cat:'Custom',vf:false,w0:400,custom:true};
    FONTS.unshift(entry);
    FONT[id]=entry;
    S.font=id;
    await refont();
    renderPanel();
    toast('Custom font loaded: '+cleanName);
  }catch(e){console.error('Custom font error:',e);toast('Failed to load font file')}
}

async function loadCustomAudioFile(file){
  if(!file)return;
  const name=await Snd.loadMusic(file);
  if(name){
    const btn=$('#btnMusic');
    if(btn){btn.classList.add('on');btn.innerHTML='🎵 '+name.slice(0,10);btn.setAttribute('aria-pressed','true')}
    toast('Beat track synced: '+name);
  }
}

window.addEventListener('dragover',e=>{e.preventDefault()});
window.addEventListener('drop',e=>{
  e.preventDefault();
  if(!e.dataTransfer||!e.dataTransfer.files||!e.dataTransfer.files.length)return;
  const file=e.dataTransfer.files[0];
  const ext=file.name.split('.').pop().toLowerCase();
  if(['ttf','otf','woff','woff2'].includes(ext))loadCustomFontFile(file);
  else if(['mp3','wav','ogg','m4a','flac','aac'].includes(ext))loadCustomAudioFile(file);
});

$('#btnSound').onclick=()=>{Snd.init();S.sound=!S.sound;Snd.on=S.sound;syncUI()};
const btnMusic=$('#btnMusic');
const musicInp=document.createElement('input');musicInp.type='file';musicInp.accept='audio/*';musicInp.style.display='none';
document.body.append(musicInp);
musicInp.onchange=e=>{if(e.target.files&&e.target.files[0])loadCustomAudioFile(e.target.files[0])};
if(btnMusic){
  btnMusic.onclick=()=>{
    if(!Snd.isMusicActive()&&!Snd.getMusicName()){musicInp.click()}
    else{
      const playing=Snd.toggleMusic();
      btnMusic.classList.toggle('on',playing);
      btnMusic.setAttribute('aria-pressed',playing?'true':'false');
      toast(playing?'Music resumed':'Music paused');
    }
  };
  btnMusic.oncontextmenu=e=>{e.preventDefault();musicInp.click()};
}
$('#btnCinema').onclick=()=>enterCinema();
$('#btnExport').onclick=()=>openExport();
$('#btnProj').onclick=()=>openProjects();
$('#logo').onclick=()=>backToStart();
$('#rsReplay').onclick=()=>startPlayback({});
$('#rsRemix').onclick=()=>{hideResult();remix()};
$('#rsExport').onclick=()=>openExport();
$('#rsEdit').onclick=()=>{if(PLAY.active)stopPlayback().then(leaveReelFrame);else leaveReelFrame()};
$('#cnReplay').onclick=()=>{
  $('#cinemaBar').classList.remove('on');Cin.t=0;
  if(PLAY.active){PLAY.t=0;PLAY.dir=1;PLAY.paused=false;seekTo(0);PLAY.onEnd=()=>$('#cinemaBar').classList.add('on')}
  else if(TAKE)startPlayback({onEnd:()=>$('#cinemaBar').classList.add('on')});
  else runReel({keepFrame:true,onEnd:()=>$('#cinemaBar').classList.add('on')});
};
$('#cnExport').onclick=async()=>{await exitCinema();openExport()};
$('#cnExit').onclick=()=>exitCinema();
document.addEventListener('click',e=>{if(e.target.classList&&e.target.classList.contains('modal'))closeModals()});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModals()});

/* ---- export modal ---- */
function openExport(){
  hideResult();const m=$('#mExport'),c=$('#cExport');m.classList.add('on');c.innerHTML='';
  const rerender=()=>openExportBody(c);openExportBody(c);void rerender;
}
function openExportBody(c){
  c.innerHTML='';c.append(el('h2','','Export'));
  const O=EXO,mk=(t,items,key,after)=>{c.append(sec(t,chips(items,id=>String(O[key])===String(id),id=>{O[key]=typeof O[key]==='number'?+id:id;openExportBody(c)})))};
  mk('Format',[['video','Video'],['gif','GIF'],['png','PNG'],['svg','SVG']],'fmt');
  mk('Frame',[['9:16','9:16 · Reel'],['16:9','16:9 · Wide'],['1:1','1:1 · Square']],'aspect');
  if(O.fmt==='video'||O.fmt==='gif'){
    mk('Length',[[3,'3 s'],[5,'5 s'],[10,'10 s'],[15,'15 s']],'dur');
    mk('Source',[['auto',TAKE?'Your take':'Auto reel'],['reel','Auto reel']].concat(TAKE?[['take','Your take']]:[]).filter((x,i,a)=>a.findIndex(y=>y[0]===x[0])===i),'src');
    if(O.fmt==='video')mk('Resolution',[[720,'HD 720'],[1080,'Full HD 1080']],'res');
    c.append(sec('Signature',chips([['sig','Show “Created with TYPECRAFT” on the last frame']],()=>S.sig,()=>{S.sig=!S.sig;openExportBody(c)})));
    if(O.fmt==='gif'&&O.dur>5)c.append(el('p','note','GIFs longer than 5 s get large. 3–5 s works best.'));
    c.append(el('p','note',(TAKE&&O.src!=='reel'?'Your '+fmtT(TAKE.dur)+' s take plays once (trimmed or held to the chosen length). ':'The auto reel is composed natively for the chosen frame. ')+'Video is captured in real time, so keep this tab open while it renders.'));
  }else if(O.fmt==='png')c.append(el('p','note','Saves the current frame at the chosen aspect ratio.'));
  else c.append(el('p','note','Vector outlines of every letter at its current position and rotation. Sculpt deformation is not included.'));
  const row=el('div','row');
  const go=el('button','btn acc','Export '+O.fmt.toUpperCase());go.onclick=()=>runExport(Object.assign({},O));
  const cl=el('button','btn','Close');cl.onclick=closeModals;row.append(go,cl);c.append(row);
}
function showExportResult(blob,name,o){
  const m=$('#mExport'),c=$('#cExport');m.classList.add('on');c.innerHTML='';c.append(el('h2','','Ready'));
  const url=URL.createObjectURL(blob);
  if(blob.type.startsWith('video')){const v=document.createElement('video');v.src=url;v.controls=true;v.loop=true;v.muted=true;v.playsInline=true;v.autoplay=true;c.append(v)}
  else{const i=document.createElement('img');i.src=url;i.alt='Export preview';c.append(i)}
  c.append(el('p','note',name+' · '+(blob.size/1048576).toFixed(2)+' MB'));
  const row=el('div','row'),sv=el('button','btn acc','Save file'),cl=el('button','btn','Close');
  sv.onclick=()=>saveFile(blob,name);cl.onclick=()=>{closeModals();URL.revokeObjectURL(url)};row.append(sv,cl);c.append(row);
}
let pill=null;
function expProgress(f,label){
  if(!pill){pill=el('div');pill.id='expPill';pill.innerHTML='<span></span><div class="bar"><i></i></div><button class="btn">Cancel</button>';document.body.append(pill);pill.querySelector('button').onclick=()=>{Exp.cancel=true}}
  if(f<0){pill.classList.remove('on');return}
  pill.classList.add('on');pill.querySelector('span').textContent=label||'';pill.querySelector('i').style.width=(f*100)+'%';
}

/* ---- projects modal ---- */
async function openProjects(){
  const m=$('#mProj'),c=$('#cProj');m.classList.add('on');c.innerHTML='';c.append(el('h2','','Projects'));
  const list=el('div','plist');c.append(list);
  let items=[];try{items=(await IDB.list()).sort((a,b)=>b.updated-a.updated)}catch(e){list.append(el('p','note','Saving is not available in this browser.'))}
  if(!items.length&&!list.children.length)list.append(el('p','note','No saved projects yet. Everything stays in this browser, no account needed.'));
  for(const p of items){
    const r=el('div','pitem');
    if(p.thumb){const i=document.createElement('img');i.src=p.thumb;i.alt='';i.style.cssText='width:54px;height:36px;object-fit:cover;border-radius:6px;margin:0';r.append(i)}
    r.append(el('span','',p.name+' <small>'+new Date(p.updated).toLocaleDateString()+(p.take?' · take':'')+'</small>'));
    const lo=el('button','btn','Load'),de=el('button','btn','Delete');
    lo.onclick=async()=>{closeModals();await loadProject(p.id)};de.onclick=async()=>{await IDB.del(p.id);openProjects()};r.append(lo,de);list.append(r);
  }
  const nm=el('input','fld');nm.placeholder='Project name';nm.value=currentProject?currentProject.name:S.text.slice(0,24);nm.setAttribute('aria-label','Project name');
  const row=el('div','row'),sv=el('button','btn acc','Save project'),nw=el('button','btn','New project'),cl=el('button','btn','Close');
  sv.onclick=async()=>{await saveProject(nm.value);openProjects()};nw.onclick=async()=>{closeModals();await newProject()};cl.onclick=closeModals;
  row.append(nm,sv,nw,cl);c.append(row);
}

/* ---- landing <-> studio ---- */
async function enterHero(){
  mode='landing';Fx.hero=true;layoutOffY=1.15;S.tool='grab';
  await applyLook(Object.assign(clone(DEFAULT_LOOK),{text:'TYPECRAFT',font:'anton',weight:400,tracking:.04,size:1,material:'chrome',palette:'chrome',physics:'still',camMode:'follow',depth:.45,select:'single'}),{reset:true,spawn:true});
}
async function enterStudio(o){
  o=o||{};if(mode==='studio')return;
  Snd.init();$('#landing').classList.add('gone');$('#landTop').style.display='none';
  Fx.hero=false;
  for(const l of letters){const dx=l.x,dy=l.y-1,d=Math.hypot(dx,dy)+.3;l.vx+=dx/d*rr(8,14);l.vy+=dy/d*rr(8,14)+3;l.wz+=rr(-8,8)}
  Fx.phase='free';SP.burst(0,1,50,9);Snd.impact(1.2);CAM.shake+=.5;
  await sleep(o.demo?450:650);
  Fx.phase=null;Fx.springBoost=1;layoutOffY=0;mode='studio';
  await applyLook(Object.assign(clone(DEFAULT_LOOK),{text:o.text||DEFAULT_LOOK.text}),{reset:true,spawn:true});
  $('#ui').classList.add('on');textIn.value=S.text;autosize();syncUI();layoutViewport();
  if(!o.demo)toast('Grab a letter. Click empty space for an impact.',3800);
}
async function backToStart(){
  if(mode==='landing')return;
  if(PLAY.active)await stopPlayback();if(REC.on)recStop(true);
  Demo.abort();resetScene();closePanel();closeModals();$('#ui').classList.remove('on');$('#landing').classList.remove('gone');$('#landTop').style.display='';
  tagEl.classList.remove('on');await enterHero();
}
$('#btnStart').onclick=()=>enterStudio({});
$('#btnDemo').onclick=()=>runDemo();
