import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {compose} from '../../tools/dilution-calculator/composer-core.mjs';
const cases=[
 ['te-am9849',1,[{},{}],['1 mL','0.2 mL']],
 ['low-te-4479554',1,[{},{}],['1 mL','0.02 mL']],
 ['tae-15558042',10,[{stock:'1',stockUnit:'M'},{stock:'0.5',stockUnit:'M'}],['40 mL','2 mL']],
 ['tbe-am986x',10,[{mw:'121.14'},{mw:'61.83'},{stock:'0.5',stockUnit:'M'}],['10.78146 g','5.50287 g','4 mL']],
 ['ssc-reference',20,[{mw:'58.44'},{mw:'294.10'}],['17.532 g','8.823 g']],
 ['pbs-10010023',1,[{},{},{}],['0.0144 g','0.9 g','0.0795 g']],
 ['rcutsmart-b6004',10,[{mw:'98.14'},{stock:'1',stockUnit:'M'},{mw:'214.45'},{stock:'20',stockUnit:'mg/mL'}],['4.907 g','20 mL','2.1445 g','5 mL']],
 ['isothermal-b0537',10,[{stock:'1',stockUnit:'M'},{mw:'74.55'},{mw:'132.14'},{mw:'246.47'},{}],['20 mL','3.7275 g','1.3214 g','0.49294 g','1 mL']],
 ['qiagen-p1',1,[{stock:'1',stockUnit:'M'},{stock:'0.5',stockUnit:'M'},{stock:'10',stockUnit:'mg/mL'}],['5 mL','2 mL','1 mL']],
 ['qiagen-p2',1,[{mw:'40'},{}],['0.8 g','1 g']],
 ['qiagen-qbt',1,[{mw:'58.44'},{mw:'209.26'},{},{}],['4.383 g','1.0463 g','15 mL','1.5 mL']],
 ['qiagen-qc',1,[{mw:'58.44'},{mw:'209.26'},{}],['5.844 g','1.0463 g','15 mL']],
 ['qiagen-qf',1,[{mw:'58.44'},{mw:'121.14'},{}],['7.305 g','0.6057 g','15 mL']],
 ['ssiii-first',5,[{stock:'1',stockUnit:'M'},{mw:'74.55'},{mw:'203.30'}],['25 mL','2.795625 g','0.30495 g']],
 ['tris-hcl-1m-ph8',1,[{mw:'121.14'}],['12.114 g']],
 ['edta-0p5m-ph8',1,[{mw:'372.24'}],['18.612 g']],
 ['tae-50x-qiagen',50,[{},{},{}],['24.2 g','5.71 mL','10 mL']],
 ['dpbs-14190',1,[{},{},{},{}],['0.02 g','0.02 g','0.8 g','0.216 g']],
 ['qiagen-eb',1,[{mw:'121.14'}],['0.12114 g']],
 ['qiagen-ae',1,[{mw:'121.14'},{}],['0.12114 g','0.1 mL']]
];

const data=JSON.parse(readFileSync(new URL('../../tools/dilution-calculator/presets.json',import.meta.url)));
assert.equal(cases.length,20);assert.equal(data.recipes.length,cases.length);
for(const [id,fold,inputs,amounts] of cases){const p=data.recipes.find(p=>p.id===id);assert(p,id);assert.equal(p.defaultFold,String(fold),id+' default fold');const rows=p.rows.map((r,i)=>({...r,...inputs[i]}));const result=compose({volume:'100',unit:'mL',fold:p.defaultFold,solvent:'DW'},rows);assert.equal(result.complete,true,id);assert.deepEqual(result.rows.map(r=>r.amount),amounts,id+'100mL source-fold amounts');}
for(const id of ['tris-hcl-1m-ph8','edta-0p5m-ph8']){const p=data.recipes.find(p=>p.id===id);assert(p.fixedFold);assert.equal(p.defaultFold,'1');}
console.log('PASS:20 independently specified default-fold and100mL calculation oracles; foundational stock1X retained.');
