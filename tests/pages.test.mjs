import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import vm from 'node:vm';import {buildPages} from '../scripts/build-pages.mjs';
test('Pages build includes only public assets, scoped entry and restrictive network CSP',async()=>{const dir=await mkdtemp(join(tmpdir(),'hamsahm-pages-'));try{await buildPages(dir);const names=await readdir(dir),html=await readFile(join(dir,'index.html'),'utf8'),entry=await readFile(join(dir,'pages-entry.js'),'utf8');assert.ok(names.includes('sw.js'));assert.ok(!names.some(n=>/apk|jks|password|backup\.json|\.sql/.test(n)));assert.ok(html.includes('Content-Security-Policy'));assert.ok(html.includes('connect-src https://repfhpczklxftloyffix.supabase.co'));assert.ok(entry.includes('#online'));assert.equal(JSON.parse(await readFile(join(dir,'manifest.webmanifest'),'utf8')).start_url,'./#online');for(const source of ['app.js','online.js','online-payload.js','online-vendor.js'])assert.ok(names.includes(source))}finally{await rm(dir,{recursive:true,force:true})}});
test('service worker never intercepts private responses or files outside the application shell',async()=>{const dir=await mkdtemp(join(tmpdir(),'hamsahm-sw-'));try{await buildPages(dir);const handlers={},context={URL,self:{location:{href:'https://molidoai.github.io/family/sw.js'},addEventListener:(type,fn)=>handlers[type]=fn}};vm.runInNewContext(await readFile(join(dir,'sw.js'),'utf8'),context);for(const [url,method] of [['https://repfhpczklxftloyffix.supabase.co/rest/v1/hamsahm_account_summaries','GET'],['https://repfhpczklxftloyffix.supabase.co/auth/v1/token','POST'],['https://molidoai.github.io/family/backup.json','GET'],['https://molidoai.github.io/other/index.html','GET']]){let intercepted=false;handlers.fetch({request:{url,method},respondWith:()=>intercepted=true});assert.equal(intercepted,false,url)}}finally{await rm(dir,{recursive:true,force:true})}});
test('offline navigation uses the complete cached shell; broken cache falls back to network',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'hamsahm-recovery-'));
 try{
  await buildPages(dir);const handlers={},cached={body:'cached shell'},network={body:'network shell'};let broken=false,networkCalls=0,lookup;
  const context={URL,Request,self:{location:{href:'https://molidoai.github.io/family/sw.js'},addEventListener:(type,fn)=>handlers[type]=fn},caches:{open:async()=>{if(broken)throw Error('storage unavailable');return {match:async key=>{lookup=key;return cached}}}},fetch:async()=>{networkCalls++;return network}};
  vm.runInNewContext(await readFile(join(dir,'sw.js'),'utf8'),context);
  const request={url:'https://molidoai.github.io/family/?from=homescreen',method:'GET',mode:'navigate'};
  let result;handlers.fetch({request,respondWith:p=>result=p});assert.equal(await result,cached);assert.equal(lookup,'https://molidoai.github.io/family/index.html');assert.equal(networkCalls,0);
  broken=true;handlers.fetch({request,respondWith:p=>result=p});assert.equal(await result,network);assert.equal(networkCalls,1);
  handlers.fetch({request:{url:'https://molidoai.github.io/family/app.js',method:'GET'},respondWith:p=>result=p});assert.equal(await result,network);assert.equal(networkCalls,2);
 }finally{await rm(dir,{recursive:true,force:true})}
});
test('failed startup offers retry without clearing saved financial data',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'hamsahm-startup-'));
 try{
  await buildPages(dir);const nodes={},events={},content={replaceChildren(){this.children=[]},append(...children){this.children.push(...children)}};
  const context={location:{hash:'#online'},navigator:{onLine:false},addEventListener:(name,fn)=>events[name]=fn,document:{documentElement:{removeAttribute(){}},body:{prepend(node){nodes.notice=node}},createElement:()=>({setAttribute(){},addEventListener(name,fn){this[name]=fn}}),getElementById:()=>content}};
  vm.runInNewContext(await readFile(join(dir,'pages-entry.js'),'utf8'),context,{importModuleDynamically:()=>Promise.reject(Error('offline'))});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(nodes.notice.hidden,false);assert.equal(content.children.length,2);assert.equal(content.children[1].textContent,'تلاش دوباره');assert.ok(content.children[0].textContent.includes('حذف نمی‌شود'));
  context.navigator.onLine=true;events.online();assert.equal(nodes.notice.hidden,true);
 }finally{await rm(dir,{recursive:true,force:true})}
});
