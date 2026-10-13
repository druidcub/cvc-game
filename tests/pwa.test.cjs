const assert=require('node:assert/strict'), fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const base='https://druidcub.github.io/cvc-game/';
const handlers={}, stores=new Map();let claimed=false;
class Cache{constructor(){this.items=new Map();}async addAll(requests){for(const r of requests){const relative=new URL(r.url).pathname.replace('/cvc-game/','');const file=path.join(root,relative.endsWith('/')||!relative?relative+'index.html':relative);assert.ok(fs.existsSync(file),`Missing precache asset ${relative}`);this.items.set(r.url,new Response(fs.readFileSync(file)));}}async match(key){return this.items.get(typeof key==='string'?key:key.url)?.clone();}}
const caches={async open(name){if(!stores.has(name))stores.set(name,new Cache());return stores.get(name);},async keys(){return [...stores.keys()];},async delete(name){return stores.delete(name);}};
const sw={location:{href:base+'sw.js'},clients:{async claim(){claimed=true;}},addEventListener(type,fn){handlers[type]=fn;},skipWaiting(){}};
vm.runInNewContext(fs.readFileSync(path.join(root,'sw.js'),'utf8'),{self:sw,caches,Request,Response,URL,fetch:async()=>{throw new Error('Network offline');}});
async function event(type,extra={}){let pending;handlers[type]({...extra,waitUntil(p){pending=p;}});await pending;}
async function request(url,mode='navigate',method='GET'){let response;handlers.fetch({request:{url,mode,method},respondWith(p){response=p;}});return response&&await response;}
(async()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'dist/manifest.webmanifest'),'utf8'));
 assert.equal(manifest.display,'standalone');assert.equal(new URL(manifest.start_url,base+'dist/manifest.webmanifest').href,base+'dist/');
 for(const icon of manifest.icons){const buf=fs.readFileSync(path.join(root,'dist',icon.src));assert.equal(buf.readUInt32BE(16),Number(icon.sizes.split('x')[0]));assert.equal(buf.readUInt32BE(20),Number(icon.sizes.split('x')[1]));}
 await event('install');const current=[...stores.keys()][0];assert.equal(stores.get(current).items.size,14);
 stores.set('word-garden:/cvc-game/:old',new Cache());stores.set('word-garden:/other-project/:keep',new Cache());
 await event('activate');assert.equal(claimed,true);assert.equal(stores.has('word-garden:/cvc-game/:old'),false);assert.equal(stores.has('word-garden:/other-project/:keep'),true);
 for(const url of [base,base+'dist/',base+'dist/index.html?installed=1',base+'dist/app.js',base+'dist/data.js']){const r=await request(url,url.endsWith('.js')?'cors':'navigate');assert.equal(r.status,200);}
 assert.match(await (await request(base+'dist/')).text(),/manifest.webmanifest/);
 assert.match(await (await request(base+'not-cached-route')).text(),/pwa.js/);
 assert.equal(await request('https://druidcub.github.io/other-project/'),undefined);
 assert.equal(await request('https://elsewhere.example/a.js','cors'),undefined);
 assert.equal(await request(base+'dist/app.js','cors','POST'),undefined);
 let status;await event('message',{data:{type:'OFFLINE_STATUS'},ports:[{postMessage(v){status=v;}}]});assert.equal(status.ready,true);
 stores.get(current).items.delete(base+'dist/data.js');await event('message',{data:{type:'OFFLINE_STATUS'},ports:[{postMessage(v){status=v;}}]});assert.equal(status.ready,false);
 console.log('PASS: manifest/PNG sizes, all 14 assets, offline navigation/assets, query URLs, readiness, update cleanup and isolation from other projects.');
})().catch(e=>{console.error(e);process.exitCode=1;});
