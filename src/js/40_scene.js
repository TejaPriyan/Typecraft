/* ===================== SCENE: renderer, view, camera, lights, background, points ===================== */
const canvas=$('#gl'),hudC=$('#hud'),hctx=hudC.getContext('2d');
function fatal(msg){$('#fatalMsg').textContent=msg;$('#fatal').classList.add('on')}
let renderer;
try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'})}
catch(e){fatal('Your browser could not start WebGL. Try a recent Chrome, Edge, Safari or Firefox with hardware acceleration on.');throw e}
renderer.autoClear=false;renderer.setClearColor(0x000000,1);
const A2C=('alphaToCoverage' in new THREE.MeshBasicMaterial());
const Q={high:{pr:2,layers:20,parts:24000,shadow:true,res:256},balanced:{pr:1.5,layers:14,parts:14000,shadow:true,res:192},performance:{pr:1,layers:8,parts:6000,shadow:false,res:128}};
const SHLAYERS=3;
let letters=[];
const scene=new THREE.Scene(),group=new THREE.Group();scene.add(group);
const camera=new THREE.PerspectiveCamera(32,1,.1,300);
const V={cw:1,ch:1,aspect:1,H:10,W:10,fov:32,dist:20,exp:null,uiBottom:.9,recW:0,recH:0};
const computeView=aspect=>{const H=Math.max(10,7.6/aspect);return{H,W:H*aspect,dist:(H/2)/Math.tan(32*Math.PI/360)}};
const CAM={az:0,el:0,dist:1,goalDist:1,tx:0,ty:0,goalTx:0,goalTy:0,shake:0,fit:1,extraAz:0,extraDist:1};

/* shared uniforms */
const G={
 uTime:{value:0},uKeyD:{value:new THREE.Vector3(-.6,.7,.6)},uRimD:{value:new THREE.Vector3(.8,.3,-.5)},
 uKeyI:{value:1},uRimI:{value:.8},uAmbI:{value:.35},uCurP:{value:new THREE.Vector3()},uCurI:{value:1},
 uA2C:{value:A2C?1:0},uDepth:{value:.8},
};
const LIGHT={key:new THREE.Vector3(-.6,.7,.6).normalize(),rim:new THREE.Vector3(.8,.3,-.5).normalize()};

/* background + post passes */
const bgScene=new THREE.Scene(),ortho=new THREE.OrthographicCamera(-1,1,1,-1,0,2);ortho.position.z=1;
const bgMat=new THREE.ShaderMaterial({uniforms:{uC0:{value:new THREE.Vector3()},uC1:{value:new THREE.Vector3()},uCur:{value:new THREE.Vector2(.5,.5)},uCurI:{value:0},uAlpha:{value:1},uTime:G.uTime,uRes:{value:new THREE.Vector2(1,1)}},
  vertexShader:BGV,fragmentShader:BGF,transparent:true,depthTest:false,depthWrite:false});
const bgMesh=new THREE.Mesh(new THREE.PlaneGeometry(2,2),bgMat);bgMesh.frustumCulled=false;bgScene.add(bgMesh);
const postScene=new THREE.Scene();
const postMat=new THREE.ShaderMaterial({uniforms:{uTime:G.uTime,uGrain:{value:.06},uVig:{value:.35}},vertexShader:BGV,fragmentShader:POSTF,transparent:true,depthTest:false,depthWrite:false});
const postMesh=new THREE.Mesh(new THREE.PlaneGeometry(2,2),postMat);postMesh.frustumCulled=false;postScene.add(postMesh);
/* signature texture (drawn into WebGL so it exports with the video) */
const sigCv=document.createElement('canvas');sigCv.width=1024;sigCv.height=64;
(()=>{const c=sigCv.getContext('2d');c.font='600 30px "Space Grotesk",sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillStyle='#fff';
 if('letterSpacing' in c)c.letterSpacing='10px';c.fillText('CREATED WITH TYPECRAFT',512,34)})();
const sigTex=new THREE.CanvasTexture(sigCv);
const sigMat=new THREE.MeshBasicMaterial({map:sigTex,transparent:true,opacity:0,depthTest:false,depthWrite:false});
const sigMesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),sigMat);sigMesh.frustumCulled=false;postScene.add(sigMesh);
function layoutSig(){const wN=.6,wPx=wN/2*V.cw,hPx=wPx*64/1024;sigMesh.scale.set(wN,2*hPx/V.ch,1);sigMesh.position.set(0,-.86,0)}

/* ---- point clouds (CPU sim, GPU render) ---- */
const CLOUDS=[];
class PointCloud{
  constructor(n,size){
    this.n=n;this.pos=new Float32Array(n*3);this.size=new Float32Array(n).fill(size);this.alpha=new Float32Array(n);this.mix=new Float32Array(n);
    for(let i=0;i<n;i++)this.mix[i]=Math.random();
    const g=new THREE.BufferGeometry();this.geo=g;
    const dyn=a=>new THREE.BufferAttribute(a,a===this.pos?3:1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position',dyn(this.pos));g.setAttribute('aSize',dyn(this.size));g.setAttribute('aA',dyn(this.alpha));g.setAttribute('aMix',new THREE.BufferAttribute(this.mix,1));
    this.mat=new THREE.ShaderMaterial({uniforms:{uScale:{value:600},uOpacity:{value:1},uCA:{value:new THREE.Vector3(1,1,1)},uCB:{value:new THREE.Vector3(1,1,1)}},vertexShader:PV,fragmentShader:PF,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});
    this.obj=new THREE.Points(g,this.mat);this.obj.frustumCulled=false;this.keys=['c1','glow'];
    CLOUDS.push(this);
  }
  upload(){const a=this.geo.attributes;a.position.needsUpdate=true;a.aA.needsUpdate=true;a.aSize.needsUpdate=true}
  setCount(c){this.geo.setDrawRange(0,c)}
}
function paintCloud(c){
  const p=PALS[S.palette],k=p.light?['c0','glow']:c.keys;
  c.mat.uniforms.uCA.value.set(...p.v[k[0]]);c.mat.uniforms.uCB.value.set(...p.v[k[1]]);
  c.mat.blending=p.light?THREE.NormalBlending:THREE.AdditiveBlending;c.mat.needsUpdate=true;
}

/* ---- geometry: stacked layers of a 21x21 node grid ---- */
function makePlaneGeo(L){
  const n=NODES,per=n*n,pos=new Float32Array(per*L*3),uv=new Float32Array(per*L*2),lay=new Float32Array(per*L),idx=[];
  for(let l=0;l<L;l++)for(let j=0;j<n;j++)for(let i=0;i<n;i++){
    const k=l*per+j*n+i,u=i/(n-1),v=j/(n-1);
    pos[k*3]=u-.5;pos[k*3+1]=v-.5;uv[k*2]=u;uv[k*2+1]=v;lay[k]=L>1?l/(L-1):0;
  }
  for(let l=L-1;l>=0;l--)for(let j=0;j<n-1;j++)for(let i=0;i<n-1;i++){
    const a=l*per+j*n+i,b=a+1,c=a+n,d=c+1;idx.push(a,b,d,a,d,c);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('uv',new THREE.BufferAttribute(uv,2));g.setAttribute('aLayer',new THREE.BufferAttribute(lay,1));
  g.setIndex(new THREE.BufferAttribute(new Uint16Array(idx),1));return g;
}
const GEO={main:null,one:makePlaneGeo(1),shard:makePlaneGeo(SHLAYERS),layers:0};
function ensureGeo(){const L=Q[S.quality].layers;if(GEO.layers!==L){if(GEO.main)GEO.main.dispose();GEO.main=makePlaneGeo(L);GEO.layers=L;return true}return false}
ensureGeo();

/* ---- viewport / resize ---- */
function layoutViewport(){
  const aw=innerWidth,ah=innerHeight;let w=aw,h=ah,l=0,t=0;
  if(V.exp){
    const ew=V.exp.w,eh=V.exp.h;renderer.setPixelRatio(1);renderer.setSize(ew,eh,false);
    const sc=Math.min(aw*.94/ew,ah*.94/eh);w=ew*sc;h=eh*sc;l=(aw-w)/2;t=(ah-h)/2;
  }else{
    if(S.frame>0){h=ah*.82;w=h*S.frame;if(w>aw*.94){w=aw*.94;h=w/S.frame}l=(aw-w)/2;t=Math.max(0,(ah-h)/2-10)}
    const pr=Math.min(devicePixelRatio||1,Q[S.quality].pr);renderer.setPixelRatio(pr);renderer.setSize(Math.round(w),Math.round(h),false);
  }
  for(const c of [canvas,hudC]){c.style.left=l+'px';c.style.top=t+'px';c.style.width=w+'px';c.style.height=h+'px'}
  const dpr=Math.min(devicePixelRatio||1,2);hudC.width=Math.round(w*dpr);hudC.height=Math.round(h*dpr);hctx.setTransform(dpr,0,0,dpr,0,0);
  V.cw=w;V.ch=h;V.left=l;V.top=t;V.aspect=w/h;
  const cv=computeView(V.aspect);V.H=cv.H;V.W=cv.W;V.dist=cv.dist;
  camera.aspect=V.aspect;camera.updateProjectionMatrix();
  bgMat.uniforms.uRes.value.set(w,h);layoutSig();
  const dock=$('#tl.on')||$('#dock');
  if(dock&&$('#ui').classList.contains('on')){const r=dock.getBoundingClientRect();V.uiBottom=clamp((ah-r.top-t)/h*V.H+.25,.25,V.H*.4)}else V.uiBottom=.35;
}

/* ---- camera ---- */
const _v=new THREE.Vector3(),_m=new THREE.Matrix4();
function updateCamera(dt,t,ptr){
  const calm=S.calm?.3:1;let az=0,el=0;
  if(S.camMode==='drift'){az=Math.sin(t*.21)*.07*calm;el=Math.sin(t*.17+1)*.035*calm}
  else if(S.camMode==='orbit'){az=Math.sin(t*.35)*.5*calm;el=Math.sin(t*.23)*.12*calm}
  else if(S.camMode==='follow'){az=ptr.nx*.16*calm;el=-ptr.ny*.1*calm}
  az+=CAM.extraAz;
  const k=1-Math.exp(-dt*3),k2=1-Math.exp(-dt*2.4);
  CAM.az+=(az-CAM.az)*k;CAM.el+=(el-CAM.el)*k;CAM.dist+=(CAM.goalDist-CAM.dist)*k2;
  CAM.tx+=(CAM.goalTx-CAM.tx)*k2;CAM.ty+=(CAM.goalTy-CAM.ty)*k2;CAM.shake*=Math.exp(-dt*4.5);
  const D=V.dist*CAM.dist*CAM.fit*CAM.extraDist,sh=S.calm?0:CAM.shake;
  camera.position.set(CAM.tx+Math.sin(CAM.az)*Math.cos(CAM.el)*D+(Math.random()-.5)*sh*.35,CAM.ty+Math.sin(CAM.el)*D+(Math.random()-.5)*sh*.35,Math.cos(CAM.az)*Math.cos(CAM.el)*D);
  camera.lookAt(CAM.tx,CAM.ty,0);finishCamera();
}
function finishCamera(){camera.updateMatrixWorld();camera.matrixWorldInverse.copy(camera.matrixWorld).invert()}
function updateLights(cx,cy,curOn){
  G.uKeyD.value.copy(LIGHT.key).transformDirection(camera.matrixWorldInverse);
  G.uRimD.value.copy(LIGHT.rim).transformDirection(camera.matrixWorldInverse);
  G.uKeyI.value=S.keyI;G.uRimI.value=S.rimI;G.uAmbI.value=S.ambI;
  _v.set(cx,cy,4.5);group.localToWorld(_v);_v.applyMatrix4(camera.matrixWorldInverse);G.uCurP.value.copy(_v);
  G.uCurI.value=curOn?1.4:0;
}
/* pointer ray -> point on plane z=z0 in group-local space */
const _o=new THREE.Vector3(),_d=new THREE.Vector3(),_inv=new THREE.Matrix4();
function screenToLocal(cx,cy,z0){
  const r=canvas.getBoundingClientRect(),nx=(cx-r.left)/r.width*2-1,ny=-((cy-r.top)/r.height*2-1);
  _o.copy(camera.position);_d.set(nx,ny,.5).unproject(camera).sub(_o).normalize();
  _inv.copy(group.matrixWorld).invert();
  const o=_o.clone().applyMatrix4(_inv),e=_o.clone().add(_d).applyMatrix4(_inv),d=e.sub(o);
  const t=(z0-o.z)/(Math.abs(d.z)<1e-6?1e-6:d.z);
  return{x:o.x+d.x*t,y:o.y+d.y*t,nx,ny};
}
function projectLocal(x,y,z){
  _v.set(x,y,z);group.localToWorld(_v);_v.project(camera);
  return{x:(_v.x*.5+.5)*V.cw,y:(-_v.y*.5+.5)*V.ch};
}
function applyPalette(){
  const p=PALS[S.palette];
  bgMat.uniforms.uC0.value.set(...p.v.bg0);bgMat.uniforms.uC1.value.set(...p.v.bg1);
  const rt=document.documentElement.style,[r,g,b]=hexRGB(p.ui);rt.setProperty('--acc',p.ui);
  rt.setProperty('--acc-ink',(.2126*r+.7152*g+.0722*b)>.55?'#05070b':'#ffffff');
  for(const c of CLOUDS)paintCloud(c);
  for(const l of letters)l.refreshMaterial();
}
