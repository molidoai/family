import {validate,validDate,validPeriod} from './core.js';
import {validatePaymentRequest} from './inbox-schema.js';
export const checkRequest=r=>validatePaymentRequest(r,{validDate,validPeriod});
export function parseRequest(text){if(typeof text!=='string'||text.length>400000)throw Error('حداکثر حجم فایل درخواست ۴۰۰ کیلوبایت است.');return checkRequest(JSON.parse(text))}
export function receiveRequest(state,request,today){checkRequest(request);if(request.fundId!==state.inboxFundId)throw Error('این درخواست برای صندوق دیگری است.');if(request.date>today)throw Error('درخواست با تاریخ آینده قابل دریافت نیست.');const found=(state.inbox||[]).find(i=>i.request.id===request.id);if(found){if(JSON.stringify(found.request)!==JSON.stringify(request))throw Error('شناسه تکراری با محتوای متفاوت؛ فایل را بررسی کنید.');return state}return validate({...state,inbox:[...(state.inbox||[]),{request,receivedOn:today,status:'pending',decision:''}]})}
export function decidePayment(state,id,{status,memberId='',reason,date,entryId}){
 const item=(state.inbox||[]).find(i=>i.request.id===id);if(!item||item.status!=='pending')throw Error('این درخواست قبلاً بررسی شده یا وجود ندارد.');if(!['approved','rejected'].includes(status)||typeof reason!=='string'||!reason.trim()||reason.length>500||!validDate(date)||date<item.receivedOn)throw Error('تصمیم، تاریخ و توضیح معتبر لازم است.');
 let entries=state.entries;const next={...item,status,decision:reason.trim(),decisionOn:date};
 if(status==='approved'){
  const member=state.members.find(m=>m.id===memberId&&!m.archived);if(!member||member.joined>item.request.date)throw Error('عضو فعال و تاریخ عضویت پیش از واریز لازم است.');
  if(state.entries.some(e=>e.type==='deposit'&&e.reference.trim()===item.request.reference.trim()))throw Error('شماره پیگیری مشابه در دفتر وجود دارد؛ پیش از ثبت، تراکنش قبلی را بررسی کنید.');
  Object.assign(next,{memberId,entryId});const r=item.request;entries=[...entries,{id:entryId,type:'deposit',inboxId:r.id,memberId,amount:r.amount,date:r.date,period:r.period,reference:r.reference,note:('تأیید درخواست واریز: '+reason.trim()).slice(0,500)}];
 }
 return validate({...state,entries,inbox:state.inbox.map(i=>i===item?next:i)});
}
export function decisionPackage(state,id){const i=state.inbox.find(i=>i.request.id===id);if(!i)throw Error('درخواست پیدا نشد.');return {format:'hamsahm-payment-result',version:1,fundId:state.inboxFundId,requestId:id,amount:i.request.amount,reference:i.request.reference,status:i.status,decision:i.decision,date:i.decisionOn||i.receivedOn}}
export function acceptResult(request,result,previous='exported'){
 if(!result||result.format!=='hamsahm-payment-result'||result.version!==1||result.fundId!==request.fundId||result.requestId!==request.id||result.amount!==request.amount||result.reference!==request.reference||!['pending','approved','rejected'].includes(result.status)||typeof result.decision!=='string'||result.decision.length>500||!validDate(result.date)||result.date<request.date)throw Error('نتیجه با درخواست شما مطابقت ندارد.');
 const status=result.status==='pending'?'received':result.status;if(['approved','rejected'].includes(previous)&&previous!==status)throw Error('نتیجه نهایی با سابقه قبلی تعارض دارد.');return {status,decision:result.decision,date:result.date};
}
