/* Dates without times in the inspection consolidation are calendar days in Brazil. */
(function(g){
const normalizeId=value=>{const text=String(value??'').trim();return /^\d+$/.test(text)?text.replace(/^0+(?=\d)/,''):text};
function index(records){const result=Object.create(null);for(const [id,items] of Object.entries(records)){const key=normalizeId(id);const group=result[key]||(result[key]=[]);for(const item of items)if(!group.some(r=>r.day===item.day&&r.time===item.time&&r.who===item.who&&r.source===item.source))group.push(item)}return result}
const day=value=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
function dayNumber(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return NaN;const n=Date.parse(value+'T00:00:00Z');return Number.isFinite(n)&&new Date(n).toISOString().slice(0,10)===value?n/86400000:NaN}
function recent(records,at=new Date()){const today=dayNumber(day(at));return records.map(r=>({...r,days:today-dayNumber(r.day)})).filter(r=>Number.isInteger(r.days)&&r.days>=0&&r.days<30).sort((a,b)=>a.days-b.days||String(b.time||'').localeCompare(String(a.time||'')))}
function matches(selected,status,confirmed){if(!selected.size)return true;return (selected.has('audited')&&confirmed)||(selected.has('none')&&!status&&!confirmed)||(!!status&&selected.has(status))}
g.LCAudit={normalizeId,index,day,recent,matches};
})(typeof globalThis!=='undefined'?globalThis:window);
