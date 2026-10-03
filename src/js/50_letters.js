/* ===================== LETTERS: physical objects with deformable meshes ===================== */
const SH={lx:-3,ly:6,lz:9,on:true};
const COPY_KEYS=['uTex','uDisp','uSize','uMat','uSeed','uCrack','uPixelN','uGlitch','uSdfW','uBevel','uDepthK','uC0','uC1','uC2','uGlow'];
const isBlended=id=>id==='glass'||id==='ice'||id==='smoke';
const SHADOW_I={chrome:.55,glass:.28,liquid:.5,paper:.6,rubber:.55,ice:.32,smoke:.12,pixel:.5,neon:0};
class Letter{
  constructor(i){
    this.idx=i;this.mat=Math.max(0,MATS.indexOf(S.material));
    this.x=0;this.y=0;this.vx=0;this.vy=0;this.rz=0;this.wz=0;this.z=0;this.vz=0;this.rx=0;this.ry=0;this.wx=0;this.wy=0;
    this.hx=.5;this.hy=.5;this.mass=1;this.I=1;this.homeX=0;this.homeY=0;this.fs=1;this.ax=0;this.ay=0;this.aw=0;this.hsx=1;
    this.ox=0;this.oy=0;this.oz=0;this.orz=0;this.orx=0;this.ory=0;this.osx=1;this.osy=1;
    this.fx=0;this.fy=0;this.fz=0;this.frx=0;this.fry=0;this.frz=0;this.fsx=1;this.fsy=1;
    this.alpha=1;this.dissolve=0;this.dissolveTarget=0;this.dissolveRate=2;this.crack=0;this.melt=0;this.meltTarget=0;this.wob=0;
    this.sq=0;this.sqv=0;this.sqx=0;this.pop=1;this.popT=1;this.popDelay=0;
    this.hidden=false;this.broken=false;this.contact=0;this.grabbed=false;this.shards=0;this.seed=Math.random()*100;this.g=null;
    const n=NODES;
    this.D=new Float32Array(n*n*3);this.DV=new Float32Array(n*n*3);this.tex4=new Float32Array(n*n*4);
    this.dispTex=new THREE.DataTexture(this.tex4,n,n,THREE.RGBAFormat,THREE.FloatType);
    this.dispTex.minFilter=this.dispTex.magFilter=THREE.NearestFilter;this.dispTex.generateMipmaps=false;this.dispTex.needsUpdate=true;
    this.defActive=false;this.defAwake=false;this.rebuildBoost=0;this.sculpting=false;
    const v3=()=>({value:new THREE.Vector3()});
    this.U={
      uTex:{value:null},uDisp:{value:this.dispTex},uSize:{value:new THREE.Vector2(1,1)},uLayers:{value:GEO.layers},uStride:{value:1},
      uMat:{value:this.mat},uSeed:{value:this.seed},uAlpha:{value:1},uDissolve:{value:0},uCrack:{value:0},uPixelN:{value:16},uGlitch:{value:0},
      uSdfW:{value:.3},uBevel:{value:.1},uWobble:{value:0},uMelt:{value:0},uDepthK:{value:1},uBlur:{value:.1},uShadowI:{value:.5},
      uC0:v3(),uC1:v3(),uC2:v3(),uGlow:v3(),
      uTime:G.uTime,uKeyD:G.uKeyD,uRimD:G.uRimD,uKeyI:G.uKeyI,uRimI:G.uRimI,uAmbI:G.uAmbI,uCurP:G.uCurP,uCurI:G.uCurI,uA2C:G.uA2C,uDepth:G.uDepth,
    };
    const ext={derivatives:true};
    this.matl=new THREE.ShaderMaterial({uniforms:this.U,vertexShader:VERT,fragmentShader:FRAG,side:THREE.DoubleSide,extensions:ext});
    this.shmat=new THREE.ShaderMaterial({uniforms:this.U,vertexShader:VERT,fragmentShader:FRAG_SH,side:THREE.DoubleSide,transparent:true,depthWrite:false,extensions:ext});
    this.mesh=new THREE.Mesh(GEO.main,this.matl);this.mesh.frustumCulled=false;
    this.shadow=new THREE.Mesh(GEO.one,this.shmat);this.shadow.frustumCulled=false;this.shadow.renderOrder=-5;
    group.add(this.mesh);group.add(this.shadow);
    this.refreshMaterial();
  }
  get mp(){return MP[MATS[this.mat]]}
  refreshMaterial(){
    const id=MATS[this.mat],mp=MP[id],U=this.U,p=PALS[S.palette].v,m=this.matl;
    U.uMat.value=this.mat;U.uC0.value.set(...p.c0);U.uC1.value.set(...p.c1);U.uC2.value.set(...p.c2);U.uGlow.value.set(...p.glow);
    U.uBevel.value=mp.bev*this.fs;U.uDepthK.value=id==='paper'?.12:1;U.uLayers.value=GEO.layers;U.uShadowI.value=SHADOW_I[id];
    U.uStride.value=(isBlended(id)||id==='neon')?4:1;
    if(id==='neon'){m.transparent=true;m.blending=THREE.AdditiveBlending;m.depthWrite=false;m.alphaToCoverage=false}
    else if(isBlended(id)){m.transparent=true;m.blending=THREE.NormalBlending;m.depthWrite=false;m.alphaToCoverage=false}
    else{m.transparent=false;m.blending=THREE.NormalBlending;m.depthWrite=true;m.alphaToCoverage=A2C}
    this.mesh.geometry=GEO.main;
    this.mass=mp.m*clamp(this.hx*this.hy*4/1.4,.5,2.6);this.I=this.mass*(this.hx*this.hx+this.hy*this.hy)/3;
  }
  setGlyph(g,fs,hx,hy){
    this.g=g;this.fs=fs;this.homeX=hx;this.homeY=hy;const U=this.U;
    U.uTex.value=g.tex;U.uSize.value.set(g.qw*fs,g.qh*fs);U.uSdfW.value=2*SPREAD_EM*fs;
    this.hx=Math.max(.12,g.iw*fs*.44);this.hy=Math.max(.12,g.ih*fs*.44);this.rad=Math.hypot(this.hx,this.hy);
    this.refreshMaterial();
  }
  spawn(delay){this.popT=0;this.popDelay=delay;this.pop=0}
  /* ---- deformation grid ---- */
  stepDeform(dt){
    if(this.rebuildBoost>0)this.rebuildBoost-=dt;
    if(!this.defAwake)return;
    const n=NODES,D=this.D,Vv=this.DV,mp=this.mp,boost=this.rebuildBoost>0;
    const rest=boost?70:Math.max(mp.kmin||0,(20*Math.pow(1-S.memory,3)+.02)*mp.dk),damp=boost?18:mp.dc,kn=mp.soft?12:5,h=Math.min(dt,1/30);
    for(let j=0;j<n;j++)for(let i=0;i<n;i++){
      const k=(j*n+i)*3,iL=(j*n+Math.max(0,i-1))*3,iR=(j*n+Math.min(n-1,i+1))*3,jU=(Math.min(n-1,j+1)*n+i)*3,jD=(Math.max(0,j-1)*n+i)*3;
      for(let c=0;c<3;c++){const lap=(D[iL+c]+D[iR+c]+D[jU+c]+D[jD+c])*.25-D[k+c];Vv[k+c]+=(-rest*D[k+c]-damp*Vv[k+c]+kn*lap)*h}
    }
    let ev=0,ed=0;
    for(let k=0;k<n*n*3;k++){D[k]+=Vv[k]*h;ev+=Math.abs(Vv[k]);ed+=Math.abs(D[k])}
    this.uploadDeform();
    if(ev<n*n*3*2e-3&&!this.sculpting){
      this.defAwake=false;
      if(ed<n*n*3*4e-3){D.fill(0);Vv.fill(0);this.defActive=false;this.uploadDeform()}
    }
  }
  uploadDeform(){
    const n=NODES,D=this.D,t=this.tex4;
    for(let k=0;k<n*n;k++){t[k*4]=D[k*3];t[k*4+1]=D[k*3+1];t[k*4+2]=D[k*3+2]}
    this.dispTex.needsUpdate=true;
  }
  wake(){this.defActive=true;this.defAwake=true}
  /* brush op in letter-local space; (gx,gy) local "down" */
  sculpt(tool,cx,cy,vx,vy,R,dt,gain,gx,gy){
    const n=NODES,D=this.D,Vv=this.DV,qw=this.U.uSize.value.x,qh=this.U.uSize.value.y,R2=R*R,lim=Math.max(qw,qh)*.9;
    for(let j=0;j<n;j++)for(let i=0;i<n;i++){
      const k=(j*n+i)*3,px=(i/(n-1)-.5)*qw+D[k],py=(j/(n-1)-.5)*qh+D[k+1],dx=px-cx,dy=py-cy,d2=dx*dx+dy*dy;
      if(d2>R2)continue;
      const d=Math.sqrt(d2),f=1-d/R,w=f*f*(3-2*f),ii=d>1e-4?1/d:0;
      switch(tool){
        case 'push':D[k]+=vx*dt*w*gain*.9+dx*ii*dt*w*.8;D[k+1]+=vy*dt*w*gain*.9+dy*ii*dt*w*.8;break;
        case 'pull':D[k]-=dx*w*dt*4*gain;D[k+1]-=dy*w*dt*4*gain;break;
        case 'twist':{const a=w*dt*4.5*gain,c=Math.cos(a),s=Math.sin(a);D[k]+=dx*c-dy*s-dx;D[k+1]+=dx*s+dy*c-dy;break}
        case 'inflate':D[k]+=dx*ii*w*dt*2.4*gain;D[k+1]+=dy*ii*w*dt*2.4*gain;D[k+2]+=w*dt*.7*gain;break;
        case 'pinch':D[k]-=dx*w*dt*3.4*gain;D[k+1]-=dy*w*dt*3.4*gain;D[k+2]-=w*dt*.3*gain;break;
        case 'melt':D[k]+=gx*w*dt*2.6*gain+dx*w*dt*.5;D[k+1]+=gy*w*dt*2.6*gain;break;
      }
      for(let c=0;c<3;c++){const m=lim*(c===2?.5:1);if(D[k+c]>m)D[k+c]=m;else if(D[k+c]<-m)D[k+c]=-m}
    }
    this.wake();
  }
  /* soft impact dent near a local point */
  poke(cx,cy,nx,ny,mag){
    const n=NODES,Vv=this.DV,qw=this.U.uSize.value.x,qh=this.U.uSize.value.y,R=Math.max(qw,qh)*.5,R2=R*R,D=this.D;
    for(let j=0;j<n;j++)for(let i=0;i<n;i++){
      const k=(j*n+i)*3,dx=(i/(n-1)-.5)*qw-cx,dy=(j/(n-1)-.5)*qh-cy,d2=dx*dx+dy*dy;if(d2>R2)continue;
      const f=1-Math.sqrt(d2)/R;Vv[k]-=nx*mag*f*f;Vv[k+1]-=ny*mag*f*f;
    }
    this.wake();
  }
  restore(){this.rebuildBoost=.9;this.crack=0;this.meltTarget=0;if(this.defActive)this.defAwake=true}
  /* ---- per-frame visual ---- */
  updateVisual(dt){
    if(this.popT<1){if(this.popDelay>0)this.popDelay-=dt;else this.popT=Math.min(1,this.popT+dt/.55);this.pop=this.popDelay>0?0:EASE.back(this.popT)}else this.pop=1;
    if(this.dissolve!==this.dissolveTarget){const d=this.dissolveTarget-this.dissolve,st=this.dissolveRate*dt;this.dissolve=Math.abs(d)<=st?this.dissolveTarget:this.dissolve+Math.sign(d)*st}
    this.melt+=(this.meltTarget-this.melt)*(1-Math.exp(-dt*1.6));
    const mp=this.mp,id=MATS[this.mat],k=mp.soft?(id==='rubber'?260:id==='liquid'?60:140):420,c=mp.soft?(id==='liquid'?4.5:id==='rubber'?7:9):26;
    this.sqv+=(-k*this.sq-c*this.sqv)*dt;this.sq=clamp(this.sq+this.sqv*dt,-.6,.6);
    const sp=Math.hypot(this.vx,this.vy);this.wob+=((mp.wob*(.25+Math.min(1,sp*.06)))-this.wob)*(1-Math.exp(-dt*5));
    this.stepDeform(dt);
    this.fx=this.x+this.ox;this.fy=this.y+this.oy;this.fz=this.z+this.oz;
    this.frx=this.rx+this.orx;this.fry=this.ry+this.ory;this.frz=this.rz+this.orz;
    this.fsx=this.osx*(1+this.sq*this.sqx)*this.pop;this.fsy=this.osy*(1-this.sq*this.sqx)*this.pop;
    this.U.uWobble.value=this.wob;this.U.uGlitch.value=S.motion.glitch;
    this.pushMesh();
  }
  pushMesh(){
    const m=this.mesh,U=this.U,vis=!this.hidden&&this.alpha>.001&&this.pop>.001;
    m.visible=vis;m.position.set(this.fx,this.fy,this.fz);m.rotation.set(this.frx,this.fry,this.frz);m.scale.set(this.fsx,this.fsy,1);
    U.uAlpha.value=this.alpha;U.uDissolve.value=this.dissolve;U.uCrack.value=this.crack;U.uMelt.value=this.melt;
    const sd=this.shadow,ok=SH.on&&vis&&U.uShadowI.value>0;sd.visible=ok;
    if(ok){
      const zp=-(G.uDepth.value*.5+.4),t=(zp-SH.lz)/(this.fz-SH.lz);
      sd.position.set(SH.lx+(this.fx-SH.lx)*t,SH.ly+(this.fy-SH.ly)*t,zp);sd.rotation.set(this.frx,this.fry,this.frz);sd.scale.set(this.fsx*t,this.fsy*t,1);
      U.uBlur.value=clamp(.05+(this.fz-zp)*.03,.05,.3);
    }
  }
  dispose(){group.remove(this.mesh);group.remove(this.shadow);this.matl.dispose();this.shmat.dispose();this.dispTex.dispose()}
}

/* ===================== SHARDS ===================== */
const shardPool=[],shardsLive=[],shardDefs=[];
function makeShardUniforms(){
  const u={uLayers:{value:SHLAYERS},uStride:{value:1},uAlpha:{value:1},uDissolve:{value:0},uWobble:{value:0},uMelt:{value:0},uGlitch:{value:0},
    uSeeds:{value:Array.from({length:8},()=>new THREE.Vector2())},uCell:{value:0},uCentroid:{value:new THREE.Vector2()},
    uTime:G.uTime,uKeyD:G.uKeyD,uRimD:G.uRimD,uKeyI:G.uKeyI,uRimI:G.uRimI,uAmbI:G.uAmbI,uCurP:G.uCurP,uCurI:G.uCurI,uA2C:G.uA2C,uDepth:G.uDepth};
  for(const k of COPY_KEYS)u[k]={value:null};
  return u;
}
function acquireShardMesh(){
  let s=shardPool.pop();
  if(!s){
    const u=makeShardUniforms();
    const mat=new THREE.ShaderMaterial({uniforms:u,vertexShader:VERT,fragmentShader:FRAG,defines:{SHARD:1},side:THREE.DoubleSide,extensions:{derivatives:true}});
    const mesh=new THREE.Mesh(GEO.shard,mat);mesh.frustumCulled=false;group.add(mesh);s={mesh,mat,u,letter:null};
  }
  s.mesh.visible=true;return s;
}
function releaseShardMesh(s){s.mesh.visible=false;s.letter=null;shardPool.push(s)}
function syncShardMesh(s,alpha){
  const l=s.letter,lu=l.U,m=s.mat,lm=l.matl;
  for(const k of COPY_KEYS)s.u[k].value=lu[k].value;
  s.u.uAlpha.value=alpha*l.alpha;m.transparent=lm.transparent;m.blending=lm.blending;m.depthWrite=lm.depthWrite;m.alphaToCoverage=lm.alphaToCoverage;
}
function bindShard(s,letter,def,cell){
  for(let i=0;i<8;i++)s.u.uSeeds.value[i].set(def.seeds[i*2],def.seeds[i*2+1]);
  s.u.uCell.value=cell;s.u.uCentroid.value.set(def.cents[cell*2],def.cents[cell*2+1]);s.letter=letter;syncShardMesh(s,1);
}
/* voronoi cells seeded on the glyph's ink, so each shard has real material */
function makeDef(l,origin){
  const g=l.g,fs=l.fs,K=8,pts=[];
  for(let i=0;i<260;i++){const o=((Math.random()*g.inkN)|0)*2;pts.push([((g.ink[o]+.5)-g.tw/2)/g.pp*fs,(g.th/2-(g.ink[o+1]+.5))/g.pp*fs])}
  const seeds=[];for(let k=0;k<K;k++)seeds.push(k===0&&origin?[origin[0],origin[1]]:pts[(Math.random()*pts.length)|0].slice());
  const cents=seeds.map(s=>s.slice());
  for(let it=0;it<3;it++){
    const sum=seeds.map(()=>[0,0,0]);
    for(const p of pts){let b=0,bd=1e9;for(let k=0;k<K;k++){const d=(p[0]-seeds[k][0])**2+(p[1]-seeds[k][1])**2;if(d<bd){bd=d;b=k}}sum[b][0]+=p[0];sum[b][1]+=p[1];sum[b][2]++}
    for(let k=0;k<K;k++)if(sum[k][2]>0){cents[k]=[sum[k][0]/sum[k][2],sum[k][1]/sum[k][2]];if(!(k===0&&origin&&it<2))seeds[k]=cents[k].slice()}
  }
  const def={id:shardDefs.length,letterIdx:l.idx,seeds:new Float32Array(K*2),cents:new Float32Array(K*2)};
  for(let k=0;k<K;k++){def.seeds[k*2]=seeds[k][0];def.seeds[k*2+1]=seeds[k][1];def.cents[k*2]=cents[k][0];def.cents[k*2+1]=cents[k][1]}
  shardDefs.push(def);return def;
}
function breakLetter(l,ox,oy,power,life,localOrigin){
  if(l.broken||!l.g||l.g.blank||l.hidden&&!l.broken&&l.dissolve>.9)return;
  const def=makeDef(l,localOrigin),c=Math.cos(l.frz),s=Math.sin(l.frz);
  l.broken=true;l.hidden=true;l.shards=8;
  for(let k=0;k<8;k++){
    const cx=def.cents[k*2],cy=def.cents[k*2+1],wx=l.fx+(c*cx*l.fsx-s*cy*l.fsy),wy=l.fy+(s*cx*l.fsx+c*cy*l.fsy);
    const sm=acquireShardMesh();bindShard(sm,l,def,k);
    let dx=wx-ox,dy=wy-oy;const d=Math.hypot(dx,dy)||1;dx/=d;dy/=d;
    shardsLive.push({l,def,cell:k,sm,x:wx,y:wy,z:l.fz,vx:l.vx+dx*power*rr(.6,1.4)+rr(-1,1),vy:l.vy+dy*power*rr(.6,1.4)+rr(-1,1)+power*.15,vz:rr(-1,2)*power*.12,
      rz:l.frz,wz:rr(-5,5)*power*.15,rx:l.frx,wx:rr(-3,3)*power*.12,ry:l.fry,wy:rr(-3,3)*power*.12,alpha:1,age:0,life:life||0,ret:false,cx:cx,cy:cy});
  }
  Snd.shatter();
}
function rebuildLetter(l){
  l.restore();
  if(l.broken)for(const sh of shardsLive)if(sh.l===l)sh.ret=true;
}
function clearShards(){
  for(const sh of shardsLive)releaseShardMesh(sh.sm);
  shardsLive.length=0;for(const l of letters){l.broken=false;l.shards=0}
}
