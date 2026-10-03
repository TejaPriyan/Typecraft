/* ===================== EXPORT: video / GIF / PNG / SVG ===================== */
const Exp={busy:false,cancel:false,t0:0,dur:10,sigTail:false};
const EXO={fmt:'video',aspect:'9:16',dur:10,src:'auto',res:720};
const ASP={'9:16':[9,16],'16:9':[16,9],'1:1':[1,1]};
let DL=null;
try{if(window.claude&&window.claude.use)window.claude.use('downloads').then(d=>{DL=d}).catch(()=>{})}catch(e){}
let DLtried=false;
async function saveFile(blob,name){
  if(!DL&&!DLtried){DLtried=true;try{if(window.claude&&window.claude.use)DL=await window.claude.use('downloads')}catch(e){DL=null}}
  if(DL){
    try{await DL.save({filename:name,data:blob});toast('Saved '+name);return true}
    catch(e){toast(e&&e.code==='declined'?'Save cancelled':'Could not save: '+((e&&e.message)||'error'));return false}
  }
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),5000);return true;
}
const rafP=()=>new Promise(r=>requestAnimationFrame(()=>r()));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function expSize(o){
  const[aw,ah]=ASP[o.aspect],r=o.res;
  if(aw===ah)return{w:r,h:r};
  return aw>ah?{w:Math.round(r*aw/ah/2)*2,h:r}:{w:r,h:Math.round(r*ah/aw/2)*2};
}
function beginExport(w,h){
  Exp.busy=true;Exp.cancel=false;V.exp={w,h};document.body.classList.add('exporting');closePanel();layoutViewport();
}
function endExport(){V.exp=null;Exp.busy=false;CAM.fit=1;document.body.classList.remove('exporting');layoutViewport();syncUI()}
async function prepareSource(o,dur){
  // returns {kind,cleanup}
  const useTake=o.src==='take'||(o.src==='auto'&&TAKE);
  if(useTake&&TAKE){
    const ok=await startPlayback({loop:false});if(!ok)return null;
    PLAY.speed=1;PLAY.dir=1;Exp.sigTail=true;
    return{kind:'take',cleanup:async()=>{Exp.sigTail=false;await stopPlayback()}};
  }
  Exp.sigTail=false;
  return new Promise(res=>{
    runReel({forExport:true,noRecord:true,dur,keepFrame:true,variant:REEL_DEFAULT});
    res({kind:'reel',cleanup:async()=>{
      abortReel();if(Reel.prev)S.physics=Reel.prev.phys;resetScene();relayout({reset:true});Fx.sigOn=false;sigMat.opacity=0
    }});
  });
}
function pickMime(){
  if(!window.MediaRecorder)return null;
  const c=['video/mp4;codecs=avc1','video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm','video/mp4'];
  return c.find(m=>MediaRecorder.isTypeSupported(m))||null;
}
async function runExport(o){
  if(Exp.busy||Reel.running||REC.on)return;
  Snd.init();closeModals();
  if(o.fmt==='svg')return exportSVG(o);
  const{w,h}=expSize(o),dur=o.dur;
  if(o.fmt==='video'&&!pickMime()){toast('Video export needs MediaRecorder — try Chrome, Edge or Safari 14.1+');return}
  if(cinemaOn)await exitCinema();
  if(PLAY.active)await stopPlayback();
  Exp.prevAspect=V.aspect;
  beginExport(w,h);
  await rafP();
  if(o.fmt==='png')return exportPNG(o);
  const src=await prepareSource(o,dur);
  if(!src){endExport();return}
  Exp.dur=dur;
  let rec=null,chunks=[],mime='',frames=[],gw=0,gh=0,sctx=null;
  if(o.fmt==='video'){
    mime=pickMime();const stream=canvas.captureStream(30),as=Snd.stream();
    if(as&&Snd.on)as.getAudioTracks().forEach(t=>stream.addTrack(t));
    rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:o.res>720?12e6:7e6});
    rec.ondataavailable=e=>{if(e.data&&e.data.size)chunks.push(e.data)};
    rec.start(250);
  }else{
    const sc=Math.min(1,480/Math.max(w,h));gw=Math.max(2,Math.round(w*sc));gh=Math.max(2,Math.round(h*sc));
    const cv=document.createElement('canvas');cv.width=gw;cv.height=gh;sctx=cv.getContext('2d',{willReadFrequently:true});sctx.__cv=cv;
  }
  Exp.t0=performance.now();const fps=12;let next=0;
  await new Promise(res=>{
    const tick=()=>{
      const el=(performance.now()-Exp.t0)/1000;
      expProgress(Math.min(1,el/dur),(o.fmt==='gif'?'Capturing ':'Rendering ')+fmtT(Math.min(el,dur))+' / '+dur+'s');
      if(o.fmt==='gif'&&el>=next/fps&&next<dur*fps){sctx.drawImage(canvas,0,0,gw,gh);frames.push(sctx.getImageData(0,0,gw,gh).data);next++}
      if(Exp.cancel||el>=dur){res();return}
      requestAnimationFrame(tick);
    };tick();
  });
  let blob=null,name='';
  const stamp=new Date().toISOString().slice(2,16).replace(/[-:T]/g,'');
  if(rec){
    await new Promise(r=>{rec.onstop=r;try{rec.stop()}catch(e){r()}});
    if(!Exp.cancel){blob=new Blob(chunks,{type:mime.split(';')[0]});name='typecraft-'+stamp+'.'+(mime.includes('mp4')?'mp4':'webm')}
  }
  await src.cleanup();
  if(o.fmt==='gif'&&!Exp.cancel){
    expProgress(0,'Encoding GIF…');
    blob=await encodeGIF(frames,gw,gh,Math.round(100/fps),p=>expProgress(p,'Encoding GIF… '+Math.round(p*100)+'%'));name='typecraft-'+stamp+'.gif';
  }
  endExport();expProgress(-1);
  if(Exp.cancel||!blob){toast('Export cancelled');return}
  Snd.done();showExportResult(blob,name,o);
}
async function exportPNG(o){
  const m=(canvas.width/canvas.height);CAM.fit=Math.max(1,(Exp.prevAspect||V.aspect)/V.aspect);
  await rafP();await rafP();
  const blob=await new Promise(r=>canvas.toBlob(r,'image/png'));
  endExport();
  if(blob)showExportResult(blob,'typecraft-'+new Date().toISOString().slice(2,16).replace(/[-:T]/g,'')+'.png',o);else toast('PNG export failed');
}
function exportSVG(o){
  const[aw,ah]=ASP[o.aspect],k=100,H=Math.max(10,7.6/(aw/ah)),W=H*aw/ah,pal=PALS[S.palette],hx=v=>'#'+v.map(c=>Math.round(c*255).toString(16).padStart(2,'0')).join('');
  const id=MATS[letters[0]?letters[0].mat:0],fit=Math.max(1,V.W/W,V.H/H);
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Math.round(W*k)} ${Math.round(H*k)}" width="${Math.round(W*k)}" height="${Math.round(H*k)}">`;
  s+=`<defs><radialGradient id="bg" cx="50%" cy="50%" r="75%"><stop offset="0" stop-color="${hx(pal.v.bg0)}"/><stop offset="1" stop-color="${hx(pal.v.bg1)}"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#bg)"/>`;
  for(const l of letters){
    if(l.hidden||!l.g||l.g.blank)continue;
    const mid=MATS[l.mat],fill=mid==='chrome'?pal.v.c1:mid==='paper'?pal.v.c2:mid==='glass'||mid==='neon'||mid==='ice'?pal.v.glow:pal.v.c0;
    const paths=glyphContours(l.g).map(loop=>{
      let d='M';let px=null,py=null,acc=0;
      loop.forEach((p,i)=>{const x=p[0],y=-p[1];if(i===0){d+=x.toFixed(3)+' '+y.toFixed(3);px=x;py=y}else{acc+=Math.hypot(x-px,y-py);if(acc>.006||i===loop.length-1){d+='L'+x.toFixed(3)+' '+y.toFixed(3);acc=0}px=x;py=y}});
      return d+'Z';
    }).join('');
    const X=(l.fx/fit+W/2)*k,Y=(H/2-l.fy/fit)*k,sc=l.fs*k/fit,op=mid==='glass'||mid==='smoke'?.65:1;
    const attrs=mid==='neon'?`fill="none" stroke="${hx(fill)}" stroke-width="${(.012).toFixed(3)}"`:`fill="${hx(fill)}" fill-opacity="${op}" fill-rule="evenodd"`;
    s+=`<path transform="translate(${X.toFixed(1)} ${Y.toFixed(1)}) rotate(${(-l.frz*180/Math.PI).toFixed(2)}) scale(${(sc*l.fsx).toFixed(3)} ${(sc*l.fsy).toFixed(3)})" d="${paths}" ${attrs}/>`;
  }
  s+='</svg>';
  const blob=new Blob([s],{type:'image/svg+xml'});
  showExportResult(blob,'typecraft-'+new Date().toISOString().slice(2,16).replace(/[-:T]/g,'')+'.svg',o);
}

/* ---- tiny GIF encoder: median-cut palette + ordered dither + LZW ---- */
const BAYER=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
function medianCut(frames){
  const hist=new Uint32Array(32768);
  for(const f of frames)for(let i=0;i<f.length;i+=28)hist[(f[i]>>3)<<10|(f[i+1]>>3)<<5|(f[i+2]>>3)]++;
  const cols=[];for(let k=0;k<32768;k++)if(hist[k])cols.push(k);
  const ch=(k,c)=>c===0?k>>10:c===1?(k>>5)&31:k&31;
  const rng=b=>{let lo=[31,31,31],hi=[0,0,0];for(const k of b){for(let c=0;c<3;c++){const v=ch(k,c);if(v<lo[c])lo[c]=v;if(v>hi[c])hi[c]=v}}return[hi[0]-lo[0],hi[1]-lo[1],hi[2]-lo[2]]};
  let boxes=[cols];
  while(boxes.length<256){
    let bi=-1,best=0,bc=0;
    boxes.forEach((b,i)=>{if(b.length<2)return;const r=rng(b),m=Math.max(r[0],r[1],r[2]);if(m>best){best=m;bi=i;bc=r.indexOf(m)}});
    if(bi<0)break;
    const b=boxes[bi];b.sort((x,y)=>ch(x,bc)-ch(y,bc));
    let tot=0;for(const k of b)tot+=hist[k];let acc=0,si=0;for(;si<b.length-1;si++){acc+=hist[b[si]];if(acc>=tot/2)break}
    boxes.splice(bi,1,b.slice(0,si+1),b.slice(si+1));
  }
  const pal=new Uint8Array(768);
  boxes.forEach((b,i)=>{let r=0,g=0,bl=0,t=0;for(const k of b){const n=hist[k];r+=(k>>10)*n;g+=((k>>5)&31)*n;bl+=(k&31)*n;t+=n}if(t){pal[i*3]=Math.min(255,(r/t)*8+4);pal[i*3+1]=Math.min(255,(g/t)*8+4);pal[i*3+2]=Math.min(255,(bl/t)*8+4)}});
  return pal;
}
function lzwEncode(px,minCode){
  const clear=1<<minCode,eoi=clear+1,out=[];let size=minCode+1,next=eoi+1,cur=0,bits=0,dict=new Map();
  const emit=c=>{cur|=c<<bits;bits+=size;while(bits>=8){out.push(cur&255);cur>>=8;bits-=8}};
  emit(clear);let pre=px[0];
  for(let i=1;i<px.length;i++){
    const k=px[i],key=(pre<<8)|k,v=dict.get(key);
    if(v!==undefined){pre=v;continue}
    emit(pre);
    if(next===4096){emit(clear);dict=new Map();next=eoi+1;size=minCode+1}
    else{if(next>=(1<<size))size++;dict.set(key,next++)}
    pre=k;
  }
  emit(pre);emit(eoi);if(bits>0)out.push(cur&255);
  return out;
}
async function encodeGIF(frames,w,h,delay,prog){
  const pal=medianCut(frames),lut=new Int16Array(32768).fill(-1);
  const near=key=>{
    let v=lut[key];if(v>=0)return v;
    const r=((key>>10)<<3)+4,g=(((key>>5)&31)<<3)+4,b=((key&31)<<3)+4;let bd=1e9,bi=0;
    for(let i=0;i<256;i++){const dr=pal[i*3]-r,dg=pal[i*3+1]-g,db=pal[i*3+2]-b,d=dr*dr*2+dg*dg*4+db*db*3;if(d<bd){bd=d;bi=i}}
    lut[key]=bi;return bi;
  };
  const out=[];const w16=v=>out.push(v&255,(v>>8)&255);
  'GIF89a'.split('').forEach(c=>out.push(c.charCodeAt(0)));w16(w);w16(h);out.push(0xF7,0,0);for(let i=0;i<768;i++)out.push(pal[i]);
  out.push(0x21,0xFF,0x0B);'NETSCAPE2.0'.split('').forEach(c=>out.push(c.charCodeAt(0)));out.push(3,1,0,0,0);
  for(let fi=0;fi<frames.length;fi++){
    const f=frames[fi],px=new Uint8Array(w*h);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const i=(y*w+x)*4,d=(BAYER[(y&3)*4+(x&3)]/16-.5)*9;
      const r=clamp(f[i]+d,0,255)|0,g=clamp(f[i+1]+d,0,255)|0,b=clamp(f[i+2]+d,0,255)|0;
      px[y*w+x]=near((r>>3)<<10|(g>>3)<<5|(b>>3));
    }
    out.push(0x21,0xF9,4,4,delay&255,(delay>>8)&255,0,0,0x2C);w16(0);w16(0);w16(w);w16(h);out.push(0,8);
    const data=lzwEncode(px,8);
    for(let i=0;i<data.length;i+=255){const n=Math.min(255,data.length-i);out.push(n);for(let j=0;j<n;j++)out.push(data[i+j])}
    out.push(0);
    prog&&prog((fi+1)/frames.length);await sleep(0);
  }
  out.push(0x3B);
  return new Blob([Uint8Array.from(out)],{type:'image/gif'});
}
