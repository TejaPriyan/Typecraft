/* ===================== PARTICLES ===================== */
/* --- sparks: short-lived bursts --- */
class Sparks{
  constructor(n){
    this.n=n;this.c=new PointCloud(n,.07);this.c.keys=['glow','c1'];this.life=new Float32Array(n);this.ttl=new Float32Array(n).fill(1);
    this.vx=new Float32Array(n);this.vy=new Float32Array(n);this.vz=new Float32Array(n);this.base=new Float32Array(n).fill(.07);this.head=0;
    this.c.obj.renderOrder=12;paintCloud(this.c);
  }
  emit(x,y,z,vx,vy,vz,life,size){
    const i=this.head;this.head=(this.head+1)%this.n;
    this.c.pos[i*3]=x;this.c.pos[i*3+1]=y;this.c.pos[i*3+2]=z;this.vx[i]=vx;this.vy[i]=vy;this.vz[i]=vz;this.life[i]=life;this.ttl[i]=life;this.base[i]=size;
  }
  burst(x,y,n,speed,z){
    if(S.calm)n=Math.ceil(n*.4);
    for(let k=0;k<n;k++){const a=Math.random()*TAU,s=speed*rr(.3,1);this.emit(x,y,z||0,Math.cos(a)*s,Math.sin(a)*s,rr(-.5,.8)*s*.3,rr(.5,1.3),rr(.035,.09))}
    if(REC.on)REC.spark.push({t:REC.t,x,y,n,speed,z:z||0});
  }
  ring(x,y,r){const n=S.calm?10:34;for(let k=0;k<n;k++){const a=k/n*TAU;this.emit(x+Math.cos(a)*.1,y+Math.sin(a)*.1,0,Math.cos(a)*(4+r*4),Math.sin(a)*(4+r*4),0,.7,.06)}}
  emitSmoke(x,y){this.emit(x+rr(-.3,.3),y+rr(-.3,.3),rr(-.2,.4),rr(-.4,.4),rr(.3,1.2),0,rr(1,2),rr(.08,.16))}
  clear(){this.life.fill(0);this.c.alpha.fill(0);this.c.upload()}
  update(dt){
    const c=this.c,p=c.pos,drag=Math.exp(-dt*1.6);
    for(let i=0;i<this.n;i++){
      if(this.life[i]<=0){c.alpha[i]=0;continue}
      this.life[i]-=dt;const k=Math.max(0,this.life[i]/this.ttl[i]);
      this.vx[i]*=drag;this.vy[i]=this.vy[i]*drag-(S.physics==='gravity'?6*dt:0);this.vz[i]*=drag;
      p[i*3]+=this.vx[i]*dt;p[i*3+1]+=this.vy[i]*dt;p[i*3+2]+=this.vz[i]*dt;
      c.alpha[i]=k*k;c.size[i]=this.base[i]*(.4+.6*k);
    }
    c.upload();
  }
}
/* --- ambient dust --- */
class Dust{
  constructor(n){
    this.n=n;this.c=new PointCloud(n,.05);this.c.obj.renderOrder=-8;this.vx=new Float32Array(n);this.vy=new Float32Array(n);this.ph=new Float32Array(n);
    for(let i=0;i<n;i++){this.c.pos[i*3]=rr(-9,9);this.c.pos[i*3+1]=rr(-6,6);this.c.pos[i*3+2]=rr(-5,3);this.ph[i]=Math.random()*TAU;this.c.size[i]=rr(.02,.06);this.c.alpha[i]=rr(.12,.5)}
    paintCloud(this.c);this.c.upload();
  }
  update(dt,t){
    const p=this.c.pos,P=PTR,hw=V.W*.6,hh=V.H*.6;
    for(let i=0;i<this.n;i++){
      const k=i*3;let x=p[k],y=p[k+1];
      this.vx[i]+=(Math.sin(t*.3+this.ph[i])*.15)*dt;this.vy[i]+=(Math.cos(t*.27+this.ph[i]*1.3)*.15+.02)*dt;
      if(P.present){const dx=x-P.x,dy=y-P.y,d2=dx*dx+dy*dy;if(d2<6){const d=Math.sqrt(d2)+.01,f=(1-d/2.45)*(1.5+P.speed*.15);this.vx[i]+=dx/d*f*dt*8;this.vy[i]+=dy/d*f*dt*8}}
      this.vx[i]*=Math.exp(-dt*.7);this.vy[i]*=Math.exp(-dt*.7);
      x+=this.vx[i]*dt;y+=this.vy[i]*dt;
      if(x>hw)x=-hw;else if(x<-hw)x=hw;if(y>hh)y=-hh;else if(y<-hh)y=hh;
      p[k]=x;p[k+1]=y;
    }
    this.c.upload();
  }
}
/* --- particle typography: thousands of points that remember their letters --- */
class ParticleText{
  constructor(n){
    this.n=n;this.c=new PointCloud(n,.045);this.c.obj.renderOrder=10;this.c.keys=['c1','glow'];paintCloud(this.c);
    this.vx=new Float32Array(n);this.vy=new Float32Array(n);this.vz=new Float32Array(n);
    this.tx=new Float32Array(n);this.ty=new Float32Array(n);this.tz=new Float32Array(n);this.li=new Uint16Array(n);
    this.dl=new Float32Array(n);this.sd=new Float32Array(n);this.count=0;this.mode='off';this.vis=0;this.visT=0;this.t=0;this.t0=0;this.frozen=false;
    this.vort=[];this.morph=null;this.onRebuilt=null;this.c.setCount(0);this.c.obj.visible=false;
    for(let i=0;i<n;i++)this.sd[i]=Math.random();
  }
  /* sample n points across the glyph ink of `items` ({g,fs,l?}) */
  static sample(items,n){
    const area=items.reduce((a,it)=>a+(it.g.blank?0:it.g.area*it.fs*it.fs),0)||1,out=[];
    let left=n;
    items.forEach((it,k)=>{
      if(it.g.blank)return;
      let cnt=k===items.length-1?left:Math.round(n*(it.g.area*it.fs*it.fs)/area);cnt=Math.min(cnt,left);left-=cnt;
      const g=it.g;
      for(let j=0;j<cnt;j++){
        const o=((Math.random()*g.inkN)|0)*2;
        out.push({li:k,x:((g.ink[o]+Math.random())-g.tw/2)/g.pp*it.fs,y:(g.th/2-(g.ink[o+1]+Math.random()))/g.pp*it.fs});
      }
    });
    return out;
  }
  build(){
    const items=letters.map(l=>({g:l.g,fs:l.fs})),pts=ParticleText.sample(items,Q[S.quality].parts>this.n?this.n:Q[S.quality].parts);
    this.count=Math.min(pts.length,this.n);
    for(let i=0;i<this.count;i++){const p=pts[i];this.li[i]=p.li;this.tx[i]=p.x;this.ty[i]=p.y;this.tz[i]=rr(-.5,.5)*G.uDepth.value*.6;this.dl[i]=Math.random()}
    this.c.setCount(this.count);
  }
  target(i,out){
    const l=letters[this.li[i]];if(!l){out[0]=out[1]=out[2]=0;return}
    const c=Math.cos(l.frz),s=Math.sin(l.frz),sx=l.fsx,sy=l.fsy;
    out[0]=l.fx+c*this.tx[i]*sx-s*this.ty[i]*sy;out[1]=l.fy+s*this.tx[i]*sx+c*this.ty[i]*sy;out[2]=l.fz+this.tz[i];
  }
  enter(){  // letters dissolve into particles that hold their shape
    this.build();const o=[0,0,0],p=this.c.pos;
    for(let i=0;i<this.count;i++){this.target(i,o);p[i*3]=o[0];p[i*3+1]=o[1];p[i*3+2]=o[2];this.vx[i]=this.vy[i]=this.vz[i]=0}
    this.mode='home';this.frozen=false;this.visT=1;this.c.obj.visible=true;
    letters.forEach((l,i)=>{l.dissolveTarget=1;l.dissolveRate=1.1});
    S.pmode=true;Snd.burst();
  }
  explode(power,fromX,fromY){
    if(this.mode==='off')return;this.mode='free';this.frozen=false;
    for(let i=0;i<this.count;i++){
      const dx=this.c.pos[i*3]-fromX,dy=this.c.pos[i*3+1]-fromY,d=Math.hypot(dx,dy)+.2,s=power*rr(.35,1.2);
      this.vx[i]+=dx/d*s+rr(-1,1);this.vy[i]+=dy/d*s+rr(-1,1);this.vz[i]+=rr(-1,1)*s*.3;
    }
    CAM.shake+=.5;Snd.burst();
  }
  rebuild(){
    if(this.mode==='off')return;this.mode='rebuild';this.frozen=false;this.t0=this.t;Snd.rebuild();
    const dur=1.4;for(let i=0;i<this.count;i++)this.dl[i]=Math.random()*dur;
    setTimeout(()=>{for(const l of letters){l.dissolveRate=1.0;l.dissolveTarget=0}},900);
  }
  vortex(x,y,strength){this.vort.push({x,y,s:strength||1,t:0});if(this.vort.length>6)this.vort.shift()}
  exit(){this.mode='off';this.visT=0;S.pmode=false;for(const l of letters){l.dissolveTarget=0;l.dissolveRate=1.4}}
  update(dt,t){
    this.t=t;this.vis+=(this.visT-this.vis)*(1-Math.exp(-dt*4));
    if(this.mode==='off'&&this.vis<.01){this.c.obj.visible=false;return}
    this.c.obj.visible=true;this.c.mat.uniforms.uOpacity.value=this.vis;
    const p=this.c.pos,o=[0,0,0],P=PTR,n=this.count,mode=this.mode,tool=S.ptool,F=S.force*(S.calm?.5:1);
    for(let k=this.vort.length-1;k>=0;k--){this.vort[k].t+=dt;if(this.vort[k].t>5)this.vort.splice(k,1)}
    if(this.morph){this.stepMorph(dt);return}
    let arrived=0;const tr=t-this.t0;
    for(let i=0;i<n;i++){
      const k=i*3;let x=p[k],y=p[k+1],z=p[k+2],vx=this.vx[i],vy=this.vy[i],vz=this.vz[i];
      if(!this.frozen){
        if(mode==='home'||(mode==='rebuild'&&tr>=this.dl[i])){
          this.target(i,o);
          let kk=90,cc=13;
          if(mode==='rebuild'){const pr=sstep(0,1.1,tr-this.dl[i]);kk=8+130*pr;cc=2*Math.sqrt(kk)*.9;
            const rx=x-o[0],ry=y-o[1],dist=Math.hypot(rx,ry),sw=(1-pr)*Math.exp(-dist*.35)*14;vx+=-ry*sw*dt;vy+=rx*sw*dt}
          else{o[0]+=Math.sin(t*1.7+this.sd[i]*40)*.012;o[1]+=Math.cos(t*1.3+this.sd[i]*31)*.012}
          vx+=((o[0]-x)*kk-vx*cc)*dt;vy+=((o[1]-y)*kk-vy*cc)*dt;vz+=((o[2]-z)*kk-vz*cc)*dt;
          if(mode==='rebuild'&&Math.abs(o[0]-x)+Math.abs(o[1]-y)<.05)arrived++;
        }else{
          vx+=(Math.sin(y*1.3+t*.8+this.sd[i]*6.28)*1.6)*dt;vy+=(Math.cos(x*1.1+t*.7+this.sd[i]*5)*1.6-(S.physics==='gravity'?S.gravity*.35:0))*dt;vz+=(-z*1.2)*dt;
          const dr=Math.exp(-dt*.8);vx*=dr;vy*=dr;vz*=dr;
        }
        if(P.present&&tool!=='off'&&!(mode==='rebuild')){
          const dx=x-P.x,dy=y-P.y,d2=dx*dx+dy*dy,R=2.6+P.speed*.06;
          if(d2<R*R){
            const d=Math.sqrt(d2)+.01,f=1-d/R,a=f*f*(28+P.speed*1.2)*F*(P.down?1.8:1);
            if(tool==='repel'){vx+=dx/d*a*dt*6;vy+=dy/d*a*dt*6}
            else if(tool==='attract'){vx-=dx/d*a*dt*5;vy-=dy/d*a*dt*5}
            else if(tool==='swirl'){vx+=-dy/d*a*dt*6-dx/d*a*dt*.8;vy+=dx/d*a*dt*6-dy/d*a*dt*.8}
          }
        }
        for(const v of this.vort){const dx=x-v.x,dy=y-v.y,d=Math.hypot(dx,dy)+.2,f=v.s*Math.exp(-d*.25)*20*Math.min(1,v.t*2)*(1-v.t/5);vx+=(-dy/d*f-dx/d*f*.35)*dt;vy+=(dx/d*f-dy/d*f*.35)*dt}
        if(mode==='free'){
          if(x<WB.l){x=WB.l;vx=Math.abs(vx)*.5}else if(x>WB.r){x=WB.r;vx=-Math.abs(vx)*.5}
          if(y<WB.b){y=WB.b;vy=Math.abs(vy)*.5}else if(y>WB.t){y=WB.t;vy=-Math.abs(vy)*.5}
        }
        x+=vx*dt;y+=vy*dt;z+=vz*dt;
      }
      p[k]=x;p[k+1]=y;p[k+2]=z;this.vx[i]=vx;this.vy[i]=vy;this.vz[i]=vz;
      const sp=Math.abs(vx)+Math.abs(vy);this.c.alpha[i]=clamp(.45+sp*.08,.3,1);this.c.size[i]=.045*(.7+this.sd[i]*.6);
    }
    this.c.upload();
    if(mode==='rebuild'&&tr>2.6&&arrived>n*.9){this.mode='home';setTimeout(()=>{if(this.mode==='home'&&!Fx.breaking){this.visT=0;this.finishExit()}},700);if(this.onRebuilt)this.onRebuilt()}
  }
  finishExit(){this.mode='off';S.pmode=false;for(const l of letters){l.dissolveTarget=0}}
  /* ---- morph between two words via sorted correspondence ---- */
  startMorph(slotsB,fsB,dur,done){
    if(this.mode==='off')this.enter();
    this.build();const o=[0,0,0],n=this.count,A=[];
    for(let i=0;i<n;i++){this.target(i,o);A.push({i,x:o[0],y:o[1],z:o[2]})}
    const B=ParticleText.sample(slotsB.map(s=>({g:s.g,fs:fsB})),n).map(p=>{const s=slotsB[p.li];return{li:p.li,lx:p.x,ly:p.y,x:s.x+p.x,y:s.y+p.y}});
    while(B.length<n){const q=B[(Math.random()*B.length)|0];B.push(Object.assign({},q))}
    const key=a=>Math.round(a.x*3)*1000+a.y;
    A.sort((a,b)=>key(a)-key(b));B.sort((a,b)=>key(a)-key(b));
    this.morph={A,B,t:0,dur:dur||2.6,done,swirl:new Float32Array(n).map(()=>rr(-1,1))};
    this.mode='morph';this.visT=1;
  }
  stepMorph(dt){
    const M=this.morph,n=this.count,p=this.c.pos;M.t+=dt;const u=clamp(M.t/M.dur,0,1),e=EASE.io(u),bulge=Math.sin(u*Math.PI);
    for(let k=0;k<n;k++){
      const a=M.A[k],b=M.B[k],i=a.i,dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)+1e-3,sw=M.swirl[k]*bulge*(.6+len*.12);
      p[i*3]=a.x+dx*e+(-dy/len)*sw;p[i*3+1]=a.y+dy*e+(dx/len)*sw;p[i*3+2]=a.z*(1-e)+Math.sin(u*Math.PI)*M.swirl[k]*.8;
      this.c.alpha[i]=.5+.5*bulge;this.c.size[i]=.045*(.7+this.sd[i]*.6);
    }
    this.c.upload();
    if(u>=1){
      const B=M.B,done=M.done;this.morph=null;
      done&&done(B);
    }
  }
}
