/* ===================== GLYPHS: raster -> SDF texture, particle samples, contours ===================== */
const GLYPH_RES={high:256,balanced:192,performance:128};
let glyphRes=192;
const glyphCache=new Map();
const gcv=document.createElement('canvas');
const gctx=gcv.getContext('2d',{willReadFrequently:true});
const PAD=.16,SPREAD_EM=.12,PPE_DIV=1.75,INF=1e20;
const fontCss=(f,w,px)=>`${w} ${px}px "${f.fam}", ${f.fb||'sans-serif'}`;
const effWeight=(f,w)=>f.vf?clamp(Math.round(w/50)*50,f.wmin,f.wmax):f.w0;
const fontReady=new Map();
function ensureFont(f,w){
  const k=f.id+'|'+w;if(fontReady.has(k))return fontReady.get(k);
  if(f.custom){const p=Promise.resolve();fontReady.set(k,p);return p}
  const p=Promise.race([document.fonts.load(fontCss(f,w,100),'AaBb0'),new Promise(r=>setTimeout(r,3500))]).catch(()=>{});
  fontReady.set(k,p);return p;
}
function edt1d(g,off,stride,len,f,v,z){
  v[0]=0;z[0]=-INF;z[1]=INF;f[0]=g[off];
  for(let q=1,k=0,s=0;q<len;q++){
    f[q]=g[off+q*stride];const q2=q*q;
    do{const r=v[k];s=(f[q]-f[r]+q2-r*r)/(q-r)/2}while(s<=z[k]&&--k>-1);
    k++;v[k]=q;z[k]=s;z[k+1]=INF;
  }
  for(let q=0,k=0;q<len;q++){while(z[k+1]<q)k++;const r=v[k],d=q-r;g[off+q*stride]=f[r]+d*d}
}
function edt2d(g,w,h,f,v,z){
  for(let x=0;x<w;x++)edt1d(g,x,w,h,f,v,z);
  for(let y=0;y<h;y++)edt1d(g,y*w,1,w,f,v,z);
}
const capCache=new Map();
function capHeight(f,w){
  const k=f.id+w;if(capCache.has(k))return capCache.get(k);
  gctx.font=fontCss(f,w,200);const m=gctx.measureText('H');
  const c=clamp((m.actualBoundingBoxAscent||140)/200,.5,1.1);capCache.set(k,c);return c;
}
function getGlyph(ch,f,w){
  const key=f.id+'|'+w+'|'+ch+'|'+glyphRes;
  let g=glyphCache.get(key);if(g){g.use=performance.now();return g}
  const M=200;gctx.font=fontCss(f,w,M);
  const m=gctx.measureText(ch);
  const adv=(m.width||M*.5)/M;
  if(/^\s$/.test(ch)){g={ch,adv,blank:true,use:performance.now()};glyphCache.set(key,g);return g}
  let xmin=-(m.actualBoundingBoxLeft||0)/M,xmax=(m.actualBoundingBoxRight||m.width)/M;
  let asc=(m.actualBoundingBoxAscent||.7*M)/M,desc=(m.actualBoundingBoxDescent||0)/M;
  if(!(xmax-xmin>.01)){xmin=0;xmax=Math.max(adv,.3)}
  if(!(asc+desc>.01)){asc=.7;desc=0}
  const iw=xmax-xmin,ih=asc+desc,qw0=iw+2*PAD,qh0=ih+2*PAD;
  const pp=Math.min(glyphRes/PPE_DIV,glyphRes/qw0,glyphRes/qh0);
  const tw=Math.max(8,Math.ceil(qw0*pp)),th=Math.max(8,Math.ceil(qh0*pp));
  gcv.width=tw;gcv.height=th;gctx.clearRect(0,0,tw,th);
  gctx.font=fontCss(f,w,pp);gctx.fillStyle='#fff';gctx.textBaseline='alphabetic';gctx.textAlign='left';
  gctx.fillText(ch,(PAD-xmin)*pp,(PAD+asc)*pp);
  const id=gctx.getImageData(0,0,tw,th).data,n=tw*th;
  const cov=new Uint8Array(n),outer=new Float64Array(n),inner=new Float64Array(n);
  let inkN=0;
  for(let i=0;i<n;i++){
    const a=id[i*4+3]/255;cov[i]=id[i*4+3];
    if(a>=.5)inkN++;
    if(a===1){outer[i]=0;inner[i]=INF}else if(a===0){outer[i]=INF;inner[i]=0}else{const d=.5-a;outer[i]=d>0?d*d:0;inner[i]=d<0?d*d:0}
  }
  const mx=Math.max(tw,th)+1,fb=new Float64Array(mx),vb=new Uint16Array(mx),zb=new Float64Array(mx+1);
  edt2d(outer,tw,th,fb,vb,zb);edt2d(inner,tw,th,fb,vb,zb);
  const rgba=new Uint8Array(n*4),ink=new Uint16Array(inkN*2);let ii=0;
  for(let y=0;y<th;y++)for(let x=0;x<tw;x++){
    const i=y*tw+x,inside=-(Math.sqrt(outer[i])-Math.sqrt(inner[i]))/pp;
    const v=clamp(.5+inside/(2*SPREAD_EM),0,1),o=((th-1-y)*tw+x)*4;
    rgba[o]=v*255;rgba[o+1]=cov[i];rgba[o+3]=255;
    if(cov[i]>=128){ink[ii++]=x;ink[ii++]=y}
  }
  const tex=new THREE.DataTexture(rgba,tw,th,THREE.RGBAFormat);
  tex.minFilter=tex.magFilter=THREE.LinearFilter;tex.generateMipmaps=false;tex.needsUpdate=true;
  g={ch,key,adv,blank:false,tw,th,pp,qw:tw/pp,qh:th/pp,iw,ih,xmin,xmax,asc,desc,cx:(xmin+xmax)/2,cy:(asc-desc)/2,tex,cov,ink,inkN,area:inkN/(pp*pp),use:performance.now()};
  glyphCache.set(key,g);return g;
}
function pruneGlyphs(keep){
  for(const [k,g] of glyphCache){if(!keep.has(g)){if(g.tex)g.tex.dispose();glyphCache.delete(k)}}
}
function clearGlyphs(){for(const g of glyphCache.values())if(g.tex)g.tex.dispose();glyphCache.clear()}

/* marching squares on coverage -> closed polylines in em units (y up, origin = quad centre) */
function glyphContours(g){
  const W=g.tw,H=g.th,c=g.cov,T=127.5,adj=new Map();
  const v=(x,y)=>c[y*W+x]>=T?1:0;
  const link=(a,b)=>{(adj.get(a)||adj.set(a,[]).get(a)).push(b);(adj.get(b)||adj.set(b,[]).get(b)).push(a)};
  const Hh=(x,y)=>(y*W+x)*2,Vv=(x,y)=>(y*W+x)*2+1;
  for(let y=0;y<H-1;y++)for(let x=0;x<W-1;x++){
    const k=v(x,y)*8+v(x+1,y)*4+v(x+1,y+1)*2+v(x,y+1);if(k===0||k===15)continue;
    const t=Hh(x,y),b=Hh(x,y+1),l=Vv(x,y),r=Vv(x+1,y);
    switch(k){case 1:link(l,b);break;case 2:link(b,r);break;case 3:link(l,r);break;case 4:link(t,r);break;
      case 5:link(l,t);link(b,r);break;case 6:link(t,b);break;case 7:link(l,t);break;case 8:link(l,t);break;
      case 9:link(t,b);break;case 10:link(t,r);link(l,b);break;case 11:link(t,r);break;case 12:link(l,r);break;
      case 13:link(b,r);break;case 14:link(l,b);break}
  }
  const pt=id=>{
    const vert=id&1,idx=id>>1,y=Math.floor(idx/W),x=idx%W;
    let px,py;
    if(!vert){const a=c[y*W+x],b=c[y*W+x+1],t=(T-a)/((b-a)||1);px=x+t+.5;py=y+.5}
    else{const a=c[y*W+x],b=c[(y+1)*W+x],t=(T-a)/((b-a)||1);px=x+.5;py=y+t+.5}
    return[(px-W/2)/g.pp,(H/2-py)/g.pp];
  };
  const seen=new Set(),loops=[];
  for(const s of adj.keys()){
    if(seen.has(s))continue;
    const pts=[];let prev=-1,cur=s,guard=0;
    do{
      seen.add(cur);pts.push(pt(cur));const nb=adj.get(cur);
      if(nb.length<2)break;
      const nx=nb[0]!==prev?nb[0]:nb[1];prev=cur;cur=nx;
    }while(cur!==s&&!seen.has(cur)&&++guard<200000);
    if(pts.length>3)loops.push(pts);
  }
  return loops;
}

/* ---- text layout (pure) ---- */
function layoutText(text,cfg,view,offY){
  const f=FONT[cfg.font],w=effWeight(f,cfg.weight);
  let lines=text.split('\n');
  if(view.aspect<.85&&lines.length===1&&/\s/.test(lines[0].trim()))lines=lines[0].trim().split(/\s+/);
  const tr=cfg.tracking,capH=capHeight(f,w),lh=cfg.lineH*1.05;
  const rows=lines.map(line=>{
    const gl=Array.from(line).map(ch=>getGlyph(ch,f,w));
    let wd=0;gl.forEach((g,i)=>{wd+=g.adv+(i<gl.length-1?tr:0)});
    return{gl,wd};
  });
  const wMax=Math.max(.2,...rows.map(r=>r.wd)),totalH=(rows.length-1)*lh+capH;
  let fs=Math.min(view.W*.8*cfg.size/wMax,view.H*.6*cfg.size/totalH,view.H*.5);
  fs=Math.min(fs,view.W*.94/wMax);
  const yTop=totalH*fs/2,slots=[];
  rows.forEach((row,ri)=>{
    const base=yTop-capH*fs-ri*lh*fs+(offY||0);
    let x0=cfg.align==='left'?-wMax*fs/2:cfg.align==='right'?wMax*fs/2-row.wd*fs:-row.wd*fs/2;
    let pen=0;
    row.gl.forEach(g=>{
      if(!g.blank)slots.push({g,ch:g.ch,x:x0+(pen+g.cx)*fs,y:base+g.cy*fs,line:ri});
      pen+=g.adv+tr;
    });
  });
  return{slots,fs,capH};
}
