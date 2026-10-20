import {active,balance,createDues,periodOf,schedule,paidFor} from './core.js';

// Local, deterministic suggestions. Computing a plan never changes the ledger.
export function dailyPlan(state,asOf){
 const period=periodOf(asOf),snapshot={...state,entries:state.entries.filter(e=>e.date<=asOf)};
 const planned=createDues(state,period),missing=planned.dues.slice(state.dues.length);
 const end=new Date(asOf+'T12:00:00Z');end.setUTCDate(end.getUTCDate()+7);const until=end.toISOString().slice(0,10);
 const entries=active(snapshot),installments=entries.filter(e=>e.type==='loan').flatMap(l=>schedule(snapshot,l).filter(p=>p.due>0).map(p=>({...p,loanId:l.id,memberId:l.memberId})));
 const overdue=installments.filter(p=>p.date<asOf),upcoming=installments.filter(p=>p.date>=asOf&&p.date<=until).sort((a,b)=>a.date.localeCompare(b.date));
 const dues=state.dues.filter(d=>d.period===period),expected=dues.reduce((n,d)=>n+d.amount,0),collected=dues.reduce((n,d)=>n+Math.min(d.amount,paidFor(snapshot,d.memberId,period)),0);
 const funded=new Set(active(state).filter(e=>e.type==='loan'&&e.requestId).map(e=>e.requestId));
 const requests=(state.requests||[]).filter(r=>r.date<=asOf&&!funded.has(r.id)&&!state.members.find(m=>m.id===r.memberId)?.archived);
 const waiting=requests.filter(r=>r.status==='approved'),first=waiting[0]||null,cash=balance(snapshot);
 return {memberCount:state.members.length,period,asOf,missing,missingTotal:missing.reduce((n,d)=>n+d.amount,0),overdue,overdueTotal:overdue.reduce((n,p)=>n+p.due,0),upcoming,expected,collected,shareRemaining:expected-collected,pending:requests.filter(r=>r.status==='pending').length,waiting:waiting.length,nextRequest:first,nextRequestAffordable:!!first&&first.amount<=cash,cash};
}

export function renderAssistant(plan,{fmt,date,esc,action,broken=false}){
 if(broken)return '<section class="panel smartPanel"><h2>ابتدا اطلاعات صندوق را بازیابی کنید</h2><p>برای حفاظت از سوابق، پیشنهاد و ثبت مالی تا بازیابی نسخه سالم متوقف است.</p><button data-page="settings">پشتیبان و بازیابی</button></section>';
 const tasks=[];
 if(!plan.memberCount)tasks.push({title:'اولین عضو صندوق را اضافه کنید',text:'نام و سهم ماهانه را تعیین کنید تا برنامه کارهای ماه را آماده کند.',button:action('member','＋ عضو جدید','','primary')});
 if(plan.missing.length)tasks.push({title:'سهم ماه جدید آماده ثبت است',text:fmt(plan.missing.length)+' عضو · '+fmt(plan.missingTotal)+' تومان · '+plan.period.replace('-','/'),button:action('smartDues','بررسی و تأیید سهم‌ها','','primary')});
 if(plan.overdue.length)tasks.push({title:'پیگیری اقساط عقب‌افتاده',text:fmt(plan.overdue.length)+' قسط · '+fmt(plan.overdueTotal)+' تومان',button:'<button data-page="overdue">مشاهده و پیگیری</button>'});
 if(plan.pending)tasks.push({title:'درخواست وام منتظر تصمیم شماست',text:fmt(plan.pending)+' درخواست بررسی‌نشده',button:'<button data-page="requests">بررسی درخواست‌ها</button>'});
 if(plan.nextRequest)tasks.push({title:plan.nextRequestAffordable?'نوبت بعدی وام قابل بررسی است':'موجودی برای نوبت بعدی وام کافی نیست',text:fmt(plan.nextRequest.amount)+' تومان · '+(plan.nextRequestAffordable?'پرداخت فقط پس از تأیید مدیر':'کسری '+fmt(plan.nextRequest.amount-plan.cash)+' تومان'),button:'<button data-page="requests">مشاهده صف وام</button>'});
 if(plan.shareRemaining>0)tasks.push({title:'پیگیری مانده سهم این ماه',text:fmt(plan.shareRemaining)+' تومان از تعهدهای ثبت‌شده هنوز وصول نشده است.',button:'<button data-page="dues">مشاهده سهم‌ها</button>'});
 return `<section class="panel smartPanel" aria-label="دستیار روزانه صندوق"><div class="row"><div><span class="sectionLabel">دستیار روزانه</span><h2>امروز چه کاری انجام دهم؟</h2></div><span class="tag">${esc(date(plan.asOf))}</span></div><p class="hint">محاسبه خودکار از سوابق همین صندوق؛ ثبت سهم و پرداخت با تأیید شما انجام می‌شود.</p><div class="smartTasks">${tasks.map((t,i)=>`<article class="smartTask"><span class="taskNumber">${fmt(i+1)}</span><div><h3>${t.title}</h3><p>${esc(t.text)}</p></div>${t.button}</article>`).join('')||'<p class="smartClear">کار فوری ثبت‌شده‌ای باقی نمانده است؛ سوابق و رسیدهای واقعی را هم بررسی کنید.</p>'}</div><div class="smartUpcoming"><h3>اقساط هفت روز آینده</h3>${plan.upcoming.slice(0,3).map(p=>`<div class="detailLine"><span>${esc(date(p.date))} · ${fmt(p.due)} تومان</span>${action('repay','ثبت بازپرداخت',p.loanId,'link')}</div>`).join('')||'<p class="hint">قسط پرداخت‌نشده‌ای در این بازه نیست.</p>'}${plan.upcoming.length>3?'<button data-page="loans" class="link">مشاهده همه اقساط</button>':''}</div></section><section class="quickActions" aria-label="کارهای پرکاربرد">${action('entry','＋ ثبت تراکنش')}<button data-page="members">اعضا و کارت حساب</button><button data-page="dues">سهم ماهانه</button><button data-page="reports">گزارش ماه</button>${action('encryptedBackup','پشتیبان امن')}</section>`;
}
