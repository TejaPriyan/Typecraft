/* ===================== PHYSICS ===================== */
const PTR={x:0,y:0,px:0,py:0,vx:0,vy:0,speed:0,down:false,present:false,sx:0,sy:0,nx:0,ny:0,auto:false,lastDown:0,downSpeed:0};
const Fx={phase:null,clock:0,springBoost:1,cx:0,cy:0,wx:0,wy:0,hero:false,broken:false,breaking:false,rebuilding:false};
const GRAB={list:[],group:false};
const SEL=new Set();
const WB={l:-8,r:8,b:-5,t:5};
function updateBounds(){WB.l=-V.W/2+.12;WB.r=V.W/2-.12;WB.t=V.H/2-.12;WB.b=-V.H/2+V.uiBottom}

function forces(dt,t){
  const P=PTR,F=S.force*(S.calm?.55:1),n=letters.length,mode=S.physics;
  if(mode==='wind'){Fx.wx+=P.vx*dt*3.5;Fx.wy+=P.vy*dt*3.5;Fx.wx*=Math.exp(-dt*1.2);Fx.wy*=Math.exp(-dt*1.2)}
  for(let i=0;i<n;i++){
    const l=letters[i];if(l.broken)continue;
    const mp=l.mp,dx=l.x-P.x,dy=l.y-P.y,d=Math.hypot(dx,dy)+1e-4;let hk=0,hc=0,rk=0,rc=0;
    if(Fx.phase){phaseForce(l,i,dt);continue}
    switch(mode){
      case 'still':{
        hk=70;hc=9;rk=60;rc=8;
        if(P.present&&!l.grabbed){const R=(Fx.hero?3:2.4)+Math.min(P.speed*.05,2.2);
          if(d<R){const f=1-d/R,a=f*f*(Fx.hero?30:11+P.speed*.4)*F;l.ax+=dx/d*a;l.ay+=dy/d*a;l.aw+=((dx*P.vy-dy*P.vx)/d)*f*.05*F}}
        break}
      case 'gravity':{
        l.ay-=S.gravity*mp.g;
        if(mp.flt&&l.vy<-1){l.ax+=Math.sin(t*9+l.seed)*9;l.aw+=Math.cos(t*7+l.seed)*7}
        break}
      case 'magnet':{
        if(P.present){const k=(P.down?11:4.5)*F;l.ax+=-dx*k-l.vx*3;l.ay+=-dy*k-l.vy*3;l.aw+=-l.wz*2}
        else{l.ax+=(l.homeX-l.x)*8-l.vx*4;l.ay+=(l.homeY-l.y)*8-l.vy*4}
        break}
      case 'repulse':{
        hk=40;hc=6;rk=40;rc=6;
        if(P.present&&!l.grabbed){const R=3.4+P.speed*.08;if(d<R){const f=1-d/R,a=f*f*(26+P.speed*.9)*F*(P.down?1.8:1);l.ax+=dx/d*a;l.ay+=dy/d*a;l.aw+=((dx*P.vy-dy*P.vx)/d)*f*.06*F}}
        break}
      case 'orbit':{
        const th=t*.8+i*TAU/Math.max(1,n),Rr=2.4+(i%3)*.8,cx=P.present?P.x:0,cy=P.present?P.y:0;
        l.ax+=(cx+Math.cos(th)*Rr-l.x)*40-l.vx*8;l.ay+=(cy+Math.sin(th)*Rr-l.y)*40-l.vy*8;
        l.aw+=wrapPI(th+Math.PI/2-l.rz)*20-l.wz*4;break}
      case 'wind':{
        hk=3.5;hc=.8;const w=mp.wind;
        l.ax+=(Fx.wx*2.2-l.vx*.4)*w;l.ay+=(Fx.wy*2.2-l.vy*.4)*w;l.aw+=Fx.wx*.05*Math.sin(t*7+l.seed)*w-l.wz*.3;break}
      case 'float':{
        hk=5;hc=1.4;rk=6;rc=1.2;
        l.ax+=nz(t*.35+i,l.y*.3,l.seed)*2.6;l.ay+=nz(t*.31,l.x*.3+i,l.seed+9)*2.6;l.aw+=nz(t*.4+i*2,0,l.seed)*1.4;
        if(P.present&&d<2.4){const f=1-d/2.4;l.ax+=dx/d*f*f*6;l.ay+=dy/d*f*f*6}
        break}
      case 'chaos':{
        hk=7;hc=1.3;rk=4;rc=1;
        l.ax+=(Math.sin(t*2.3+l.seed)+Math.sin(t*5.1+l.seed*2))*7*F;l.ay+=(Math.cos(t*2.9+l.seed*1.3)+Math.sin(t*4.3+l.seed))*7*F;l.aw+=Math.sin(t*3.7+l.seed*3)*5*F;
        break}
    }
    if(hk>0){
      const k=hk*mp.hs*l.hsx*Fx.springBoost,c=hc*Math.sqrt(mp.hs);
      l.ax+=(l.homeX-l.x)*k-l.vx*c;l.ay+=(l.homeY-l.y)*k-l.vy*c;
      l.aw+=-wrapPI(l.rz)*rk*mp.hs-l.wz*rc;
    }
  }
}
function phaseForce(l,i,dt){
  const t=Fx.clock;
  switch(Fx.phase){
    case 'sep':{const dx=l.x-Fx.cx,dy=l.y-Fx.cy,d=Math.hypot(dx,dy)+.1;l.ax+=dx/d*7;l.ay+=dy/d*7;l.aw+=Math.sin(l.seed)*2;break}
    case 'float':{l.ax+=nz(t*.6+i,l.y*.3,l.seed)*3;l.ay+=nz(t*.5,l.x*.3+i,l.seed+9)*3;l.aw+=nz(t*.7+i,0,l.seed)*1.5;break}
    case 'free':{l.ax+=nz(t*.5+i,l.y*.3,l.seed)*2;l.ay+=nz(t*.4,l.x*.3+i,l.seed+9)*2-(S.physics==='gravity'?S.gravity*.6:0);break}
    case 'rebuild':{
      if(t<(l.rbAt||0))break;
      const k=90*Fx.springBoost,c=2*Math.sqrt(k)*.75;
      l.ax+=(l.homeX-l.x)*k-l.vx*c;l.ay+=(l.homeY-l.y)*k-l.vy*c;l.aw+=-wrapPI(l.rz)*70-l.wz*12;break}
  }
}
function grabForces(dt){
  if(!GRAB.list.length)return;
  const P=PTR;
  for(const gi of GRAB.list){
    const l=gi.l;if(l.broken)continue;
    if(GRAB.group){
      l.ax+=(P.x+gi.ox-l.x)*220-l.vx*24;l.ay+=(P.y+gi.oy-l.y)*220-l.vy*24;l.aw+=-wrapPI(l.rz)*30-l.wz*8;
    }else{
      const c=Math.cos(l.rz),s=Math.sin(l.rz),rx=c*gi.gx-s*gi.gy,ry=s*gi.gx+c*gi.gy;
      const vpx=l.vx-l.wz*ry,vpy=l.vy+l.wz*rx;
      const fx=clamp((P.x-(l.x+rx))*220-vpx*22,-900,900),fy=clamp((P.y-(l.y+ry))*220-vpy*22,-900,900);
      l.ax+=fx;l.ay+=fy;l.aw+=(rx*fy-ry*fx)/((l.I/l.mass)||.4)*.5-l.wz*7;
    }
  }
}
function integrate(dt){
  const air=S.air;
  for(const l of letters){
    if(l.broken)continue;const mp=l.mp;
    l.vx+=l.ax*dt;l.vy+=l.ay*dt;l.wz+=l.aw*dt;
    const dr=Math.exp(-(air*mp.air+.05)*dt);l.vx*=dr;l.vy*=dr;
    l.wz*=Math.exp(-(.5+air*mp.air*.6+l.contact*3)*dt);
    const sp=Math.hypot(l.vx,l.vy);if(sp>60){l.vx*=60/sp;l.vy*=60/sp}
    l.wz=clamp(l.wz,-25,25);
    l.x+=l.vx*dt;l.y+=l.vy*dt;l.rz+=l.wz*dt;
    const zt=l.grabbed?.9:0;l.vz+=(-40*(l.z-zt)-8*l.vz)*dt;l.z+=l.vz*dt;
    l.wx+=(-30*l.rx-6*l.wx)*dt;l.rx+=l.wx*dt;l.wy+=(-30*l.ry-6*l.wy)*dt;l.ry+=l.wy*dt;
  }
}
function obbTest(a,b){
  const ca=Math.cos(a.rz),sa=Math.sin(a.rz),cb=Math.cos(b.rz),sb=Math.sin(b.rz),dx=b.x-a.x,dy=b.y-a.y;
  const ax4=[ca,sa,-sa,ca,cb,sb,-sb,cb];let best=1e9,nx=0,ny=0;
  for(let k=0;k<4;k++){
    const ax=ax4[k*2],ay=ax4[k*2+1];
    const ra=a.hx*Math.abs(ax*ca+ay*sa)+a.hy*Math.abs(-ax*sa+ay*ca),rb=b.hx*Math.abs(ax*cb+ay*sb)+b.hy*Math.abs(-ax*sb+ay*cb);
    const dist=dx*ax+dy*ay,ov=ra+rb-Math.abs(dist);
    if(ov<=0)return null;
    if(ov<best){best=ov;nx=dist<0?-ax:ax;ny=dist<0?-ay:ay}
  }
  return{d:best,nx,ny};
}
function onCollide(l,nx,ny,J,px,py){
  Snd.bounce(J);
  const mp=l.mp,c=Math.cos(l.rz),s=Math.sin(l.rz),nlx=nx*c+ny*s,nly=-nx*s+ny*c;
  l.sqx=nly*nly-nlx*nlx;l.sqv+=clamp(J*(mp.soft?.9:.12),0,mp.soft?14:3);
  if(mp.soft&&J>2){const dx=px-l.x,dy=py-l.y;l.poke(dx*c+dy*s,-dx*s+dy*c,-nlx,-nly,Math.min(J*.35,4))}
  if(MATS[l.mat]==='ice'){l.crack=Math.min(1.5,l.crack+J*.035);if(J>10||l.crack>1.25)breakLetter(l,px,py,5+J*.2,0)}
  if(J>4)SP.burst(px,py,Math.min(10,J|0),Math.min(6,J*.5));
}
function pairs(){
  const n=letters.length;
  for(let i=0;i<n;i++){
    const a=letters[i];if(a.broken)continue;
    for(let j=i+1;j<n;j++){
      const b=letters[j];if(b.broken)continue;
      const dx=b.x-a.x,dy=b.y-a.y,rs=a.rad+b.rad;if(dx*dx+dy*dy>rs*rs)continue;
      const c=obbTest(a,b);if(!c)continue;
      const ia=1/a.mass,ib=1/b.mass,tot=ia+ib,cor=c.d*.8;
      a.x-=c.nx*cor*ia/tot;a.y-=c.ny*cor*ia/tot;b.x+=c.nx*cor*ib/tot;b.y+=c.ny*cor*ib/tot;
      const rvx=b.vx-a.vx,rvy=b.vy-a.vy,vn=rvx*c.nx+rvy*c.ny;
      if(vn<0){
        const e=vn>-1.5?0:clamp(S.bounce*(a.mp.e+b.mp.e)*.5,0,1.05),J=-(1+e)*vn/tot;
        a.vx-=c.nx*J*ia;a.vy-=c.ny*J*ia;b.vx+=c.nx*J*ib;b.vy+=c.ny*J*ib;
        const tx=-c.ny,ty=c.nx,vt=rvx*tx+rvy*ty,mu=Math.sqrt(a.mp.mu*b.mp.mu)*S.friction*2,jt=clamp(-vt/tot,-mu*J,mu*J);
        a.vx-=tx*jt*ia;a.vy-=ty*jt*ia;b.vx+=tx*jt*ib;b.vy+=ty*jt*ib;
        a.wz+=(Math.random()-.5)*J*.3/a.mass;b.wz+=(Math.random()-.5)*J*.3/b.mass;
        if(J>2.5){const px=(a.x+b.x)/2,py=(a.y+b.y)/2;onCollide(a,-c.nx,-c.ny,J,px,py);onCollide(b,c.nx,c.ny,J,px,py)}
      }
    }
  }
}
const WALLS=[[0,1,'b',1],[0,-1,'t',-1],[1,0,'l',1],[-1,0,'r',-1]];
function bounds(){
  for(const l of letters){
    if(l.broken)continue;
    const c=Math.cos(l.rz),s=Math.sin(l.rz),cxs=[l.hx,-l.hx,-l.hx,l.hx],cys=[l.hy,l.hy,-l.hy,-l.hy];
    for(const w of WALLS){
      const nx=w[0],ny=w[1],d=w[3]*WB[w[2]];let worst=0,rx=0,ry=0;
      for(let k=0;k<4;k++){const rxk=c*cxs[k]-s*cys[k],ryk=s*cxs[k]+c*cys[k],pen=d-(nx*(l.x+rxk)+ny*(l.y+ryk));if(pen>worst){worst=pen;rx=rxk;ry=ryk}}
      if(worst<=0)continue;
      l.x+=nx*worst;l.y+=ny*worst;
      const vpx=l.vx-l.wz*ry,vpy=l.vy+l.wz*rx,vn=vpx*nx+vpy*ny;
      if(vn<0){
        const rn=rx*ny-ry*nx,iM=1/l.mass,iI=1/l.I,den=iM+rn*rn*iI,e=vn>-1.6?0:clamp(S.bounce*l.mp.e,0,1.05),J=-(1+e)*vn/den;
        l.vx+=nx*J*iM;l.vy+=ny*J*iM;l.wz+=rn*J*iI;
        const tx=-ny,ty=nx,vt=vpx*tx+vpy*ty,rt=rx*ty-ry*tx,dT=iM+rt*rt*iI,mu=l.mp.mu*S.friction*2,jt=clamp(-vt/dT,-mu*J,mu*J);
        l.vx+=tx*jt*iM;l.vy+=ty*jt*iM;l.wz+=rt*jt*iI;l.contact=1;
        if(J>3)onCollide(l,nx,ny,J,l.x+rx,l.y+ry);
      }
    }
  }
}
function stepPhysics(dt,t){
  for(const l of letters){l.ax=0;l.ay=0;l.aw=0;l.contact=Math.max(0,l.contact-dt*4)}
  forces(dt,t);grabForces(dt);integrate(dt);
  for(let it=0;it<3;it++){pairs();bounds()}
}
/* ---- shards ---- */
function finishUnbreak(l){
  l.broken=false;l.hidden=false;l.x=l.homeX;l.y=l.homeY;l.vx=l.vy=0;l.rz=0;l.wz=0;l.z=0;l.sqx=1;l.sqv+=l.mp.soft?6:2;
  SP.burst(l.x,l.y,12,3);Snd.rebuild();
}
function stepShards(dt){
  for(let i=shardsLive.length-1;i>=0;i--){
    const s=shardsLive[i],l=s.l;s.age+=dt;
    if(!s.ret&&s.life>0&&s.age>s.life)s.ret=true;
    let done=false;
    if(s.ret){
      s.rt=(s.rt||0)+dt*1.4;const k=Math.min(1,s.rt),tx=l.homeX+s.cx,ty=l.homeY+s.cy;
      s.vx+=((tx-s.x)*(30+60*k)-s.vx*(9+5*k))*dt;s.vy+=((ty-s.y)*(30+60*k)-s.vy*(9+5*k))*dt;s.vz+=(-s.z*30-s.vz*8)*dt;
      s.wz+=(-wrapPI(s.rz)*40-s.wz*8)*dt;s.wx+=(-wrapPI(s.rx)*40-s.wx*8)*dt;s.wy+=(-wrapPI(s.ry)*40-s.wy*8)*dt;
      if(Math.hypot(tx-s.x,ty-s.y)<.07&&Math.abs(wrapPI(s.rz))<.1&&Math.abs(wrapPI(s.rx))<.1&&Math.abs(wrapPI(s.ry))<.1&&s.rt>.5)done=true;
    }else{
      if(S.physics==='gravity')s.vy-=S.gravity*dt;else{s.vy+=nz(s.age,s.x,s.cx)*1.2*dt;s.vx+=nz(s.age+3,s.y,s.cy)*1.2*dt}
      const dr=Math.exp(-(S.physics==='gravity'?.2:.9)*dt);s.vx*=dr;s.vy*=dr;s.vz*=dr;s.wz*=dr;s.wx*=dr;s.wy*=dr;
      if(s.y<WB.b+.2){s.y=WB.b+.2;if(s.vy<0){if(s.vy<-4)Snd.bounce(-s.vy);s.vy*=-.35;s.vx*=.8;s.wz*=.7}}
      if(s.y>WB.t){s.y=WB.t;s.vy=-Math.abs(s.vy)*.4}
      if(s.x<WB.l){s.x=WB.l;s.vx=Math.abs(s.vx)*.4}if(s.x>WB.r){s.x=WB.r;s.vx=-Math.abs(s.vx)*.4}
    }
    s.x+=s.vx*dt;s.y+=s.vy*dt;s.z+=s.vz*dt;s.rz+=s.wz*dt;s.rx+=s.wx*dt;s.ry+=s.wy*dt;
    if(done){releaseShardMesh(s.sm);shardsLive.splice(i,1);l.shards--;if(l.shards<=0)finishUnbreak(l);continue}
    const m=s.sm.mesh;m.position.set(s.x,s.y,s.z);m.rotation.set(s.rx,s.ry,s.rz);m.scale.set(1,1,1);syncShardMesh(s.sm,s.alpha);
  }
}
/* ---- impact ---- */
function doImpact(x,y,st){
  const R=5.4*Math.sqrt(st);
  for(const l of letters){
    if(l.broken)continue;
    const dx=l.x-x,dy=l.y-y,d=Math.hypot(dx,dy)+.3;if(d>R)continue;
    const f=1-d/R,imp=st*f*f*30/Math.sqrt(l.mass);
    l.vx+=dx/d*imp;l.vy+=dy/d*imp+imp*.12;l.wz+=(Math.random()-.5)*imp*.4;l.vz+=imp*.06;
    const c=Math.cos(l.rz),s=Math.sin(l.rz),nlx=dx/d*c+dy/d*s,nly=-dx/d*s+dy/d*c;l.sqx=nly*nly-nlx*nlx;l.sqv+=imp*(l.mp.soft?.16:.05);
    if(MATS[l.mat]==='ice'){l.crack=Math.min(1.5,l.crack+f*st*.7);if(f>.55&&st>1.1)breakLetter(l,x,y,6+st*3,0)}
  }
  for(const sh of shardsLive){const dx=sh.x-x,dy=sh.y-y,d=Math.hypot(dx,dy)+.3;if(d<R){const f=(1-d/R)**2*st*24;sh.vx+=dx/d*f;sh.vy+=dy/d*f;sh.wz+=(Math.random()-.5)*f*.5}}
  SP.burst(x,y,26,7);SP.ring(x,y,.6+st*.5);
  CAM.shake+=.45*Math.min(st,2);Snd.impact(st);
}
