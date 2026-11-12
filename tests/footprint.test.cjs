// Verifies that quiz mistakes, star pocket changes and finished sessions become tracker events
// with the fields the Apps Script collector expects. No network: fetch is absent, so events stay queued.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const storage=new Map();
storage.set('cvc-tracker-v1:settings',JSON.stringify({enabled:true,url:'https://script.google.com/macros/s/TEST/exec',token:'t',learner:'小寶'}));
const elements=new Map();
const element=selector=>{if(!elements.has(selector))elements.set(selector,{value:'',innerHTML:'',textContent:'',disabled:false,classList:{add(){},remove(){},toggle(){}},append(){},showModal(){},dataset:{}});return elements.get(selector);};
const document={querySelector:element,querySelectorAll:()=>[],addEventListener(){},createElement:()=>({dataset:{},classList:{add(){}},style:{}}),cookie:''};
const window={addEventListener(){}};
const context=vm.createContext({document,window,location:{href:'https://druidcub.github.io/cvc-game/dist/',protocol:'https:'},URL,localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},WordSpeech:{cancel(){},attach(){}},setTimeout,clearTimeout,Date,Math,JSON,navigator:{onLine:true},console});
context.globalThis=context;
vm.runInContext(fs.readFileSync(path.join(root,'dist/tracker.js'),'utf8'),context);
vm.runInContext(fs.readFileSync(path.join(root,'dist/data.js'),'utf8'),context);
const source=fs.readFileSync(path.join(root,'dist/app.js'),'utf8').replace(/render\(\);\s*$/,'');
vm.runInContext(source+';globalThis.api={start,answer,next,toggleStar,current,tracker,WORDS,getState:()=>state,getSession:()=>session,setSession:s=>{session=s;}};',context);
const api=context.api, queue=()=>JSON.parse(storage.get('cvc-tracker-v1:queue')||'[]');
const WORDS=api.WORDS, at=WORDS.filter(w=>w.family==='at').slice(0,3);

// Quiz: wrong answer → miss event, finishing → session_done with counts and wrong words.
api.start(at,'quiz',3);
let s=api.getSession();assert.equal(s.type,'quiz');
const first=api.current(), wrongChoice=at.find(w=>w.id!==first.id);
api.answer(wrongChoice.id);
let events=queue();assert.equal(events.length,1);
assert.equal(events[0].type,'miss');assert.equal(events[0].word,first.word);assert.equal(events[0].unit,'短母音 a (CVC)');assert.equal(events[0].family,'-at');assert.equal(events[0].source,'quiz');assert.equal(events[0].learner,'小寶');assert.equal(events[0].app,'cvc');
api.next();api.answer(api.current().id);api.next();api.answer(api.current().id);api.next();
assert.equal(api.getSession().done,true);
events=queue();const done=events.find(e=>e.type==='session_done');
assert.ok(done,'finished session is reported');assert.equal(done.mode,'quiz');assert.equal(done.total,3);assert.equal(done.correct,2);assert.deepEqual(done.wrong,[first.word]);assert.equal(done.unit,'短母音 a (CVC)');assert.deepEqual(done.families,['-at']);assert.equal(typeof done.seconds,'number');
assert.equal(events.filter(e=>e.type==='session_done').length,1,'session_done is sent once even though recordProgress runs per answer');

// Star pocket: a learned word (star removed) → mastered; manual star → miss with manual source.
const before=queue().length;
api.toggleStar(first.id);                           // removes the star added by the wrong answer
let last=queue().at(-1);assert.equal(last.type,'mastered');assert.equal(last.word,first.word);
api.toggleStar(at[2].id);
last=queue().at(-1);assert.equal(last.type,'miss');assert.equal(last.source,'manual');assert.equal(last.errType,'孩子自評不熟');
assert.equal(queue().length,before+2);

// Review session that is abandoned midway is still recorded locally but never reported as done.
api.setSession(null);api.start(at,'review',3);api.next();
const mid=queue().filter(e=>e.type==='session_done').length;
api.getSession();api.setSession(null);
assert.equal(queue().filter(e=>e.type==='session_done').length,mid,'unfinished review is not reported');

// Tracker disabled → no events at all.
api.tracker.configure({enabled:false});const n=queue().length;api.start(at,'quiz',2);api.answer(at.find(w=>w.id!==api.current().id).id);assert.equal(queue().length,n);
console.log('PASS: quiz misses, single session_done per finished session, mastered/manual star events, abandoned sessions and the disabled switch.');
