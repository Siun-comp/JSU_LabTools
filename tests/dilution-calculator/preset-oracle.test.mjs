// Expected specifications are written from primary-source review, not generated from presets.
// MW and unspecified stock concentrations below are explicit synthetic user inputs.
import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {compose} from '../../tools/dilution-calculator/composer-core.mjs';
const data=JSON.parse(readFileSync(new URL('../../tools/dilution-calculator/presets.json',import.meta.url)));
const batch={volume:'1000',unit:'mL',fold:'1',solvent:'DW'},results=[];
const cases=[
 ['te-am9849',[[10,'mM','stock'],[1,'mM','stock']],[{stock:'1',stockUnit:'M'},{stock:'.5',stockUnit:'M'}],['10 mL','2 mL']],
 ['low-te-4479554',[[10,'mM','stock'],[.1,'mM','stock']],[{},{}],['10 mL','0.2 mL']],
 ['tae-15558042',[[40,'mM','stock'],[1,'mM','stock']],[{stock:'1',stockUnit:'M'},{stock:'.5',stockUnit:'M'}],['40 mL','2 mL']],
 ['tbe-am986x',[[89,'mM','solid'],[89,'mM','solid'],[2,'mM','stock']],[{mw:'121.14'},{mw:'61.83'},{stock:'.5',stockUnit:'M'}],['10.78146 g','5.50287 g','4 mL']],
 ['ssc-reference',[[150,'mM','solid'],[15,'mM','solid']],[{mw:'58.44'},{mw:'294.10'}],['8.766 g','4.4115 g']],
 ['pbs-10010023',[[144,'mg/L','solid'],[9000,'mg/L','solid'],[795,'mg/L','solid']],[{},{},{}],['0.144 g','9 g','0.795 g']],
 ['rcutsmart-b6004',[[50,'mM','solid'],[20,'mM','stock'],[10,'mM','solid'],[100,'ug/mL','stock']],[{mw:'98.14'},{stock:'1',stockUnit:'M'},{mw:'214.45'},{stock:'20',stockUnit:'mg/mL'}],['4.907 g','20 mL','2.1445 g','5 mL']],
 ['isothermal-b0537',[[20,'mM','stock'],[50,'mM','solid'],[10,'mM','solid'],[2,'mM','solid'],[.1,'%v/v','pure']],[{stock:'1',stockUnit:'M'},{mw:'74.55'},{mw:'132.14'},{mw:'246.47'},{}],['20 mL','3.7275 g','1.3214 g','0.49294 g','1 mL']],
 ['qiagen-p1',[[50,'mM','stock'],[10,'mM','stock'],[100,'ug/mL','stock']],[{stock:'1',stockUnit:'M'},{stock:'.5',stockUnit:'M'},{stock:'10',stockUnit:'mg/mL'}],['50 mL','20 mL','10 mL']],
 ['qiagen-p2',[[200,'mM','solid'],[1,'%w/v','solid']],[{mw:'40'},{}],['8 g','10 g']],
 ['qiagen-qbt',[[.75,'M','solid'],[50,'mM','solid'],[15,'%v/v','pure'],[.15,'%v/v','stock']],[{mw:'58.44'},{mw:'209.26'},{},{}],['43.83 g','10.463 g','150 mL','15 mL']],
 ['qiagen-qc',[[1,'M','solid'],[50,'mM','solid'],[15,'%v/v','pure']],[{mw:'58.44'},{mw:'209.26'},{}],['58.44 g','10.463 g','150 mL']],
 ['qiagen-qf',[[1.25,'M','solid'],[50,'mM','solid'],[15,'%v/v','pure']],[{mw:'58.44'},{mw:'121.14'},{}],['73.05 g','6.057 g','150 mL']],
 ['ssiii-first',[[50,'mM','stock'],[75,'mM','solid'],[3,'mM','solid']],[{stock:'1',stockUnit:'M'},{mw:'74.55'},{mw:'203.30'}],['50 mL','5.59125 g','0.6099 g']]
];
for(const [id,spec,inputs,amounts] of cases){
 const p=data.recipes.find(p=>p.id===id);assert(p,id);assert.deepEqual(p.rows.map(r=>[Number(r.target),r.unit,r.mode]),spec,id+' source concentrations/methods');
 const rows=p.rows.map((r,i)=>({...r,...inputs[i]}));const out=compose(batch,rows);assert.equal(out.complete,true,id);assert.deepEqual(out.rows.map(r=>r.amount),amounts,id);
 results.push({id,spec,inputs,expected:amounts,status:'passed'});
}
assert.equal(cases.length,data.recipes.length);
const p=id=>data.recipes.find(p=>p.id===id);
assert.equal(p('qiagen-qf').rows[1].name,'Tris base');assert(p('qiagen-qf').steps.includes('HCl로 pH 8.5'));assert(p('qiagen-qf').steps.indexOf('HCl')<p('qiagen-qf').steps.indexOf('이소프로판올'));
for(const id of ['qiagen-qbt','qiagen-qc']){assert.equal(p(id).rows[1].name,'MOPS (free acid)');assert(p(id).steps.includes('NaOH로 pH 7.0'));}
assert.equal(p('qiagen-qbt').rows[3].stock,'10');assert.equal(p('qiagen-qbt').rows[3].stockUnit,'%v/v');
for(const id of ['te-am9849','low-te-4479554','qiagen-p1'])for(const r of p(id).rows.slice(0,2)){assert(r.name.includes('pH 8.0'));assert.equal(r.mode,'stock');}
assert(p('low-te-4479554').note.includes('1000.2 mL'));assert(p('low-te-4479554').note.includes('정규화'));
assert(p('tbe-am986x').sources[0].url.includes('MAN0018494'));assert(!p('tbe-am986x').sources.some(s=>s.url.includes('J62449')));
assert.equal(p('ssc-reference').rows[1].name,'Trisodium citrate');assert(p('ssc-reference').steps.includes('HCl로 pH 7.0'));
assert(p('pbs-10010023').rows[2].name.includes('heptahydrate'));assert(p('pbs-10010023').note.includes('목표 질량농도도 변경'));
assert.match(p('isothermal-b0537').note,/NEB\s*제품\s*페이지에는 % 종류가 명시되지/);assert(p('isothermal-b0537').note.includes('v/v'));assert(p('isothermal-b0537').ph.includes('1X'));
assert(p('ssiii-first').ph.includes('5X'));assert(p('ssiii-first').note.includes('DTT'));assert(p('ssiii-first').name.includes('18080093'));
for(const preset of data.recipes){assert(preset.steps&&preset.presetType);for(const r of preset.rows)assert.equal(r.mw,'');}
// Original mass recipes are rounded; do not rewrite MW to force string equality.
assert(Math.abs(6.057-6.06)<=.005);assert(Math.abs(10.463-10.46)<=.005);
assert.deepEqual(data.recipes.filter(p=>p.presetType==='recipe').map(p=>p.id).sort(),['low-te-4479554','qiagen-qbt','qiagen-qc','qiagen-qf']);
// High-fold scaling and solvent volume gates continue to apply to corrected presets.
const low=compose({...batch,fold:'10'},p('low-te-4479554').rows);assert.deepEqual(low.rows.map(r=>r.amount),['100 mL','2 mL']);
assert.equal(compose({...batch,fold:'10'},p('qiagen-qbt').rows.map(r=>({...r,mw:r.name==='NaCl'?'58.44':'209.26'}))).complete,false);
console.log('14 independently specified preset oracles + material/pH/source/boundary checks passed.');
