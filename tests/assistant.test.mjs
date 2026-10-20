import test from 'node:test';import assert from 'node:assert/strict';
import {empty,createDues,addEntry,cancelEntry,gregorian} from '../app/src/main/assets/www/core.js';
import {dailyPlan,renderAssistant} from '../app/src/main/assets/www/assistant.js';
const start=gregorian(1405,1,1),second=gregorian(1405,2,1),third=gregorian(1405,3,1);
const member={id:'m',name:'عضو',share:500,phone:'',joined:start,archived:false};
const initial=()=>({...empty(),members:[member]});
const deposit={id:'d',type:'deposit',memberId:'m',amount:2000,date:start,period:'1405-01',note:'',reference:''};
test('daily suggestions preserve the ledger and only prepare missing eligible current-month dues',()=>{
 const state={...initial(),members:[member,{...member,id:'archived',archived:true},{...member,id:'future',joined:third}]};const raw=JSON.stringify(state),plan=dailyPlan(state,second);assert.equal(JSON.stringify(state),raw);assert.equal(plan.period,'1405-02');assert.deepEqual(plan.missing.map(d=>d.memberId),['m']);assert.equal(plan.missingTotal,500);
 const once=createDues(state,plan.period),twice=createDues(once,plan.period);assert.equal(dailyPlan(once,second).missing.length,0);assert.deepEqual(once,twice);assert.equal(dailyPlan(state,third).missing.length,2);
});
test('daily amounts exclude future payments and future reversals',()=>{
 let state=createDues(initial(),'1405-01');state=addEntry(state,{...deposit,amount:200,date:second});const p=dailyPlan(state,start);assert.equal(p.collected,0);assert.equal(p.shareRemaining,500);assert.equal(p.cash,0);
 state=addEntry(initial(),deposit);state=cancelEntry(state,'d','اصلاح','c',third);assert.equal(dailyPlan(state,second).cash,2000);assert.equal(dailyPlan(state,third).cash,0);
});
test('installment advice separates partial overdue from seven-day upcoming installments',()=>{
 let state=addEntry(initial(),deposit);state=addEntry(state,{id:'l',type:'loan',memberId:'m',date:start,amount:600,months:3,calendar:'persian',note:'',reference:''});state=addEntry(state,{id:'r',type:'repayment',memberId:'m',loanId:'l',date:second,amount:100,note:'',reference:''});
 const date=gregorian(1405,2,2),p=dailyPlan(state,date);assert.equal(p.overdueTotal,100);assert.equal(p.overdue.length,1);assert.equal(p.upcoming.length,0);const due=dailyPlan(state,third);assert.equal(due.upcoming[0].date,third);assert.equal(due.upcoming[0].due,200);
});
test('loan queue keeps approved order and never suggests already funded requests',()=>{
 const request={id:'a',memberId:'m',date:start,targetDate:start,amount:1800,months:2,reason:'وام',status:'approved',decision:'تأیید',decisionDate:start};let state={...addEntry(initial(),deposit),requests:[request,{...request,id:'b',amount:300},{...request,id:'p',status:'pending',decision:''}]};const p=dailyPlan(state,start);assert.equal(p.nextRequest.id,'a');assert.equal(p.nextRequestAffordable,true);assert.equal(p.pending,1);
 state=addEntry(state,{id:'l',type:'loan',requestId:'a',memberId:'m',date:second,amount:1800,months:2,calendar:'persian',note:'',reference:''});assert.equal(dailyPlan(state,start).nextRequest.id,'b');assert.equal(dailyPlan(state,second).nextRequestAffordable,false);
});
test('broken-ledger dashboard provides recovery instead of financial actions',()=>{
 const html=renderAssistant(dailyPlan(initial(),start),{broken:true});assert.ok(html.includes('بازیابی'));assert.ok(!html.includes('smartDues'));
});
