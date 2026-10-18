import {test} from 'node:test';import assert from 'node:assert/strict';import {encryptBackup,decryptBackup,isEncryptedBackup} from '../app/src/main/assets/www/backup-crypto.js';
const value={name:'صندوق هم‌سهم',members:[{name:'مریم'}],balance:123456},password='My backup phrase 1405';
let encrypted;
test('encrypted backup round-trips Persian and numeric data',async()=>{encrypted=await encryptBackup(value,password);assert.ok(isEncryptedBackup(encrypted));assert.deepEqual(await decryptBackup(encrypted,password),value);assert.ok(!JSON.stringify(encrypted).includes('مریم'));});
test('wrong password cannot decrypt',async()=>{await assert.rejects(()=>decryptBackup(encrypted,'Wrong password phrase'))});
test('tampering with ciphertext fails authentication',async()=>{const changed={...encrypted,data:(encrypted.data[0]==='A'?'B':'A')+encrypted.data.slice(1)};await assert.rejects(()=>decryptBackup(changed,password))});
test('random salt and IV prevent identical ciphertext',async()=>{const other=await encryptBackup(value,password);assert.notEqual(other.salt,encrypted.salt);assert.notEqual(other.iv,encrypted.iv);assert.notEqual(other.data,encrypted.data)});
test('bad parameters and malformed envelopes rejected',async()=>{await assert.rejects(()=>encryptBackup(value,'1234'));await assert.rejects(()=>decryptBackup({...encrypted,iterations:1},password));await assert.rejects(()=>decryptBackup({...encrypted,iv:'AA=='},password));await assert.rejects(()=>decryptBackup({...encrypted,data:'!'},password))});
