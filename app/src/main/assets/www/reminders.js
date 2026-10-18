import {active,schedule,paidFor,gregorian} from './core.js';
export function reminderSnapshot(state){
 const installments=active(state).filter(e=>e.type==='loan').flatMap(loan=>schedule(state,loan).filter(p=>p.due>0).map(p=>p.date));
 const shares=state.dues.filter(d=>d.amount>paidFor(state,d.memberId,d.period)).map(d=>{const [year,month]=d.period.split('-').map(Number);const next=gregorian(month===12?year+1:year,month===12?1:month+1,1);const day=new Date(next+'T12:00:00Z');day.setUTCDate(day.getUTCDate()-1);return day.toISOString().slice(0,10)});
 return {installments,shares};
}
