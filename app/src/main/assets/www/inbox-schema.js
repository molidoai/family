const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export {uuid as validInboxId};
export function validatePaymentRequest(r,{validDate,validPeriod}){
 const fail=()=>{throw Error('فایل درخواست واریز معتبر نیست.')};
 const fields=['format','version','id','fundId','name','amount','date','period','reference','note','receipt'];
 if(!r||typeof r!=='object'||Array.isArray(r)||Object.keys(r).some(k=>!fields.includes(k))||r.format!=='hamsahm-payment-request'||r.version!==1||!uuid(r.id)||!uuid(r.fundId)||typeof r.name!=='string'||!r.name.trim()||r.name.length>100||!Number.isSafeInteger(r.amount)||r.amount<1||r.amount>1e12||!validDate(r.date)||!validPeriod(r.period)||typeof r.reference!=='string'||!r.reference.trim()||r.reference.length>100||typeof r.note!=='string'||r.note.length>500||typeof r.receipt!=='string')fail();
 if(r.receipt){if(r.receipt.length>350000||!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(r.receipt))fail();let raw;try{raw=atob(r.receipt.split(',')[1])}catch{fail()}if(raw.length>250000||raw.length<8)fail();if(r.receipt.startsWith('data:image/png')?!raw.startsWith('\x89PNG\r\n\x1a\n'):!(raw.charCodeAt(0)===255&&raw.charCodeAt(1)===216&&raw.charCodeAt(2)===255))fail()}
 return r;
}
export function validateInbox(state,helpers){
 if(state.inboxFundId!==undefined&&!uuid(state.inboxFundId))throw Error('شناسه صندوق پیام معتبر نیست.');
 if(state.inbox===undefined){if(state.entries.some(e=>e.inboxId!==undefined))throw Error('سابقه درخواست تراکنش وجود ندارد.');return;}if(!Array.isArray(state.inbox)||state.inbox.length>500)throw Error('صندوق پیام نامعتبر یا پر است.');
 const ids=new Set();let attachmentSize=0;
 for(const item of state.inbox){const r=validatePaymentRequest(item?.request,helpers);if(ids.has(r.id)||r.fundId!==state.inboxFundId||!helpers.validDate(item.receivedOn)||item.receivedOn<r.date||!['pending','approved','rejected'].includes(item.status)||typeof item.decision!=='string'||item.decision.length>500)throw Error('سابقه صندوق پیام معتبر نیست.');ids.add(r.id);attachmentSize+=r.receipt.length;
  if(item.status==='pending'){if(item.entryId||item.memberId||item.decisionOn||item.decision)throw Error('درخواست بررسی‌نشده تصمیم ندارد.');continue}
  if(!item.decision.trim()||!helpers.validDate(item.decisionOn)||item.decisionOn<item.receivedOn)throw Error('سابقه تصمیم مدیر معتبر نیست.');
  if(item.status==='rejected'){if(item.entryId||item.memberId)throw Error('درخواست ردشده تراکنش ندارد.');continue}
  const entry=state.entries.find(e=>e.id===item.entryId);if(!entry||entry.type!=='deposit'||entry.inboxId!==r.id||entry.memberId!==item.memberId||entry.amount!==r.amount||entry.date!==r.date||entry.period!==r.period||entry.reference!==r.reference)throw Error('ارتباط درخواست و تراکنش معتبر نیست.');
 }
 if(attachmentSize>2500000)throw Error('حجم رسیدهای صندوق پیام بیش از حد مجاز است؛ از اطلاعات پشتیبان بگیرید.');
 const linked=new Set();for(const e of state.entries.filter(e=>e.inboxId!==undefined)){const item=state.inbox.find(i=>i.request.id===e.inboxId&&i.status==='approved'&&i.entryId===e.id);if(!item||linked.has(e.inboxId))throw Error('تراکنش صندوق پیام تکراری یا بدون سابقه است.');linked.add(e.inboxId)}
}
