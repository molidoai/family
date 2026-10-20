import {readdir,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
export async function buildPages(destination=resolve('build/pages')){
 const source=resolve('app/src/main/assets/www');
 const names=(await readdir(source)).filter(name=>/\.(js|css|svg|png|webmanifest|html)$/.test(name));
 if(!names.includes('index.html')||!names.includes('online-vendor.js'))throw Error('Required app assets are missing');
 await rm(destination,{recursive:true,force:true});await mkdir(destination,{recursive:true});
 for(const name of names)await writeFile(join(destination,name),await readFile(join(source,name)));
 const csp="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src https://repfhpczklxftloyffix.supabase.co; object-src 'none'; base-uri 'none'; form-action 'none'";
 let html=await readFile(join(destination,'index.html'),'utf8');
 html=html.replace('<head>','<head><meta http-equiv="Content-Security-Policy" content="'+csp+'"><meta name="referrer" content="no-referrer">');
 html=html.replace('src="app.js"','src="pages-entry.js"');
 html=html.replace('<span>هم‌سهم <small>صندوق خانوادگی</small></span></div>','<span>هم‌سهم <small>صندوق خانوادگی</small></span><a class="webApk" href="https://github.com/molidoai/family/releases/latest/download/Hamsahm.apk" target="_blank" rel="noopener noreferrer">دانلود اندروید</a></div>');
 await writeFile(join(destination,'index.html'),html);
 const manifest=JSON.parse(await readFile(join(destination,'manifest.webmanifest'),'utf8'));manifest.start_url='./#online';await writeFile(join(destination,'manifest.webmanifest'),JSON.stringify(manifest));
 await writeFile(join(destination,'pages-entry.js'),`if(!location.hash)history.replaceState(null,'',location.pathname+location.search+'#online');
const notice=document.createElement('div');notice.className='webConnection';notice.setAttribute('role','status');document.body.prepend(notice);
function connection(){notice.hidden=navigator.onLine;notice.textContent='اتصال اینترنت قطع است؛ اطلاعات محلی در دسترس است. حساب آنلاین و پرداخت به اینترنت نیاز دارند.'}
addEventListener('online',connection);addEventListener('offline',connection);connection();
import('./app.js').catch(()=>{
 const content=document.getElementById('content');content.replaceChildren();
 const message=document.createElement('p');message.setAttribute('role','alert');message.textContent='بارگذاری برنامه کامل نشد. اتصال اینترنت را بررسی کنید و دوباره تلاش کنید. اطلاعات ذخیره‌شده حذف نمی‌شود.';
 const retry=document.createElement('button');retry.type='button';retry.textContent='تلاش دوباره';retry.addEventListener('click',()=>location.reload());content.append(message,retry);
});
`);
 await writeFile(join(destination,'style.css'),(await readFile(join(destination,'style.css'),'utf8'))+'\n.webConnection{background:#fff0c2;color:#453600;padding:12px;text-align:center}.webConnection[hidden]{display:none}\n.webApk{margin-inline-start:auto;color:inherit;text-decoration:none;border:1px solid var(--line);border-radius:10px;padding:10px 14px;font-size:12px}\n@media print{.webApk{display:none!important}}\n');
 const assets=[...names,'pages-entry.js'].sort(),hash=createHash('sha256');for(const name of assets){hash.update(name);hash.update(await readFile(join(destination,name)))}
 const cache='hamsahm-pages-'+hash.digest('hex').slice(0,16);
 const worker=`const CACHE=${JSON.stringify(cache)},ASSETS=${JSON.stringify(assets)};
const BASE=new URL('./',self.location.href),URLS=ASSETS.map(path=>new URL(path,BASE).href),ALLOWED=new Set(URLS);
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(URLS.map(url=>new Request(url,{cache:'reload'}))))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('hamsahm-pages-')&&key!==CACHE).map(key=>caches.delete(key))))));
async function shell(request,key){try{const cache=await caches.open(CACHE),hit=await cache.match(key);if(hit)return hit}catch{}return fetch(request)}
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 // Never intercept Auth/REST, credentials, payment links, backups or other project paths.
 if(event.request.method!=='GET'||url.origin!==BASE.origin)return;
 const home=event.request.mode==='navigate'&&(url.pathname===BASE.pathname||url.pathname===new URL('index.html',BASE).pathname);
 if(home){event.respondWith(shell(event.request,new URL('index.html',BASE).href));return;}
 if(!ALLOWED.has(url.href))return;
 event.respondWith(shell(event.request,event.request));
});
`;
 await writeFile(join(destination,'sw.js'),worker);await writeFile(join(destination,'.nojekyll'),'');
 return {destination,assets:assets.length,cache};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(await buildPages()));
