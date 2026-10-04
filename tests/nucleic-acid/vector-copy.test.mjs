import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {calculate,molecularWeight,parseSequence,format} from '../../tools/nucleic-acid-calculator/core.mjs';
import {decimal,copyScientific} from '../../tools/nucleic-acid-calculator/math.mjs';
import {clipboardData,rows} from '../../tools/nucleic-acid-calculator/clipboard.mjs';
import {VECTOR_DATA,vectorInput,vectorProvenance} from '../../tools/nucleic-acid-calculator/vectors.mjs';
const fixture=JSON.parse(await fs.readFile(new URL('./VECTOR_SOURCE_CHECK_020.json',import.meta.url),'utf8'));
const hash=s=>createHash('sha256').update(s).digest('hex');
for(const [s,want] of [['0',null],['999.999',null],['1000','1.00E+03'],['1234.56789','1.23E+03'],['9995','1.00E+04'],['9994.9999','9.99E+03'],['359635848.466','3.60E+08'],['1000000','1.00E+06'],['1E100','1.00E+100'],['999999999999.9','1.00E+12']])assert.equal(copyScientific(decimal(s)),want,s);
assert.equal(copyScientific(null),null);assert.equal(format(decimal('1234.56789')),'1234.56789');
const base={type:'dsDNA',method:'',kind:'copies',unit:'copies/µL',value:'1000',massUnit:'ng/µL',molarUnit:'nM',copyUnit:'copies/µL'};
const r=calculate(base);assert.deepEqual(rows(r).find(v=>v[0]==='Copy 농도 (지수 요약·3유효숫자)'),['Copy 농도 (지수 요약·3유효숫자)','1.00E+03','copies/µL']);
const small=calculate({...base,value:'999'});assert(!rows(small).some(v=>v[0]==='Copy 농도 (지수 요약·3유효숫자)'));
const litres=calculate({...base,unit:'copies/L',value:'1000'});assert.equal(copyScientific(litres.copies),null,'threshold in selected result unit');
const ml=calculate({...base,copyUnit:'copies/mL'});assert.equal(copyScientific(ml.copies),'1.00E+06');
assert.equal(VECTOR_DATA.vectors.length,8);assert.equal(VECTOR_DATA.vectors.filter(v=>v.available).length,7);
for(const v of VECTOR_DATA.vectors){const f=fixture.records.find(f=>f.id===v.id);assert(f);assert.equal(v.length,f.length);assert.equal(v.sequenceHash,f.sequenceHash);
 if(!v.available){assert.equal(v.sequence,null);assert.equal(f.ambiguous.length,1);assert.equal(f.ambiguous[0].base,'S');assert.throws(()=>vectorInput(v.id));continue;}
 assert(/^[ACGT]+$/.test(v.sequence));assert.equal(v.sequence.length,v.length);assert.equal(hash(v.sequence),f.sequenceHash);
 const load=vectorInput(v.id),parsed=parseSequence(load.raw,'Plasmid');assert.equal(parsed.normalized,v.sequence);assert.equal(parsed.length,v.length);
 const mw=molecularWeight({type:'Plasmid',method:'sequence',sequence:load.raw,topology:'circular'}).mw;
 const [n,d='1']=f.independentCircularMW.split('/');let delta=mw.n*BigInt(d)-BigInt(n)*mw.d;if(delta<0n)delta=-delta;
 // Same documented 4-decimal constants tolerance; independent atom model.
 assert(delta*10000n<=(BigInt(2*v.length)+1n)*mw.d*BigInt(d));
 assert.equal(vectorProvenance(load,load.raw).state,'기본 Vector 원문 · insert 미포함');
 assert(vectorProvenance(load,load.raw+'\nA').state.includes('편집됨'));
 const result=calculate({...base,type:'Plasmid',method:'sequence',sequence:load.raw,topology:'circular',vector:vectorProvenance(load,load.raw)});
 const clip=clipboardData(result);assert(clip.text.includes(v.name)&&clip.text.includes(v.sequenceHash)&&clip.text.includes('insert 미포함'));assert(clip.html.includes('font-size:9pt'));assert(!clip.html.includes('border:1'));
}
assert.equal(vectorProvenance(null,'ATGC'),null);
assert.throws(()=>vectorInput('unknown'));
assert.equal(VECTOR_DATA.vectors.find(v=>v.id==='bionics-6').sequenceHash,VECTOR_DATA.vectors.find(v=>v.id==='bionics-7').sequenceHash,'Two pUC57-Amp labels share identical source sequence');
console.log('PASS: Copy threshold/unit/fixed 2-decimal/3-significant signed scientific summary and 12-significant primary preservation; 8 public vector entries/7 loadable, hashes/lengths/strict parsing/independent atomic MW/provenance/clipboard; ambiguous source blocked.');
