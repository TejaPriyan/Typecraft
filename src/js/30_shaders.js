/* ===================== SHADERS ===================== */
const NODES=21;
const GLSL_LIB=`
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vnoise(vec2 p){vec2 i=floor(p);vec2 f=fract(p);f=f*f*(3.0-2.0*f);
  float a=hash(i);float b=hash(i+vec2(1.0,0.0));float c=hash(i+vec2(0.0,1.0));float d=hash(i+vec2(1.0,1.0));
  return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);}
float fbm(vec2 p){float v=0.0;float a=0.5;for(int i=0;i<4;i++){v+=a*vnoise(p);p*=2.02;a*=0.5;}return v;}
vec3 envMap(vec3 r){
  float y=r.y;
  vec3 top=vec3(0.95,0.98,1.05);vec3 horizon=vec3(0.16,0.17,0.20);vec3 ground=vec3(0.02,0.02,0.03);
  vec3 c=mix(ground,horizon,smoothstep(-0.6,0.0,y));
  c=mix(c,top,smoothstep(0.02,0.75,y));
  c+=vec3(1.0,0.9,0.8)*smoothstep(0.06,0.0,abs(y-0.03))*0.9;
  c+=vec3(1.0)*smoothstep(0.93,0.97,dot(r,normalize(vec3(-0.6,0.6,0.55))))*2.5;
  c+=vec3(0.6,0.75,1.0)*smoothstep(0.90,0.95,dot(r,normalize(vec3(0.8,0.25,0.5))))*2.0;
  return c;
}
float crackLines(vec2 p){
  vec2 ip=floor(p);vec2 fp=fract(p);float d1=8.0;float d2=8.0;
  for(int j=-1;j<=1;j++){for(int i=-1;i<=1;i++){
    vec2 o=vec2(float(i),float(j));
    vec2 r=o+vec2(hash(ip+o),hash(ip+o+17.3))-fp;
    float d=dot(r,r);
    if(d<d1){d2=d1;d1=d;}else if(d<d2){d2=d;}
  }}
  return 1.0-smoothstep(0.0,0.09,sqrt(d2)-sqrt(d1));
}
`;
const VERT=`
precision highp sampler2D;
#define NODES ${NODES}.0
uniform sampler2D uDisp;
uniform vec2 uSize;
uniform float uDepth;uniform float uDepthK;uniform float uLayers;uniform float uStride;
uniform float uTime;uniform float uWobble;uniform float uMelt;uniform float uSeed;
#ifdef SHARD
uniform vec2 uCentroid;
#endif
attribute float aLayer;
varying vec2 vUv;varying float vFront;varying vec3 vView;varying vec3 vFaceN;
void main(){
  vUv=uv;
  vec2 p=(uv-0.5)*uSize;
  vec4 dsp=texture2D(uDisp,(uv*(NODES-1.0)+0.5)/NODES);
  p+=dsp.xy;
  float z=dsp.z;
  p.x+=sin(p.y*2.3+uTime*3.1+uSeed)*uWobble*0.06;
  p.y+=sin(p.x*2.1+uTime*2.7+uSeed*1.7)*uWobble*0.06;
  z+=sin(p.x*1.7+p.y*1.3+uTime*2.0+uSeed)*uWobble*0.05;
  float drip=pow(clamp(1.0-uv.y,0.0,1.0),1.4);
  p.y-=uMelt*drip*uSize.y*(0.55+0.5*sin(uv.x*7.0+uSeed*3.0));
  p.x*=1.0+uMelt*0.22*drip;
#ifdef SHARD
  p-=uCentroid;
#endif
  z+=(0.5-aLayer)*uDepth*uDepthK;
  vec4 wp=modelMatrix*vec4(p,z,1.0);
  vec4 vp=viewMatrix*wp;
  vView=vp.xyz;
  vFaceN=normalize(mat3(viewMatrix)*(mat3(modelMatrix)*vec3(0.0,0.0,1.0)));
  vFront=vFaceN.z>=0.0?aLayer:1.0-aLayer;
  gl_Position=projectionMatrix*vp;
  float li=floor(aLayer*(uLayers-1.0)+0.5);
  if(mod(li,uStride)>0.5)gl_Position=vec4(0.0,0.0,-2.0,1.0);
}`;
const FRAG=`
precision highp sampler2D;
uniform sampler2D uTex;
uniform float uMat;uniform float uTime;uniform float uSeed;uniform float uAlpha;uniform float uDissolve;uniform float uCrack;
uniform float uPixelN;uniform float uGlitch;uniform float uSdfW;uniform float uBevel;uniform float uA2C;uniform float uLayers;
uniform vec3 uC0;uniform vec3 uC1;uniform vec3 uC2;uniform vec3 uGlow;uniform vec3 uKeyD;uniform vec3 uRimD;uniform vec3 uCurP;
uniform float uKeyI;uniform float uRimI;uniform float uAmbI;uniform float uCurI;
uniform vec2 uSize;
#ifdef SHARD
uniform vec2 uSeeds[8];uniform float uCell;
#endif
varying vec2 vUv;varying float vFront;varying vec3 vView;varying vec3 vFaceN;
${GLSL_LIB}
void main(){
  vec2 uv=vUv;
  if(uGlitch>0.001){
    float band=floor(uv.y*14.0);float gt=floor(uTime*9.0+uSeed);
    float hh=hash(vec2(band,gt));
    if(hh>0.86)uv.x+=(hash(vec2(gt,band))-0.5)*0.16*uGlitch;
  }
#ifdef SHARD
  vec2 q=(vUv-0.5)*uSize;
  float d1=1e9;float d2=1e9;float bi=0.0;
  for(int i=0;i<8;i++){float d=distance(q,uSeeds[i]);if(d<d1){d2=d1;d1=d;bi=float(i);}else if(d<d2){d2=d;}}
  if(abs(bi-uCell)>0.5)discard;
  float shardEdge=1.0-smoothstep(0.0,0.05,d2-d1);
#endif
  float s=texture2D(uTex,uv).r;
  float aa=max(fwidth(s)*0.8,0.004);
  float cov=smoothstep(0.5-aa,0.5+aa,s);
  float dIn=max((s-0.5)*uSdfW,0.0);
  float t=clamp(dIn/max(uBevel,0.0001),0.0,1.0);
  vec2 g=vec2(dFdx(s),dFdy(s));float glen=length(g);
  vec2 od=glen>1e-6?-g/glen:vec2(0.0);
  float tilt=pow(1.0-t,1.6)*0.92;
  float faceSign=vFaceN.z>=0.0?1.0:-1.0;
  vec3 fn=vFaceN*faceSign;
  vec3 n=normalize(fn*sqrt(max(1.0-tilt*tilt,0.0001))+vec3(od*tilt,0.0));
  if(uMat<4.5)n=normalize(n+vec3((uv-0.5)*0.32*t,0.0));
  vec3 V=normalize(-vView);
  vec3 Lk=normalize(uKeyD);vec3 Lr=normalize(uRimD);
  float dk=max(dot(n,Lk),0.0);float dr=max(dot(n,Lr),0.0);
  vec3 Lc=uCurP-vView;float dc=length(Lc);Lc=Lc/max(dc,0.001);
  float ac=uCurI/(1.0+0.05*dc*dc);
  float dcur=max(dot(n,Lc),0.0);
  float spk=pow(max(dot(n,normalize(Lk+V)),0.0),60.0);
  float spr=pow(max(dot(n,normalize(Lr+V)),0.0),40.0);
  float spc=pow(max(dot(n,normalize(Lc+V)),0.0),80.0);
  float fres=pow(1.0-max(dot(n,V),0.0),3.0);
  float fl=vFront*(uLayers-1.0);
  bool isFront=fl<0.5;
  vec3 col=vec3(0.0);float a=cov;float mat=uMat;
  vec3 base=uC0;
  if(mat<0.5){base=mix(vec3(0.75),uC1,0.3);}
  else if(mat<1.5){base=uGlow*0.6;}
  else if(mat<2.5){base=uC0;}
  else if(mat<3.5){base=uC2*0.9;}
  else if(mat<4.5){base=uC0;}
  else if(mat<5.5){base=vec3(0.55,0.8,1.0);}
  else if(mat<6.5){base=uC1;}
  else if(mat<7.5){base=uC0;}
  else{base=uGlow;}
  if(mat>7.5){
    float dd=abs(s-0.5)*uSdfW;
    float core=exp(-pow(dd/max(uBevel*0.35,0.001),2.0));
    float glow=exp(-dd/max(uBevel*5.0,0.001));
    col=uGlow*(glow*0.55)+mix(uGlow,vec3(1.0),0.65)*core*1.6+uGlow*cov*0.05;
    if(!isFront)col*=0.5-0.4*vFront;
  }else if(!isFront){
    float band=0.72+0.28*sin(uv.y*9.0+vFront*4.0+uSeed);
    col=base*(0.62-0.42*vFront)*band*(0.5+0.5*uAmbI+0.4*dk);
    if(mat>0.5&&mat<1.5)a=cov*0.18;
    if(mat>4.5&&mat<5.5)a=cov*0.4;
    if(mat>5.5&&mat<6.5)a=cov*0.25;
    if(mat>6.5&&mat<7.5){vec2 cells=vec2(uPixelN*uSize.x/uSize.y,uPixelN);vec2 cuv=(floor(uv*cells)+0.5)/cells;a=step(0.5,texture2D(uTex,cuv).r);}
  }else if(mat<0.5){
    vec3 R=reflect(-V,n);vec3 e=envMap(R);
    vec3 tint=mix(vec3(1.0),uC1,0.30);
    col=e*tint*(0.5+0.5*uKeyI)+tint*uAmbI*0.08;
    col+=vec3(1.0)*(spk*uKeyI+spr*uRimI+spc*ac*3.0);
  }else if(mat<1.5){
    vec3 R=reflect(-V,n);vec3 e=envMap(R);
    float body=0.10+0.10*(1.0-t);
    vec3 dsp=0.5+0.5*cos(6.2831*(vec3(0.0,0.33,0.67)+(1.0-t)*1.4+uv.x*0.6));
    col=uGlow*0.35*(0.4+0.6*(1.0-t))+e*fres*1.1+dsp*(1.0-t)*0.35+vec3(1.0)*(spk*uKeyI+spr*uRimI+spc*ac*3.0);
    a=cov*clamp(body+fres*0.8+(1.0-t)*0.45+spk*0.8,0.0,1.0);
  }else if(mat<2.5){
    float f=fbm(uv*3.0+vec2(uTime*0.25,uSeed))-0.5;
    vec3 b2=mix(uC0,uGlow,smoothstep(0.2,0.8,uv.y+f*0.8));
    vec3 R=reflect(-V,n);vec3 e=envMap(R);
    col=b2*(0.35+0.65*(dk*uKeyI*0.8+0.4*uAmbI+0.3*dr*uRimI))+e*(0.15+0.6*fres)+vec3(1.0)*(spk*uKeyI*1.4+spc*ac*3.0);
  }else if(mat<3.5){
    float fib=vnoise(uv*vec2(140.0,14.0)+uSeed)*0.5+vnoise(uv*90.0)*0.5;
    vec3 b2=uC2*(0.92+0.08*fib);
    col=b2*(0.42+0.58*(dk*uKeyI*0.75+uAmbI*0.5+0.25*dr*uRimI+0.35*dcur*ac));
    col*=1.0-0.35*pow(1.0-t,3.0);
  }else if(mat<4.5){
    col=uC0*(0.28+0.72*(dk*uKeyI*0.9+uAmbI*0.5+0.3*dr*uRimI+0.5*dcur*ac))+uC0*fres*0.5+vec3(1.0)*(spk*uKeyI*0.25+spc*ac)*0.6;
  }else if(mat<5.5){
    vec3 R=reflect(-V,n);vec3 e=envMap(R);
    float frost=fbm(uv*9.0+uSeed);
    vec3 b2=mix(vec3(0.62,0.86,1.0),uGlow,0.18)*(0.55+0.45*frost);
    float cr=crackLines(uv*vec2(uSize.x/uSize.y,1.0)*5.0);
    col=b2*(0.5+0.5*dk*uKeyI+0.3*uAmbI)+e*fres*0.9+vec3(1.0)*(spk*uKeyI+spc*ac*2.0);
    col+=vec3(0.9,0.97,1.0)*cr*uCrack*1.6;
    a=cov*clamp(0.5+0.35*fres+0.25*(1.0-t)+cr*uCrack*0.6,0.0,1.0);
  }else if(mat<6.5){
    float soft=smoothstep(0.30,0.62,s);
    float nzv=fbm(uv*4.0+vec2(uTime*0.15,-uTime*0.22)+uSeed);
    a=soft*(0.35+0.65*nzv)*0.85;
    col=mix(uC1,uC0,nzv)*(0.6+0.4*dk)+0.15;
  }else{
    vec2 cells=vec2(uPixelN*uSize.x/uSize.y,uPixelN);
    vec2 cuv=(floor(uv*cells)+0.5)/cells;
    float cs=texture2D(uTex,cuv).r;
    vec2 f2=abs(fract(uv*cells)-0.5);
    float box=1.0-smoothstep(0.40,0.46,max(f2.x,f2.y));
    float hc=hash(floor(uv*cells)+uSeed);
    a=step(0.5,cs)*box;
    vec3 b2=mix(uC0,uGlow,hc*0.55);
    col=b2*(0.55+0.45*dk*uKeyI+0.15*uAmbI)*(0.85+0.15*hc)+vec3(1.0)*spc*ac*0.5;
  }
  float nzd=fbm(uv*5.0+uSeed*3.0);
  float th=uDissolve*1.1-0.05;
  float pass=smoothstep(th,th+0.03,nzd);
  float edgeG=smoothstep(th+0.12,th,nzd)*pass*step(0.001,uDissolve);
  col+=uGlow*edgeG*2.0;
#ifdef SHARD
  col=col+vec3(0.5)*shardEdge*0.5*step(mat,7.5);
#endif
  a*=pass*uAlpha;
  if(mat>7.5){
    col*=pass*uAlpha;
    if(dot(col,vec3(1.0))<0.01)discard;
    gl_FragColor=vec4(col,1.0);
  }else{
    if(a<0.003)discard;
    bool opaqueFam=mat<0.5||(mat>1.5&&mat<4.5)||(mat>6.5&&mat<7.5);
    if(uA2C<0.5&&opaqueFam&&a<0.5)discard;
    gl_FragColor=vec4(col,a);
  }
}`;
const FRAG_SH=`
precision highp sampler2D;
uniform sampler2D uTex;uniform float uAlpha;uniform float uDissolve;uniform float uBlur;uniform float uShadowI;
varying vec2 vUv;
void main(){
  float s=texture2D(uTex,vUv).r;
  float a=smoothstep(0.5-uBlur,0.5+uBlur*0.3,s)*uShadowI*uAlpha*(1.0-uDissolve);
  if(a<0.004)discard;
  gl_FragColor=vec4(0.0,0.0,0.0,a);
}`;
const PV=`
attribute float aSize;attribute float aA;attribute float aMix;
uniform float uScale;
varying float vA;varying float vMix;
void main(){
  vec4 mv=modelViewMatrix*vec4(position,1.0);
  gl_Position=projectionMatrix*mv;
  gl_PointSize=clamp(aSize*uScale/max(-mv.z,0.1),1.0,72.0);
  vA=aA;vMix=aMix;
}`;
const PF=`
uniform vec3 uCA;uniform vec3 uCB;uniform float uOpacity;
varying float vA;varying float vMix;
void main(){
  vec2 c=gl_PointCoord-0.5;float d=length(c);
  if(d>0.5)discard;
  float a=smoothstep(0.5,0.12,d)*vA*uOpacity;
  gl_FragColor=vec4(mix(uCA,uCB,vMix)*(1.0+vA*0.4),a);
}`;
const BGV=`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}`;
const BGF=`
uniform vec3 uC0;uniform vec3 uC1;uniform vec2 uCur;uniform float uCurI;uniform float uAlpha;uniform float uTime;uniform vec2 uRes;
varying vec2 vUv;
float h1(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
void main(){
  vec2 p=vUv-0.5;p.x*=uRes.x/uRes.y;
  float r=length(p);
  vec3 c=mix(uC0,uC1,smoothstep(0.0,0.95,r));
  vec2 cp=vUv-uCur;cp.x*=uRes.x/uRes.y;
  c+=mix(uC0,vec3(1.0),0.5)*0.10*uCurI*exp(-dot(cp,cp)*5.0);
  c+=(h1(gl_FragCoord.xy+uTime)-0.5)*2.0/255.0;
  gl_FragColor=vec4(c,uAlpha);
}`;
const POSTF=`
uniform float uTime;uniform float uGrain;uniform float uVig;
varying vec2 vUv;
float h1(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
void main(){
  float g=h1(gl_FragCoord.xy+vec2(uTime*61.0,uTime*37.0))-0.5;
  vec2 q=vUv-0.5;
  float v=smoothstep(0.35,0.95,length(q*vec2(1.0,0.9))*1.25)*uVig;
  vec3 col=vec3(g>0.0?1.0:0.0);
  float a=abs(g)*uGrain*2.0;
  gl_FragColor=vec4(mix(col,vec3(0.0),clamp(v*1.5,0.0,1.0)),clamp(a+v*0.75,0.0,1.0));
}`;
