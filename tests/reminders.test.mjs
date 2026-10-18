import {test} from 'node:test';import assert from 'node:assert/strict';
import {empty,addEntry,createDues,cancelEntry,gregorian} from '../app/src/main/assets/www/core.js';
import {reminderSnapshot} from '../app/src/main/assets/www/reminders.js';
const member={id:'m',name:'عضو خصوصی',phone:'',archived:false,share:1000,joined:gregorian(1405,1,1)};
const start=()=>({...empty(),members:[member]});const entry=(id,type,amount,extra={})=>({id,type,amount,memberId:'m',date:gregorian(1405,1,1),note:'',reference:'',period:'1405-01',...extra});
test('unpaid share due on last Persian calendar day',()=>{const state=createDues(start(),'1405-01'),snapshot=reminderSnapshot(state);assert.deepEqual(snapshot.shares,[gregorian(1405,1,31)]);assert.ok(!JSON.stringify(snapshot).includes('خصوصی'));});
test('paid share disappears, cancellation restores it',()=>{let state=createDues(start(),'1405-01');state=addEntry(state,entry('d','deposit',1000));assert.equal(reminderSnapshot(state).shares.length,0);state=cancelEntry(state,'d','اصلاح','c',gregorian(1405,1,2));assert.equal(reminderSnapshot(state).shares.length,1)});
test('paid installments excluded and future due dates retained',()=>{let state=addEntry(start(),entry('d','deposit',1000));state=addEntry(state,entry('l','loan',600,{months:3,calendar:'persian'}));state=addEntry(state,entry('r','repayment',200,{loanId:'l'}));assert.deepEqual(reminderSnapshot(state).installments,[gregorian(1405,3,1),gregorian(1405,4,1)])});
