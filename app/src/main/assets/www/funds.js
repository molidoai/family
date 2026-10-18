import {KEY,empty,validate,migrate} from './core.js';
// Data keys are also the registry: a new fund is written atomically, without moving legacy data.
export const fundPrefix=KEY+'-fund-';
export function listFunds(storage){const keys=[KEY];for(let i=0;i<storage.length;i++){const k=storage.key(i);if(k.startsWith(fundPrefix)&&!k.endsWith('-backup')&&/^[a-zA-Z0-9-]+$/.test(k.slice(fundPrefix.length)))keys.push(k)}return [...new Set(keys)].map(key=>{try{const raw=storage.getItem(key),s=raw?validate(migrate(JSON.parse(raw))):empty();return {key,name:s.name,broken:false}}catch{return {key,name:'صندوق نیازمند بازیابی',broken:true}}})}
export function createFund(storage,id,name){const key=fundPrefix+id;if(!/^[a-zA-Z0-9-]+$/.test(id)||storage.getItem(key)!==null)throw Error('شناسه صندوق معتبر نیست.');const s=validate({...empty(),name:name.trim()});storage.setItem(key,JSON.stringify(s));return key}
export function backupAge(storage,key,now=Date.now()){const raw=storage.getItem(key+'-backup');if(!raw)return null;const age=now-Date.parse(raw);return Number.isFinite(age)?Math.max(0,Math.floor(age/86400000)):null}
