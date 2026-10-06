import assert from 'node:assert/strict';
import {calculate,molecularWeight,VERSION} from '../../tools/nucleic-acid-calculator/core.mjs';
import {clipboardData} from '../../tools/nucleic-acid-calculator/clipboard.mjs';
import {readFile} from 'node:fs/promises';
const equal=(r,s)=>{const [whole,part='']=s.split('.'),scale=10n**BigInt(part.length),n=BigInt(whole)*scale+BigInt(part||'0');assert.equal(r.n*scale,n*r.d);};
// Independent expectations transcribed from official size tables; dsDNA table rounded to integer g/mol.
for(const [type,coefficient,length,expected] of [
 ['ssDNA','303.7','20','6153'],['ssDNA','303.7','100','30449'],['ssDNA','303.7','1000','303779'],
 ['ssRNA','320.5','20','6569'],['ssRNA','320.5','100','32209'],['ssRNA','320.5','1000','320659'],
 ['dsDNA','607.4','20','12305.9'],['dsDNA','607.4','100','60897.9'],['dsDNA','607.4','1000','607557.9'],
 ['Plasmid','607.4','5000','3037157.9']]){
 const r=molecularWeight({type,method:'average',coefficient,length});equal(r.mw,expected);assert(r.basis.includes('Thermo Fisher')&&r.basis.includes('+'));
 const base={type,method:'average',coefficient,length,kind:'mass',value:'1',unit:'ng/µL',massUnit:'ng/µL',molarUnit:'nM',copyUnit:'copies/µL'};
 const actual=calculate(base),direct=calculate({...base,method:'direct',mw:expected});
 for(const key of ['mass','molar','copies'])assert.deepEqual(actual[key],direct[key],'same documented MW across conversion');
 const clip=clipboardData(actual);assert(clip.text.includes('Thermo Fisher')&&clip.text.includes('공식 고정 근사식'));assert(clip.text.includes('1.1.0 / '+VERSION));assert(clip.html.includes('font-size:9pt'));assert(clip.text.split('\n').every(r=>r.split('\t').length===3));
}
for(const [type,coefficient] of [['dsDNA','303.7'],['ssDNA','607.4'],['ssRNA','303.7'],['ssDNA','320.5']])assert.throws(()=>molecularWeight({type,method:'average',coefficient,length:'100'}));
for(const length of ['','0','1.5','-1','100000001'])assert.throws(()=>molecularWeight({type:'ssDNA',method:'average',coefficient:'303.7',length}));
equal(molecularWeight({type:'ssRNA',method:'average',coefficient:'320.5',length:'1'}).mw,'479.5');
equal(molecularWeight({type:'dsDNA',method:'average',coefficient:'607.4',length:'100000000'}).mw,'60740000157.9');
console.log('PASS: 10 Thermo reference MWs, terminal offsets, mass/molar/copy equivalence, type/length validation, basis/version/3-column9pt copy.');

// Independent Fraction fixtures cover vendor length modes, intermediate rounding,
// unit normalization, tiny values and long genomes, including observed Thermo cases.
const web=JSON.parse(await readFile(new URL('./WEB_ORACLES.json',import.meta.url),'utf8'));
const ratio=s=>{const [n,d='1']=s.split('/');return {n:BigInt(n),d:BigInt(d)};};
const same=(actual,expected)=>{const e=ratio(expected);assert.equal(actual.n*e.d,e.n*actual.d);};
const webBase={type:'dsDNA',method:'average',kind:'mass',unit:'ng/µL',massUnit:'ng/µL',molarUnit:'nM',copyUnit:'copies/µL'};
for(const f of web.cases){
 const input={...webBase,coefficient:f.profile,length:f.length,value:f.value};const r=calculate(input);
 for(const k of ['mw','mass','molar','copies'])same(r[k],f[k]);
 assert.equal(r.conversion.avogadro,'6.022E23');assert(r.webReference.url.startsWith('https://'));
 const clip=clipboardData(r);assert(clip.text.includes(r.webReference.url)&&clip.text.includes(r.webReference.checked)&&clip.text.includes(r.conversion.rounding));
 assert(clip.text.includes('6.022E23')&&!clip.text.includes('6.02214076E23'));
 assert(clip.text.split('\n').every(line=>line.split('\t').length===3));assert(clip.html.includes('border:none'));
}
for(const f of web.observedThermo)same(calculate({...webBase,coefficient:'thermo-web',...f}).copies,f.copies);
let unitChecks=0;
for(const coefficient of ['neb-web','thermo-web'])for(const factor of web.massFactors){
 // Input value 12.345 in each mass unit, then independently scale from the
 // oracle case for the same numeric stock value in ng/µL (canonical factor .001).
 const f=web.cases.find(x=>x.profile===coefficient&&x.length==='20');const scale=ratio(factor.factor);
 for(const [copyUnit,volumeFactor] of [['copies/L',1000000n],['copies/mL',1000n],['copies/µL',1n]])for(const [molarUnit,molarFactor]of [['M',1n],['mM',1000n],['µM',1000000n],['nM',1000000000n],['pM',1000000000000n],['fM',1000000000000000n]]){
  const r=calculate({...webBase,coefficient,length:'20',value:'12.345',unit:factor.unit,copyUnit,molarUnit});
  const c=ratio(f.copies),m=ratio(f.molar);
  assert.equal(r.copies.n*c.d*scale.d,r.copies.d*c.n*scale.n*1000n*volumeFactor);
  assert.equal(r.molar.n*m.d*scale.d*1000000000n,r.molar.d*m.n*scale.n*1000n*molarFactor);
  unitChecks++;
 }
}
for(const coefficient of ['neb-web','thermo-web'])for(const type of ['ssDNA','ssRNA'])assert.throws(()=>calculate({...webBase,coefficient,type,length:'100',value:'1'}));
const nebReverse=calculate({...webBase,coefficient:'neb-web',length:'1000',kind:'copies',unit:'copies/µL',value:'602200000'});same(nebReverse.molar,'1');same(nebReverse.mass,'15399401/25000000');
const thermoReverse=calculate({...webBase,coefficient:'thermo-web',length:'1000',kind:'molar',unit:'nM',value:'1'});same(thermoReverse.copies,'602200000');same(thermoReverse.mass,'13/20');assert(thermoReverse.conversion.scope.includes('웹 화면 재현 범위 밖'));assert.equal(thermoReverse.conversion.rounding,'중간 반올림 없음 · 주값 최대12유효숫자');
for(const coefficient of ['650','660','607.4']){const r=calculate({...webBase,coefficient,length:'1000',value:'1'});assert.equal(r.conversion.avogadro,'6.02214076E23');assert.equal(r.webReference,undefined);assert(clipboardData(r).text.includes('6.02214076E23'));}
console.log('PASS: web references '+web.cases.length+' independent Fraction cases, 2 observed Thermo outputs, '+unitChecks+' unit combinations, inverse scope/type rejection, traceable copy and legacy NA preservation.');
