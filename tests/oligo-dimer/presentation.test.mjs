import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import * as c from '../../tools/oligo-analysis/core.mjs';
const records=c.parseInput('A GCGCGCAAAGCGCGC\nB GCGCGC').records,result=c.runAnalysis(records,'idt',{self:true,hetero:true,poly:true}),pair=result.pairs.find(p=>p.first==='A × B × B'),before=JSON.stringify(result.pairs);
assert.deepEqual(new Set(pair.structures.map(s=>s.category)),new Set(['strong','mixed']));
for(const category of ['all','strong','mixed']){
 const filter={cutoff:-9000000,terminal:true,polyCutoff:null,polyCategory:category},shown=c.filteredPairs(result.pairs,filter),poly=shown.filter(p=>p.kind==='poly');
 assert(poly.length);assert(poly.every(p=>p.structures.every(s=>category==='all'||s.category===category)));
 const plain=c.textReport(records,shown,'idt',{...result,filters:filter}),rich=c.excelReport(records,shown,'idt',{...result,filters:filter});
 assert(plain.includes(c.polyCategoryLabel(category)));assert(plain.includes('점수 합 검색: 제한 없음'));
 for(const text of ['IDT 관측값 대조 모델','IDT 권고 참고','사용자 요청 로컬 보조','실제 복합체 ΔG 아님'])assert(plain.includes(text));
 assert(rich.includes(c.polyCategoryLabel(category)));assert(!/colspan|rowspan|<br\b/.test(rich));
}
assert.equal(c.visibleStructures(pair,{polyCategory:'strong',polyCutoff:-40000000}).length,0);
assert.equal(c.visibleStructures(pair,{polyCategory:'mixed',polyCutoff:null}).length,1);
assert.throws(()=>c.visibleStructures(pair,{polyCategory:'unknown'}));assert.throws(()=>c.polyCategoryLabel('unknown'));
assert.equal(JSON.stringify(result.pairs),before,'Display category/cutoff cannot mutate analysis');
const weak=c.runAnalysis(c.parseInput('A GCGAAAGCG\nB CGC').records,'idt',{poly:true}),w=weak.pairs.find(p=>p.first==='A × B × B');assert.equal(c.visibleStructures(w,{polyCategory:'all'}).length,1);assert.equal(c.visibleStructures(w,{polyCategory:'strong'}).length,0);assert(w.structures[0].edges.every(e=>e.micros> -9000000));
const thermo=c.runAnalysis(records,'thermo'),tp=c.filteredPairs(thermo.pairs,{polyCategory:'strong',polyCutoff:-1000000000,cutoff:-1000000000});assert.deepEqual(tp.map(p=>p.structures),thermo.pairs.filter(p=>p.structures.length).map(p=>p.structures));assert.doesNotMatch(c.textReport(records,tp,'thermo',thermo),/ΔG|cut-off|3′|点数|점수 합|탐색 범주/);
const html=await readFile(new URL('../../tools/oligo-analysis/index.html',import.meta.url),'utf8');assert(!html.match(/<input id="include-poly"[^>]*>/)[0].includes('checked'));assert(!html.match(/<input id="poly-cutoff"[^>]*>/)[0].includes('value='));assert(html.includes('<option value="all">전체'));assert(html.includes('IDT 공식 수치 기준이 아닙니다'));
console.log('PASS: category all/strong/mixed, optional score search, weak candidate retention, immutable results, source-labelled text/Excel, Thermo isolation and UI defaults.');
