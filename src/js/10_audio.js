/* ===================== AUDIO (procedural Web Audio & Beat Engine) ===================== */
const Snd=(()=>{
  let ctx=null,master=null,dest=null,nbuf=null;const last={};
  let musicEl=null,musicSource=null,analyser=null,freqData=null,musicName='';
  const A={on:true,
    init(){
      if(ctx){if(ctx.state==='suspended')ctx.resume();return}
      try{
        const AC=window.AudioContext||window.webkitAudioContext;ctx=new AC();
        master=ctx.createGain();master.gain.value=.55;
        const comp=ctx.createDynamicsCompressor();master.connect(comp);comp.connect(ctx.destination);
        dest=ctx.createMediaStreamDestination();comp.connect(dest);
        nbuf=ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate);const d=nbuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
      }catch(e){ctx=null}
    },
    stream(){return dest?dest.stream:null},
    ok(k,gap){if(!ctx||!A.on)return false;const t=ctx.currentTime;if(last[k]!==undefined&&t-last[k]<gap)return false;last[k]=t;return true},
    tone(f0,f1,dur,type,vol,delay){
      const t=ctx.currentTime+(delay||0),o=ctx.createOscillator(),g=ctx.createGain();
      o.type=type||'sine';o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(Math.max(30,f1),t+dur);
      g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
      o.connect(g);g.connect(master);o.start(t);o.stop(t+dur+.03);
    },
    noise(dur,vol,f,q,type,delay){
      const t=ctx.currentTime+(delay||0),s=ctx.createBufferSource(),fl=ctx.createBiquadFilter(),g=ctx.createGain();
      s.buffer=nbuf;s.loop=true;fl.type=type||'bandpass';fl.frequency.value=f;fl.Q.value=q||1;
      g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+.006);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
      s.connect(fl);fl.connect(g);g.connect(master);s.start(t,Math.random()*.5);s.stop(t+dur+.03);
    },
    grab(){if(!A.ok('grab',.06))return;A.tone(340,520,.12,'triangle',.12);A.noise(.05,.05,2400,1)},
    release(v){if(!A.ok('rel',.06))return;A.tone(420,190,.16,'triangle',.1*clamp(.4+v/20,0,1))},
    impact(s){if(!A.ok('imp',.05))return;const v=clamp(s,.2,2);A.tone(120,42,.32,'sine',.34*v);A.noise(.18,.18*v,900,.7,'lowpass');A.tone(900,260,.05,'square',.03*v)},
    bounce(v){if(!A.ok('bnc',.045))return;const s=clamp(v/14,.08,1);A.tone(200+rr(-30,60),90,.13,'sine',.2*s);A.noise(.04,.06*s,1800,1.2)},
    shatter(){if(!A.ok('sh',.12))return;A.noise(.45,.3,5200,.8,'highpass');A.noise(.25,.22,2400,2);for(let i=0;i<6;i++)A.tone(rr(1800,4200),rr(700,1400),.09,'triangle',.05,i*.03)},
    rebuild(){if(!A.ok('rb',.3))return;for(let i=0;i<5;i++)A.tone(220*Math.pow(1.5,i%4)*(1+i*.01),440*Math.pow(1.5,i%4),.42,'sine',.07,i*.07);A.noise(.5,.06,3200,.6,'bandpass',.1)},
    burst(){if(!A.ok('bu',.2))return;A.noise(.6,.25,1400,.5,'lowpass');A.tone(90,30,.5,'sine',.3);A.noise(.35,.1,6000,.7,'highpass',.04)},
    recStart(){if(!A.ok('rs',.2))return;A.tone(880,880,.08,'sine',.12);A.tone(1320,1320,.12,'sine',.12,.1)},
    recStop(){if(!A.ok('re',.2))return;A.tone(1320,1320,.08,'sine',.12);A.tone(880,880,.14,'sine',.12,.1)},
    done(){if(!A.ok('dn',.4))return;[523,659,784,1047].forEach((f,i)=>A.tone(f,f,.5,'sine',.1,i*.08))},
    tick(){if(!A.ok('tk',.03))return;A.tone(1200,900,.03,'square',.03)},
    // Music & Beat Synchronization
    async loadMusic(file){
      A.init();if(!ctx)return;
      try{
        if(musicEl){musicEl.pause();musicEl.src=''}
        const url=URL.createObjectURL(file);
        musicName=file.name.replace(/\.[^/.]+$/,"");
        musicEl=new Audio(url);musicEl.loop=true;musicEl.crossOrigin='anonymous';
        if(!musicSource){
          musicSource=ctx.createMediaElementSource(musicEl);
          analyser=ctx.createAnalyser();
          analyser.fftSize=128;
          analyser.smoothingTimeConstant=0.8;
          freqData=new Uint8Array(analyser.frequencyBinCount);
          musicSource.connect(analyser);
          analyser.connect(master);
        }
        await musicEl.play();
        return musicName;
      }catch(err){console.error('Audio load error:',err);return null}
    },
    toggleMusic(){
      if(!musicEl)return false;
      if(musicEl.paused){musicEl.play();return true}else{musicEl.pause();return false}
    },
    isMusicActive(){return !!(musicEl&&!musicEl.paused)},
    getMusicName(){return musicName},
    getBeatPulse(){
      if(!analyser||!musicEl||musicEl.paused)return 0;
      analyser.getByteFrequencyData(freqData);
      let sum=0;
      for(let i=1;i<=5;i++)sum+=freqData[i];
      const avg=sum/5/255;
      return avg>.6?(avg-.6)*2.5:0;
    }
  };
  return A;
})();
