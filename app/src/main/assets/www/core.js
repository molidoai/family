export const KEY='molido-family-fund-v1';
const pf=new Intl.DateTimeFormat('en-u-ca-persian-nu-latn',{year:'numeric',month:'numeric',day:'numeric',timeZone:'UTC'});
const fail=t=>{throw Error(t)},money=n=>Number.isSafeInteger(n)&&n>=0&&n<=1e12;
export function validDate(s){if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T12:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===s&&s>='1900-01-01'&&s<='2200-12-31'}
export function persian(date){if(!validDate(date))fail('تاریخ معتبر نیست.');const p=Object.fromEntries(pf.formatToParts(new Date(date+'T12:00:00Z')).map(x=>[x.type,x.value]));return [+p.year,+p.month,+p.day]}
export const periodOf=date=>{const [y,m]=persian(date);return `${y}-${String(m).padStart(2,'0')}`};
export function gregorian(y,m,d){if(!Number.isInteger(y)||y<1280||y>1578||!Number.isInteger(m)||m<1||m>12||!Number.isInteger(d)||d<1||d>31)fail('تاریخ شمسی معتبر نیست.');let lo=Math.floor(Date.UTC(y+621,0,1)/864e5),hi=Math.floor(Date.UTC(y+622,11,31)/864e5);const target=y*10000+m*100+d;while(lo<=hi){const mid=Math.floor((lo+hi)/2),iso=new Date(mid*864e5).toISOString().slice(0,10),p=persian(iso),key=p[0]*10000+p[1]*100+p[2];if(key===target)return iso;if(key<target)lo=mid+1;else hi=mid-1}fail('روز انتخاب‌شده در این ماه وجود ندارد.')}
export const validPeriod=p=>{if(typeof p!=='string'||!/^\d{4}-\d{2}$/.test(p))return false;try{const [y,m]=p.split('-').map(Number);gregorian(y,m,1);return true}catch{return false}};
export const empty=()=>({version:2,name:'صندوق خانوادگی',paymentUrl:'',members:[],dues:[],entries:[],draws:[],requests:[],constitution:''});
export const active=s=>{const reversed=new Set(s.entries.filter(e=>e.type==='reversal').map(e=>e.targetId));return s.entries.filter(e=>e.type!=='reversal'&&!reversed.has(e.id))};
const cash=entries=>entries.reduce((n,e)=>n+(['deposit','repayment'].includes(e.type)?e.amount:-e.amount),0);
export const balance=s=>cash(active(s));
export function remaining(s,id){const entries=active(s),l=entries.find(e=>e.id===id&&e.type==='loan');return l?l.amount-entries.filter(e=>e.type==='repayment'&&e.loanId===id).reduce((n,e)=>n+e.amount,0):0}
export function paidFor(s,memberId,period){return active(s).filter(e=>e.type==='deposit'&&e.memberId===memberId&&e.period===period).reduce((n,e)=>n+e.amount,0)}
export function safePayment(raw){if(!raw)return '';try{const u=new URL(raw);if(u.protocol!=='https:'||u.username||u.password||u.href.length>2000)fail('لینک HTTPS معتبر وارد کنید.');return u.href}catch{fail('لینک HTTPS معتبر وارد کنید.')}}
export function migrate(old){if(old?.version!==1)return old;return {...empty(),name:old.name,members:old.members.map(m=>({...m,phone:'',archived:false,joined:'2026-01-01'})),entries:old.entries.map(e=>({...e,period:e.type==='deposit'?periodOf(e.date):'',calendar:e.type==='loan'?'gregorian':undefined,reference:'',createdAt:''}))}}
export function validate(s){
 if(!s||s.version!==2||typeof s.name!=='string'||!s.name.trim()||s.name.length>100||!['members','dues','entries','draws'].every(k=>Array.isArray(s[k])))fail('ساختار پشتیبان معتبر نیست.');safePayment(s.paymentUrl);
 const members=new Map();for(const m of s.members){if(typeof m.id!=='string'||!m.id||members.has(m.id)||typeof m.name!=='string'||!m.name.trim()||m.name.length>100||!money(m.share)||typeof m.phone!=='string'||m.phone.length>30||typeof m.archived!=='boolean'||!validDate(m.joined))fail('اطلاعات عضو نامعتبر است.');members.set(m.id,m)}
 if(s.cloudFundId!==undefined&&(typeof s.cloudFundId!=='string'||!/^[-0-9a-f]{36}$/i.test(s.cloudFundId)))fail('شناسه صندوق آنلاین معتبر نیست.');
 if(s.constitution!==undefined&&(typeof s.constitution!=='string'||s.constitution.length>20000))fail('متن اساسنامه معتبر نیست.');
 if(s.requests!==undefined&&!Array.isArray(s.requests))fail('درخواست‌های وام معتبر نیست.');
 const requestIds=new Set();for(const r of s.requests||[]){if(typeof r.id!=='string'||!r.id||requestIds.has(r.id)||!members.has(r.memberId)||!money(r.amount)||!r.amount||!Number.isInteger(r.months)||r.months<1||r.months>120||r.months>r.amount||!validDate(r.date)||!validDate(r.targetDate)||r.targetDate<r.date||typeof r.reason!=='string'||!r.reason.trim()||r.reason.length>500||!['pending','approved','rejected'].includes(r.status)||typeof r.decision!=='string'||r.decision.length>500||(r.status!=='pending'&&(!r.decision.trim()||!validDate(r.decisionDate)||r.decisionDate<r.date)))fail('درخواست وام نامعتبر است.');requestIds.add(r.id)}
 const periods=new Set();for(const d of s.dues){const key=d.memberId+':'+d.period;if(!members.has(d.memberId)||!validPeriod(d.period)||!money(d.amount)||periods.has(key))fail('سهم ماهانه نامعتبر یا تکراری است.');periods.add(key)}
 const ids=new Map(),reversed=new Set();for(const e of s.entries){
 if(typeof e.id!=='string'||!e.id||ids.has(e.id)||!validDate(e.date)||!money(e.amount)||e.amount===0||typeof e.note!=='string'||e.note.length>500||typeof e.reference!=='string'||e.reference.length>100)fail('تراکنش نامعتبر است.');
 if(e.type==='reversal'){const target=ids.get(e.targetId);if(!target||target.type==='reversal'||reversed.has(e.targetId)||target.amount!==e.amount||e.memberId!==target.memberId||!e.note.trim()||e.date<target.date)fail('ابطال معتبر نیست.');reversed.add(e.targetId)}
 else{if(!['deposit','expense','loan','repayment'].includes(e.type))fail('نوع تراکنش نامعتبر است.');if(e.type!=='expense'&&!members.has(e.memberId))fail('عضو تراکنش وجود ندارد.');if(e.type==='deposit'&&!validPeriod(e.period))fail('ماه سهم را مشخص کنید.');if(e.type==='loan'&&(!Number.isInteger(e.months)||e.months<1||e.months>120||e.months>e.amount||!['persian','gregorian'].includes(e.calendar)))fail('تعداد اقساط یا تقویم وام معتبر نیست.');}
 ids.set(e.id,e);
 }
 // Replay surviving original entries: cancelling a funding entry must not invalidate a later loan.
 const prior=[];for(const e of active(s)){
 if(['expense','loan'].includes(e.type)&&e.amount>cash(prior))fail('موجودی کافی نیست؛ سوابق وابسته نیز باید بررسی شوند.');
 if(e.type==='repayment'){const loan=prior.find(l=>l.type==='loan'&&l.id===e.loanId);if(!loan||loan.memberId!==e.memberId||e.date<loan.date||e.amount>loan.amount-prior.filter(r=>r.type==='repayment'&&r.loanId===loan.id).reduce((n,r)=>n+r.amount,0))fail('وام یا مبلغ بازپرداخت معتبر نیست.')}
 prior.push(e);if(!Number.isSafeInteger(cash(prior)))fail('جمع مبالغ بیش از حد مجاز است.');
 }
 const funded=new Set();for(const e of active(s).filter(e=>e.type==='loan'&&e.requestId)){const r=(s.requests||[]).find(r=>r.id===e.requestId);if(!r||r.status!=='approved'||funded.has(r.id)||r.memberId!==e.memberId||r.amount!==e.amount||r.months!==e.months||e.date<r.decisionDate)fail('ارتباط وام و درخواست معتبر نیست.');funded.add(r.id)}
 const drawIds=new Set();for(const d of s.draws){if(typeof d.id!=='string'||drawIds.has(d.id)||!members.has(d.winnerId)||!Array.isArray(d.candidates)||!d.candidates.length||new Set(d.candidates).size!==d.candidates.length||d.candidates.some(id=>!members.has(id))||!d.candidates.includes(d.winnerId)||!validDate(d.date))fail('سوابق قرعه‌کشی معتبر نیست.');drawIds.add(d.id)}
 return s;
}
export const addEntry=(s,e)=>validate({...s,entries:[...s.entries,e]});
export function cancelEntry(s,id,reason,newId,date){const e=s.entries.find(e=>e.id===id);if(!e)fail('تراکنش پیدا نشد.');return addEntry(s,{id:newId,type:'reversal',targetId:id,amount:e.amount,memberId:e.memberId,date,note:reason,reference:''})}
export function createDues(s,period){if(!validPeriod(period))fail('ماه معتبر نیست.');const dues=[...s.dues];for(const m of s.members.filter(m=>!m.archived&&periodOf(m.joined)<=period)){if(!dues.some(d=>d.memberId===m.id&&d.period===period))dues.push({memberId:m.id,period,amount:m.share})}return validate({...s,dues})}
export function schedule(s,loan){let paid=loan.amount-remaining(s,loan.id);const base=Math.floor(loan.amount/loan.months),p=persian(loan.date);return Array.from({length:loan.months},(_,i)=>{const amount=base+(i<loan.amount%loan.months?1:0);let date;if(loan.calendar==='persian'){const total=p[0]*12+p[1]-1+i+1,y=Math.floor(total/12),m=total%12+1;let day=p[2];while(day){try{date=gregorian(y,m,day);break}catch{day--}}if(!date)fail('محاسبه تاریخ قسط ممکن نیست.')}else{const d=new Date(loan.date+'T12:00:00Z'),day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+i+1);const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last));date=d.toISOString().slice(0,10)}const covered=Math.min(paid,amount);paid-=covered;return {date,amount,due:amount-covered}})}
export function secureIndex(length,random=()=>crypto.getRandomValues(new Uint32Array(1))[0]){if(!Number.isInteger(length)||length<1||length>1e6)fail('تعداد اعضا معتبر نیست.');const limit=Math.floor(2**32/length)*length;let n;do{n=random()}while(n>=limit);return n%length}
