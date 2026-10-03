(()=>{
'use strict';
/* ===================== CORE: utils, state, data ===================== */
const TAU=Math.PI*2;
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,t)=>a+(b-a)*t;
const sstep=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const rr=(a,b)=>a+Math.random()*(b-a);
const wrapPI=a=>a-TAU*Math.round(a/TAU);
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const EASE={io:t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2,out:t=>1-Math.pow(1-t,3),inn:t=>t*t*t,back:t=>{const c=2.70158;return 1+c*Math.pow(t-1,3)+1.70158*Math.pow(t-1,2)}};
const hexRGB=h=>{const n=parseInt(h.slice(1),16);return[(n>>16&255)/255,(n>>8&255)/255,(n&255)/255]};
const isTouch=matchMedia('(pointer:coarse)').matches;
const reducedMQ=matchMedia('(prefers-reduced-motion: reduce)');
const nz=(x,y,s)=>Math.sin(x*1.7+s*12.9+Math.sin(y*2.3+s*4.1))*.5+Math.sin(x*.83-y*1.9+s*7.7)*.5;
const pick=a=>a[Math.floor(Math.random()*a.length)];
const fmtT=s=>s.toFixed(1);

/* ---- fonts (curated) ---- */
const FONTS=[
 {id:'anton',name:'Anton',fam:'Anton',cat:'Display',vf:false,w0:400},
 {id:'bebas',name:'Bebas Neue',fam:'Bebas Neue',cat:'Display',vf:false,w0:400},
 {id:'unbounded',name:'Unbounded',fam:'Unbounded',cat:'Display',vf:true,wmin:200,wmax:900},
 {id:'archivo',name:'Archivo Black',fam:'Archivo Black',cat:'Sans',vf:false,w0:400},
 {id:'grotesk',name:'Space Grotesk',fam:'Space Grotesk',cat:'Sans',vf:true,wmin:300,wmax:700},
 {id:'manrope',name:'Manrope',fam:'Manrope',cat:'Sans',vf:true,wmin:200,wmax:800},
 {id:'playfair',name:'Playfair',fam:'Playfair Display',fb:'serif',cat:'Serif',vf:true,wmin:400,wmax:900},
 {id:'dmserif',name:'DM Serif',fam:'DM Serif Display',fb:'serif',cat:'Serif',vf:false,w0:400},
 {id:'fraunces',name:'Fraunces',fam:'Fraunces',fb:'serif',cat:'Serif',vf:true,wmin:100,wmax:900},
 {id:'jbmono',name:'JetBrains Mono',fam:'JetBrains Mono',fb:'monospace',cat:'Mono',vf:true,wmin:100,wmax:800},
 {id:'spacemono',name:'Space Mono',fam:'Space Mono',fb:'monospace',cat:'Mono',vf:false,w0:700},
 {id:'syne',name:'Syne',fam:'Syne',cat:'Experimental',vf:true,wmin:400,wmax:800},
 {id:'climate',name:'Climate Crisis',fam:'Climate Crisis',cat:'Experimental',vf:false,w0:400},
 {id:'rubikmono',name:'Rubik Mono',fam:'Rubik Mono One',cat:'Experimental',vf:false,w0:400},
 {id:'bungee',name:'Bungee',fam:'Bungee',cat:'Experimental',vf:false,w0:400},
];
const FONT=Object.fromEntries(FONTS.map(f=>[f.id,f]));

/* ---- materials ---- */
const MATS=['chrome','glass','liquid','paper','rubber','ice','smoke','pixel','neon'];
const MATNAME={chrome:'Chrome',glass:'Glass',liquid:'Liquid',paper:'Paper',rubber:'Rubber',ice:'Ice',smoke:'Smoke',pixel:'Pixel',neon:'Neon'};
// m mass, e restitution mult, g gravity mult, air drag, hs home spring mult, dk deform restore mult, dc deform damping, bev bevel(em), wob wobble, mu friction, flt flutter, wind
const MP={
 chrome:{m:1.35,e:.8,g:1,air:.6,hs:1,dk:.7,dc:8,bev:.075,wob:0,mu:.5,flt:0,wind:1,soft:0},
 glass:{m:1,e:.6,g:1,air:.6,hs:1,dk:.7,dc:8,bev:.08,wob:0,mu:.3,flt:0,wind:1,soft:0},
 liquid:{kmin:2.5,m:.9,e:.25,g:1,air:1.2,hs:.5,dk:.28,dc:1.2,bev:.2,wob:1,mu:.2,flt:0,wind:1.2,soft:1},
 paper:{m:.28,e:.3,g:.3,air:3.4,hs:.7,dk:.8,dc:6,bev:.012,wob:0,mu:.4,flt:1,wind:2.2,soft:0},
 rubber:{kmin:16,m:.9,e:1.7,g:1,air:.5,hs:1,dk:3,dc:2.4,bev:.13,wob:.15,mu:.9,flt:0,wind:1,soft:1},
 ice:{m:1.25,e:.5,g:1,air:.5,hs:1.1,dk:.15,dc:9,bev:.05,wob:0,mu:.05,flt:0,wind:.8,soft:0},
 smoke:{kmin:1,m:.12,e:.2,g:-.12,air:2.4,hs:.55,dk:.5,dc:4,bev:.2,wob:.5,mu:.1,flt:0,wind:3.2,soft:1},
 pixel:{m:1,e:1,g:1,air:.6,hs:1,dk:1,dc:8,bev:.03,wob:0,mu:.5,flt:0,wind:1,soft:0},
 neon:{m:.85,e:.9,g:1,air:.5,hs:1,dk:1,dc:8,bev:.03,wob:0,mu:.4,flt:0,wind:1,soft:0},
};

/* ---- palettes ---- */
const PALS={
 mono:{name:'Mono',bg:['#181818','#000000'],c0:'#ffffff',c1:'#b9b9b9',c2:'#f2f2f2',glow:'#ffffff',ui:'#f0f0f0',light:false},
 chrome:{name:'Chrome',bg:['#22252d','#050608'],c0:'#8da2c8',c1:'#d0d9ec',c2:'#e8ebf2',glow:'#9fc2ff',ui:'#a9c6ff',light:false},
 void:{name:'Void',bg:['#0d0d1c','#000000'],c0:'#5b57ff',c1:'#b8b6ff',c2:'#e9e8ff',glow:'#7d78ff',ui:'#a09cff',light:false},
 electric:{name:'Electric',bg:['#140b48','#020114'],c0:'#ff2e88',c1:'#ffd2ea',c2:'#f5f0ff',glow:'#2df2ff',ui:'#43f0ff',light:false},
 sunset:{name:'Sunset',bg:['#51163a','#0e0410'],c0:'#ff5a36',c1:'#ffc06b',c2:'#ffe9cf',glow:'#ff7a3d',ui:'#ff9d62',light:false},
 ice:{name:'Ice',bg:['#12405f','#020b14'],c0:'#66d9ff',c1:'#d8f6ff',c2:'#f2fcff',glow:'#7ee6ff',ui:'#93e9ff',light:false},
 paper:{name:'Paper',bg:['#f4efe3','#d6cdb8'],c0:'#1b1b1b',c1:'#6b6558',c2:'#fbf8f0',glow:'#e4432d',ui:'#ff7a5c',light:true},
};
const PALIDS=Object.keys(PALS);
for(const k of PALIDS){const p=PALS[k];p.v={bg0:hexRGB(p.bg[0]),bg1:hexRGB(p.bg[1]),c0:hexRGB(p.c0),c1:hexRGB(p.c1),c2:hexRGB(p.c2),glow:hexRGB(p.glow)}}

const TOOLS=[['grab','Grab'],['push','Push'],['pull','Pull'],['twist','Twist'],['inflate','Inflate'],['pinch','Pinch'],['melt','Melt'],['cut','Cut'],['rebuild','Rebuild']];
const PHYS=[['still','Still'],['gravity','Gravity'],['magnet','Magnet'],['repulse','Repulse'],['orbit','Orbit'],['wind','Wind'],['float','Float'],['chaos','Chaos']];

/* ---- serialisable studio state ---- */
const S={
 text:'TEJA PRIYAN',font:'unbounded',weight:800,size:1,tracking:.02,lineH:1,align:'center',
 palette:'chrome',material:'chrome',
 physics:'still',gravity:26,bounce:.45,friction:.5,air:.3,force:1,memory:.75,
 depth:.4,rotX:0,rotY:0,rotZ:0,keyI:1,rimI:.8,ambI:.35,cursorLight:true,camMode:'drift',grain:.06,
 motion:{wave:0,bounce:0,spin:0,stretch:0,melt:0,glitch:0},
 brush:1.4,tool:'grab',select:'single',ptool:'repel',pmode:false,
 quality:'balanced',sound:true,calm:reducedMQ.matches,sig:true,frame:0,expRes:720,
};
const SAVE_KEYS=['text','font','weight','size','tracking','lineH','align','palette','material','physics','gravity','bounce','friction','air','force','memory','depth','rotX','rotY','rotZ','keyI','rimI','ambI','cursorLight','camMode','grain','motion','brush','sig','frame'];

window.__TC={};  // internal handle (debug)
/* exports to later sections are plain closure variables */
