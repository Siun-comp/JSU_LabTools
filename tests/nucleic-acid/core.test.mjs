import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {calculate,molecularWeight,parseSequence,format,VERSION} from '../../tools/nucleic-acid-calculator/core.mjs';
import {clipboardData} from '../../tools/nucleic-acid-calculator/clipboard.mjs';
const fixture=JSON.parse(await fs.readFile(new URL('./ORACLES.json',import.meta.url),'utf8'));
const frac=s=>{const [n,d='1']=s.split('/');return {n:BigInt(n),d:BigInt(d)};};
function equal(actual,expected){const e=frac(expected);assert.equal(actual.n*e.d,e.n*actual.d);}
const base={type:'dsDNA',method:'direct',mw:'650000',source:'',kind:'mass',unit:'ng/µL',value:'1',massUnit:'ng/µL',molarUnit:'nM',copyUnit:'copies/µL'};
for(const c of fixture.unitCases){const r=calculate({...base,...c,value:'12.345'});for(const field of ['mass','molar','copies'])equal(r[field],c.expected[field]);}
for(const c of fixture.sequenceCases){const r=molecularWeight({...c,method:'sequence'}),e=frac(c.expected),tol=frac(c.tolerance);let delta=r.mw.n*e.d-e.n*r.mw.d;if(delta<0n)delta=-delta;assert(delta*tol.d<=tol.n*r.mw.d*e.d,'Atomic composition '+JSON.stringify(c));}
const seq=(s,type='ssDNA',topology='linear',ends='P')=>molecularWeight({method:'sequence',sequence:s,type,topology,ends});
equal(seq('AGC').mw,'1899219/2000');equal(seq('AGC','ssRNA').mw,'9976077/10000');
assert.equal(format(seq('AGC').mw),'949.6095');assert.equal(format(seq('AGC','ssRNA').mw),'997.6077');
assert.notDeepEqual(seq('AAA','dsDNA').mw,seq('AAA').mw,'Complement strand, not one strand');
assert.notDeepEqual(seq('AAA','dsDNA').mw,{n:seq('AAA').mw.n*2n,d:seq('AAA').mw.d},'Complement is not 2x input strand');
equal(seq('ATGC','dsDNA','circular','OH').mw,'6178937/2500');
for(const [type,coef,len,expect] of [['dsDNA','650','1000','650000'],['dsDNA','660','1000','660000'],['ssDNA','330','20','6600'],['ssRNA','340','20','6800'],['Plasmid','650','5000','3250000']])equal(molecularWeight({type,method:'average',length:len,coefficient:coef}).mw,expect);
const partial=calculate({...base,kind:'molar',unit:'nM',method:'',value:'1'});assert.equal(partial.mass,null);equal(partial.copies,'602214076');
for(const raw of ['>\nATGC','>   \r\nATGC','\t>\t\nATGC'])assert.throws(()=>parseSequence(raw,'ssDNA'),/FASTA 이름이 비어/);
assert.equal(parseSequence('atgc','ssDNA').normalized,'ATGC');
const raw='>sample\n aT gC \n';const parsed=parseSequence(raw,'dsDNA');assert.equal(parsed.normalized,'ATGC');assert.equal(parsed.header,'sample');assert.equal(raw,'>sample\n aT gC \n');
for(const sequence of ['ATNG','/FAM/ATGC','AT-GC','AT1GC','ATUG','>a\nAT\n>b\nGC','AT\n>a\nGC','>a\n','AT\u00a0GC','AT\n\u00a0'])assert.throws(()=>seq(sequence));
for(const [field,values] of Object.entries({mw:['','0','-1','NaN','Infinity','1E101','1'.repeat(41)],value:['','-1','NaN','1,000','1E-101']}))for(const v of values)assert.throws(()=>calculate({...base,[field]:v}));
for(const invalid of [{type:'dsRNA'},{unit:'pmol'},{massUnit:'g'},{method:'other'},{method:'average',coefficient:'650',length:'1.5'},{method:'average',coefficient:'330',length:'1000'},{method:'sequence',sequence:'ATGC',topology:'linear',ends:''},{method:'sequence',sequence:'AUGC',type:'ssRNA',topology:'circular'}])assert.throws(()=>calculate({...base,...invalid}));
const zero=calculate({...base,value:'0'});for(const field of ['mass','molar','copies'])equal(zero[field],'0');
for(const value of ['1E-100','1E100','1E-3','0.00100001'])assert(calculate({...base,value}).copies);
const injection=calculate({...base,method:'sequence',sequence:'>=SUM(1,2)<img>\nATGC',topology:'linear',ends:'OH'});const clip=clipboardData(injection);
assert(clip.html.includes('&lt;img&gt;')&&!clip.html.includes('<img>'));assert(clip.text.includes("'=SUM"));assert(clip.html.includes('font-size:9pt')&&clip.html.includes('border:none'));assert(clip.text.split('\n').every(l=>l.split('\t').length===3));assert(clip.text.includes('ATGC')&&clip.text.includes(VERSION));
console.log('PASS: '+fixture.sequenceCases.length+' independent atomic MW cases, 729 exact unit cases, known references, average/direct/partial/zero/extremes, strict sequence/errors and clipboard.');
