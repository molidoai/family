export const LOCK_KEY='hamsahm-web-lock-v1',ATTEMPTS_KEY='hamsahm-web-lock-attempts-v1';
const ITERATIONS=600000;
function passwordCheck(password){if(typeof password!=='string'||password.length<10||password.length>256)throw Error('رمز ورود باید بین ۱۰ تا ۲۵۶ نویسه باشد.');}
function hex(bytes){return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('')}
function bytes(value){return Uint8Array.from(value.match(/../g),b=>parseInt(b,16))}
export function validateLock(value){if(!value||value.version!==1||value.iterations!==ITERATIONS||!(/^[a-f0-9]{32}$/.test(value.salt))||!(/^[a-f0-9]{64}$/.test(value.verifier)))throw Error('تنظیم قفل ورود آسیب دیده است؛ ورود متوقف شد. پشتیبان موجود را نگه دارید.');return value}
async function derive(password,salt){if(!globalThis.crypto?.subtle)throw Error('مرورگر از امنیت رمز پشتیبانی نمی‌کند؛ مرورگر را به‌روزرسانی کنید.');const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);return hex(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:bytes(salt),iterations:ITERATIONS},material,256)))}
export async function createLock(password){passwordCheck(password);const salt=hex(crypto.getRandomValues(new Uint8Array(16)));return {version:1,iterations:ITERATIONS,salt,verifier:await derive(password,salt)}}
export async function verifyLock(record,password){validateLock(record);if(typeof password!=='string'||password.length>256)return false;const actual=await derive(password,record.salt);let difference=0;for(let i=0;i<actual.length;i++)difference|=actual.charCodeAt(i)^record.verifier.charCodeAt(i);return difference===0}
export function failedAttempt(previous,now=Date.now()){const count=Math.min(100,(Number.isInteger(previous?.count)&&previous.count>0?previous.count:0)+1);return {count,until:now+(count<5?0:Math.min(900000,30000*2**Math.min(count-5,5)))}}
export function retryAfter(record,now=Date.now()){return Math.max(0,Math.min(900000,Number.isFinite(record?.until)?record.until-now:0))}
