import test from 'node:test';import assert from 'node:assert/strict';
import {createLock,verifyLock,validateLock,failedAttempt,retryAfter} from '../app/src/main/assets/www/web-lock-core.js';
test('local entry lock verifies password with random salt and keeps plaintext out of record',async()=>{
 const password='رمز آزمایشی طولانی ۱۲۳';const a=await createLock(password),b=await createLock(password);
 assert.notEqual(a.salt,b.salt);assert.notEqual(a.verifier,b.verifier);assert.ok(!JSON.stringify(a).includes(password));assert.equal(await verifyLock(a,password),true);assert.equal(await verifyLock(a,'اشتباه'),false);
 await assert.rejects(()=>createLock('1234'));assert.throws(()=>validateLock({...a,iterations:1}));assert.throws(()=>validateLock({...a,salt:'invalid'}));assert.throws(()=>validateLock({...a,verifier:''}));
});
test('failed attempts introduce persistent bounded backoff after five failures',()=>{
 let record=null;for(let i=0;i<4;i++){record=failedAttempt(record,1000);assert.equal(retryAfter(record,1000),0)}
 record=failedAttempt(record,1000);assert.equal(retryAfter(record,1000),30000);assert.equal(retryAfter(JSON.parse(JSON.stringify(record)),1001),29999);assert.equal(retryAfter(record,32000),0);
 record=failedAttempt(record,33000);assert.equal(retryAfter(record,33000),60000);for(let i=0;i<100;i++)record=failedAttempt(record,100000);assert.equal(retryAfter(record,100000),900000);
});
