import assert from 'node:assert/strict';
import {normalize,inputAudit,inputAuditEntries,summarize,subset,buildModel,medianSummary,numericCaution} from '../../tools/method-comparison/core.mjs';
import {reportData} from '../../tools/method-comparison/report-export.mjs';
const records=cells=>normalize(cells.map((cells,i)=>({cells,sourceRow:i+1})));
const r=(id,product='Positive',x='20',y='30',date='2026-01-01',ref='Positive')=>[id,date,ref,x,product,y];
const test=(name,fn)=>{fn();console.log('PASS '+name);};
test('input audit counts unknown before exclusion and separates rows from overlapping error fields',()=>{
 const rows=records([r('A','?'),r('B','Positive','bad','text','wrong','?'),r('','?'),r('C'),r('D','')]),a=inputAudit(rows);
 assert.equal(a.total,5);assert.equal(a.eligible,2);assert.equal(a.idExcluded,1);assert.equal(a.formatExcluded,2);
 assert.equal(a.productUnknown,2);assert.equal(a.referenceUnknown,1);assert.equal(a.dateFormat,1);assert.equal(a.xFormat,1);assert.equal(a.yFormat,1);
 assert.equal(a.eligible+a.idExcluded+a.formatExcluded,a.total);assert.equal(summarize(rows).valid,1);
 assert.equal(inputAuditEntries(rows).find(([k])=>k==='Product 결과 미인식 (항목별)')[1],2);
});
test('Reference-positive evaluability complements Invalid and missing without changing PPA',()=>{
 const rows=records(Array.from({length:100},(_,i)=>r('S'+i,i<90?'Positive':i<95?'Invalid':'',String(20+i/100),i<90?'30':''))),s=summarize(rows);
 assert.deepEqual(s.evaluability,{k:90,n:100,p:.9});assert.equal(s.detection.k,90);assert.equal(s.detection.n,90);assert.equal(s.detection.p,1);
 assert.equal(s.productInvalid,5);assert.equal(s.productMissing,5);assert.equal(s.FN,0);assert.equal(s.numeric.n,90);assert.equal(medianSummary(rows).all.n,100);
});
test('zero valid results is zero evaluability while no Reference positives has no denominator',()=>{
 const invalid=summarize(records([r('A','Invalid','','')])),negative=summarize(records([r('B','ND','','','','Negative')]));
 assert.deepEqual(invalid.evaluability,{k:0,n:1,p:0});assert.equal(invalid.detection.p,null);
 assert.deepEqual(negative.evaluability,{k:0,n:0,p:null});assert.equal(negative.npa.p,1);
});
test('filter narrows analysis denominator while complete-input validation remains explicit',()=>{
 const rows=records([r('A','Positive','15'),r('B','Invalid','25',''),r('C','?','25')]);
 const selected=subset(rows,{ct:'1',date:'all'},[20],[]),s=summarize(selected);
 assert.equal(selected.length,1);assert.deepEqual(s.evaluability,{k:0,n:1,p:0});assert.equal(inputAudit(rows).productUnknown,1);assert.equal(inputAudit(selected).productUnknown,0);
});
test('nonpositive warning preserves eligibility and malformed-date policy remains strict',()=>{
 const rows=records([r('A','Positive','0','-2'),r('B','Positive','-100','5000'),r('C','Positive','20','30','bad'),r('D','Positive','20','30','')]);
 assert.equal(inputAudit(rows).referenceNonpositive,2);assert.equal(inputAudit(rows).productNonpositive,1);
 assert.deepEqual(rows.map(r=>r.pair),[true,true,false,true]);assert.equal(summarize(rows).valid,3);
 assert(rows[0].issues.some(s=>s.includes('0 이하')));assert.equal(numericCaution(0),'');assert.equal(numericCaution(10),'');assert(numericCaution(3).includes('10개 미만'));
});
test('report preserves global audit, selected evaluability, raw unknown and seven-chart structure',()=>{
 const rows=records([r('A'),r('B','Invalid'),r('C','?')]),selected=rows.slice(0,2),snapshot={rows,model:buildModel(rows),confidence:.95,piLevel:.95,method:'exact',ct:[],dates:[],median:[],source:'synthetic'};
 const sheets=reportData(snapshot,selected,'선택');assert.equal(sheets.length,9);assert.equal(sheets.filter(s=>s.chart).length,6);assert.equal(sheets.reduce((n,s)=>n+(s.chart?.type==='scatter'?2:s.chart?1:0),0),7);
 const summary=new Map(sheets[0].rows.map(([k,v])=>[k,v?.value??v]));assert.equal(summary.get('Product 결과 미인식 (항목별)'),1);assert.equal(summary.get('현재 범위 Product 평가 가능률'),.5);
 const band=sheets.find(s=>s.name==='검출값구간');assert.equal(band.rows[0][band.headers.indexOf('평가 가능률')].value,.5);
 assert.equal(band.rows[0][1].value,1);assert.equal(band.chart.series[0],'유효 결과 중 검출률');assert(!band.headers.includes('미인식'));
 assert.equal(sheets.at(-1).rows[2][5],'?');assert(sheets.find(s=>s.name==='수치관계').notes.some(n=>n.includes('10개 미만')));
});
