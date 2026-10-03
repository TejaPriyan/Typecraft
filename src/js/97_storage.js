/* ===================== PROJECT STORAGE (IndexedDB, no account) ===================== */
const IDB={db:null,
  open(){
    if(this.db)return Promise.resolve(this.db);
    return new Promise((res,rej)=>{
      let r;try{r=indexedDB.open('typecraft',1)}catch(e){rej(e);return}
      r.onupgradeneeded=()=>r.result.createObjectStore('projects',{keyPath:'id'});
      r.onsuccess=()=>{this.db=r.result;res(this.db)};r.onerror=()=>rej(r.error);
    });
  },
  async tx(mode,fn){const db=await this.open();return new Promise((res,rej)=>{const t=db.transaction('projects',mode),st=t.objectStore('projects'),rq=fn(st);t.oncomplete=()=>res(rq&&rq.result);t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error)})},
  put(p){return this.tx('readwrite',s=>s.put(p))},
  get(id){return this.tx('readonly',s=>s.get(id))},
  del(id){return this.tx('readwrite',s=>s.delete(id))},
  list(){return this.tx('readonly',s=>s.getAll())},
};
let currentProject=null;
function makeThumb(){
  try{const c=document.createElement('canvas'),k=Math.min(1,180/canvas.width);c.width=Math.max(2,canvas.width*k|0);c.height=Math.max(2,canvas.height*k|0);c.getContext('2d').drawImage(canvas,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.6)}catch(e){return null}
}
async function saveProject(name){
  const id=currentProject&&currentProject.id||('p'+Date.now().toString(36));
  const p={id,name:name||S.text.replace(/\s+/g,' ').slice(0,28)||'Untitled',updated:Date.now(),look:snapshotLook(),thumb:makeThumb(),
    take:TAKE?{dur:TAKE.dur,frames:TAKE.frames,events:TAKE.events,spark:TAKE.spark,sfx:TAKE.sfx,defs:TAKE.defs,meta:TAKE.meta}:null};
  try{await IDB.put(p);currentProject={id,name:p.name};toast('Saved “'+p.name+'”');return true}
  catch(e){
    try{const q=Object.assign({},p,{take:null});await IDB.put(q);currentProject={id,name:p.name};toast('Saved without the take (storage limit)');return true}
    catch(e2){toast('Could not save in this browser');return false}
  }
}
async function loadProject(id){
  try{
    const p=await IDB.get(id);if(!p)return;
    if(PLAY.active)await stopPlayback();
    resetScene();await applyLook(p.look,{reset:true});
    if(p.take){TAKE=Object.assign({pIdx:[]},p.take);TAKE.pIdx=[];TAKE.frames.forEach((f,i)=>{if(f.P)TAKE.pIdx.push(i)})}else TAKE=null;
    currentProject={id:p.id,name:p.name};$('#textIn').value=S.text;syncUI();toast('Loaded “'+p.name+'”');
  }catch(e){toast('Could not load that project')}
}
async function newProject(){
  if(PLAY.active)await stopPlayback();if(REC.on)recStop(true);
  TAKE=null;currentProject=null;resetScene();await applyLook(clone(DEFAULT_LOOK),{reset:true,spawn:true});$('#textIn').value=S.text;syncUI();toast('New project');
}
