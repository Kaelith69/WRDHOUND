
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const ctx={window:{},console,Int8Array,Int32Array,Map,Set,Math};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(require('path').join(__dirname,'..','dictionary.js'),'utf8'),ctx);
const src=fs.readFileSync(require('path').join(__dirname,'..','hound.js'),'utf8');
const core=src.slice(0,src.indexOf("  if (typeof document === 'undefined')"));
const api=vm.runInContext(core+'  return {buildGraph,makePuzzle,solve,houndStep,distFrom,get words(){return words},get adj(){return adj},get giant(){return giant}}; })()',ctx);
console.time('graph');
api.buildGraph();
console.timeEnd('graph');
assert.equal(api.words.length,3889);
assert.equal(new Set(api.words).size,3889);
for(let u=0;u<api.adj.length;u++){
  for(const v of api.adj[u]){
    assert(api.adj[v].includes(u),'graph edge is not symmetric');
    const a=api.words[u],b=api.words[v];
    let changes=0; for(let k=0;k<4;k++) if(a[k]!==b[k]) changes++;
    assert.equal(changes,1,'graph contains a non one letter edge');
  }
}
let total=0;
console.time('puzzle generation');
for(const level of [0,1,2,3,4,6,9,12,15,20]){
  const p=api.makePuzzle(level);
  assert(p,`level ${level} failed to generate`);
  const [r,h,e]=[p.r,p.h,p.e].map(w=>api.words.indexOf(w));
  assert.notEqual(r,h); assert.notEqual(r,e); assert.notEqual(h,e);
  const route=api.solve(r,h,e);
  assert(route && route.length-1===p.par);
  let runner=r,hound=h;
  for(let i=1;i<route.length;i++){
    const next=route[i];
    assert(api.adj[runner].includes(next),'solver returned non-adjacent move');
    assert(next===e || (next!==hound && !api.adj[hound].includes(next)),'solver returned unsafe move');
    runner=next;
    if(runner!==e) hound=api.houndStep(hound,runner);
  }
  total+=p.par;
}
console.timeEnd('puzzle generation');
console.log(JSON.stringify({dictionary:api.words.length,giantComponent:api.giant.length,puzzles:10,parTotal:total}));

const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const css=fs.readFileSync(require('path').join(__dirname,'..','hound.css'),'utf8');
for(const id of ['guide-button','tutorial-dialog','tutorial-next','tutorial-skip','tutorial-title','tutorial-copy']) assert(html.includes(`id="${id}"`),`missing onboarding element ${id}`);
assert(src.includes("localStorage.getItem(TUTORIAL) === '1'"),'first-run guide must persist completion');
assert(src.includes('function showGuide') && src.includes('function advanceGuide'),'guide controls must be implemented');
assert(css.includes('@media (max-width:480px)') && css.includes('overflow-x:clip'),'mobile overflow safeguards missing');
console.log('UI smoke checks passed');

assert(html.includes('data-key="ENTER"'),'on-screen keyboard needs an Enter key');
assert(html.includes('data-key="BACKSPACE"'),'on-screen keyboard needs a Backspace key');
assert(html.includes('id="keyboard-toggle"'),'on-screen keyboard needs a discoverable toggle');
assert(src.includes("KEYBOARD = 'wrdhound-keyboard-v1'"),'keyboard preference must have a stable storage key');
assert(src.includes("matchMedia('(pointer: coarse)').matches"),'touch devices should get a useful default keyboard state');
assert(src.includes("wordInput.dispatchEvent(new Event('input', { bubbles: true }))"),'virtual key input must use the same validation path as typed input');
assert(src.includes("keyboard.querySelectorAll('[data-key]')"),'virtual keyboard should reflect letters already entered');
console.log('Input accessibility and virtual keyboard smoke checks passed');
