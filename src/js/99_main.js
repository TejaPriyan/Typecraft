/* ===================== MAIN LOOP ===================== */
const LC={x:0,y:3};
let lastT=performance.now(),lastRaw=performance.now(),acc=0,fpsN=0,fpsT=0,autoQ=true,frameNo=0,lowN=0,okN=0;
const tagline=$('#tagline');
function update(dt){
  G.uTime.value+=dt;
  const playing=PLAY.active&&TAKE;
  if(cinemaOn){Cin.t+=dt;const p=clamp(Cin.t/Cin.dur,0,1);CAM.extraDist=1-.14*EASE.io(p);CAM.extraAz=Math.sin(p*Math.PI)*.16*(S.calm?.3:1)}
  if(playing){
    playbackStep(dt);
    if(Exp.busy&&Exp.sigTail&&S.sig){const rem=Exp.dur-(performance.now()-Exp.t0)/1000;sigMat.opacity=clamp((1.4-rem)/.5,0,1)*.85}
    else if(!S.sig)sigMat.opacity=0;
    SP.update(dt);DU.update(dt,G.uTime.value);
  }else{
    Seq.update(dt);Fx.clock+=dt;
    updatePointer(dt);
    Fx.springBoost+=(1-Fx.springBoost)*(1-Math.exp(-dt*1.2));
    applySculpt(dt);
    applyOverlays(Fx.clock,dt);
    updateBounds();
    acc+=dt;let n=0;while(acc>=1/120&&n<6){stepPhysics(1/120,Fx.clock);acc-=1/120;n++}if(n>=6)acc=0;
    const bp=Snd.getBeatPulse();
    if(bp>.04){CAM.shake+=bp*.03;for(const l of letters)if(!l.hidden&&!l.broken)l.vz+=bp*.5}
    for(const l of letters)l.updateVisual(dt);
    stepShards(dt);
    for(const l of letters)if(MATS[l.mat]==='smoke'&&!l.hidden&&l.dissolve<.5&&Math.random()<dt*22)SP.emitSmoke(l.fx+rr(-l.hx,l.hx),l.fy+rr(-l.hy,l.hy));
    SP.update(dt);DU.update(dt,Fx.clock);PT.update(dt,Fx.clock);
    updateCamera(dt,Fx.clock,PTR);
    const kx=1-Math.exp(-dt*5),hero=Fx.hero&&PTR.present;
    const tx=S.rotX+(hero?-PTR.ny*.16:0),ty=S.rotY+(hero?PTR.nx*.24:0);
    group.rotation.x+=(tx-group.rotation.x)*kx;group.rotation.y+=(ty-group.rotation.y)*kx;group.rotation.z+=(S.rotZ-group.rotation.z)*kx;
    const lx=PTR.present?PTR.x:0,ly=PTR.present?PTR.y:3.5;LC.x+=(lx-LC.x)*(1-Math.exp(-dt*9));LC.y+=(ly-LC.y)*(1-Math.exp(-dt*9));
    group.updateMatrixWorld();
    updateLights(LC.x,LC.y,S.cursorLight);
    const neon=letters.some(l=>l.mat===8&&!l.hidden);
    bgMat.uniforms.uAlpha.value+=((neon?.2:1)-bgMat.uniforms.uAlpha.value)*.35;
    const st=Fx.sigOn&&S.sig?.85:0;sigMat.opacity+=(st-sigMat.opacity)*(1-Math.exp(-dt*4));
  }
  if(playing)group.updateMatrixWorld();
  // shared look
  bgMat.uniforms.uCur.value.set(clamp(LC.x/V.W+.5,0,1),clamp(LC.y/V.H+.5,0,1));bgMat.uniforms.uCurI.value=S.cursorLight?1:0;
  postMat.uniforms.uGrain.value=(cinemaOn?Math.max(S.grain,.12):S.grain)*(S.calm?.5:1);postMat.uniforms.uVig.value=cinemaOn?.55:.3;
  if(REC.on){REC.t+=dt;captureFrame();if(REC.t>=MAXREC){recStop();toast('Reached the '+MAXREC+' s limit')}}
  if(mode==='landing')tagline.style.setProperty('--spread',clamp(PTR.speed/40,0,1).toFixed(2));
  updateTimeline();updateTag();
}
function render(){
  const s=canvas.height/(2*Math.tan(camera.fov*Math.PI/360));
  for(const c of CLOUDS)c.mat.uniforms.uScale.value=s;
  renderer.render(bgScene,ortho);renderer.clearDepth();renderer.render(scene,camera);renderer.render(postScene,ortho);
  drawHud();
}
function frame(now){
  requestAnimationFrame(frame);
  const dt=Math.min(.05,Math.max(.001,(now-lastT)/1000));lastT=now;frameNo++;
  try{update(dt);render()}catch(e){if(frameNo<400)console.error(e)}
  if(autoQ&&frameNo>150&&!document.hidden&&mode==='studio'){fpsN++;fpsT+=(now-lastRaw)/1000;if(fpsT>3){const fps=fpsN/fpsT;fpsN=0;fpsT=0;if(fps<34&&S.quality!=='performance'&&!Exp.busy&&!PLAY.active&&!REC.on){if(++lowN>=2){lowN=0;setQuality(S.quality==='high'?'balanced':'performance')}}else{lowN=0;if(++okN>6)autoQ=false}}}
  lastRaw=now;
}
window.addEventListener('resize',()=>{clearTimeout(window.__rz);window.__rz=setTimeout(()=>{if(V.exp)return;layoutViewport();relayout()},120)});
async function init(){
  const mobile=isTouch||innerWidth<700,cores=navigator.hardwareConcurrency||4;
  S.quality=mobile&&cores<=6?'performance':mobile?'balanced':(cores>=8&&(devicePixelRatio||1)<=2?'high':'balanced');
  glyphRes=Q[S.quality].res;SH.on=Q[S.quality].shadow;ensureGeo();
  layoutViewport();initSystems();applyPalette();buildDock();syncUI();
  requestAnimationFrame(frame);
  try{await Promise.race([document.fonts.ready,sleep(2500)])}catch(e){}
  await enterHero();
  const f=FONT[S.font];void f;
}
window.__TC={S,letters,PTR,Fx,V,CAM,get PT(){return PT},get SP(){return SP},get TAKE(){return TAKE},get REC(){return REC},get PLAY(){return PLAY},get mode(){return mode},
  api:{breakAll,rebuildAll,setPhysics,setMaterial,setPalette,setTool,recStart,recStop,startPlayback,stopPlayback,runReel,enterCinema,exitCinema,surprise,remix,morphWords,explode,doImpact,toggleParticles,applyPreset,toggleMotion,shatterAll,enterStudio,runDemo,tlToggle,tlReverse,seekTo,runExport,saveProject,loadProject,breakLetter,rebuildLetter,relayout,setQuality,TPRESETS,CURATED,resetScene,flipAll,scatterRebuild,glyphContours,openExport,openProjects,renderPanel,togglePanel,layoutViewport}};
init().catch(e=>{console.error(e);fatal('Something went wrong while starting: '+(e&&e.message))});
