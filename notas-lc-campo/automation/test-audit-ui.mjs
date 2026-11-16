import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const ctx={Intl,Date,window:{}};vm.createContext(ctx);const app=new URL('../',import.meta.url);vm.runInContext(fs.readFileSync(new URL('audit.js',app),'utf8'),ctx);vm.runInContext(fs.readFileSync(new URL('audit-data.js',app),'utf8'),ctx);const A=ctx.LCAudit;
const at=new Date('2026-10-28T02:00:00Z');assert.equal(A.day(at),'2026-10-27');
const r=day=>({day,who:'Teste'});
// Calendar-day validity in Brazil: the marker survives day 59 and expires on day 60.
for(const [day,days] of [['2026-10-27',0],['2026-09-28',29],['2026-09-27',30],['2026-08-29',59]]){
 const records=[r(day)],snapshot=JSON.stringify(records);
 assert.equal(A.recent(records,at)[0].days,days);
 assert.equal(JSON.stringify(records),snapshot,'Reading validity must preserve inspection history');
}
for(const day of ['2026-08-28','2026-08-27','2026-10-28','invalid','2026-02-30'])assert.equal(A.recent([r(day)],at).length,0);
assert.equal(A.recent([r('2026-08-28'),r('2026-10-26')],at)[0].days,1,'New Manter renews validity');
const boundary=[r('2026-08-29')];
assert.equal(A.recent(boundary,new Date('2026-10-28T02:59:59Z'))[0].days,59);
assert.equal(A.recent(boundary,new Date('2026-10-28T03:00:00Z')).length,0,'Expires at Brazilian calendar-day boundary');
assert(A.matches(new Set(['audited']),undefined,A.recent(boundary,at).length>0));
assert(!A.matches(new Set(['audited']),undefined,A.recent(boundary,new Date('2026-10-28T03:00:00Z')).length>0));
assert(A.matches(new Set(['none']),undefined,A.recent(boundary,new Date('2026-10-28T03:00:00Z')).length>0));
assert(!A.matches(new Set(['none']),undefined,true));assert(A.matches(new Set(['audited']),undefined,true));assert(!A.matches(new Set(['audited']),undefined,false));assert.equal(A.normalizeId('000012207119'),'12207119');const index=A.index(ctx.window.LCAudits);assert(index['12207119'].some(r=>r.who==='Felipe Vieira'&&r.day==='2026-10-26'));
const html=fs.readFileSync(new URL('index.html',app),'utf8'),sw=fs.readFileSync(new URL('sw.js',app),'utf8'),code=fs.readFileSync(new URL('app.js',app),'utf8');for(const f of ['audit.js','audit-data.js']){assert(html.includes(f));assert(sw.includes(f))}assert(code.includes('Conferida 60d'));assert(!code.includes('Conferida 30d'));assert(code.includes('LCAudit.matches(selectedEvaluations'));assert(code.includes('data-audit='));console.log('Passed: date boundaries, renewal, filters, IDs, real example and offline resources.');
