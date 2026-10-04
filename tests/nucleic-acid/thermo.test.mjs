import assert from 'node:assert/strict';
import {calculate,molecularWeight,VERSION} from '../../tools/nucleic-acid-calculator/core.mjs';
import {clipboardData} from '../../tools/nucleic-acid-calculator/clipboard.mjs';
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
 const clip=clipboardData(actual);assert(clip.text.includes('Thermo Fisher')&&clip.text.includes('공식 고정 근사식'));assert(clip.text.includes('1.0.1 / '+VERSION));assert(clip.html.includes('font-size:9pt'));assert(clip.text.split('\n').every(r=>r.split('\t').length===3));
}
for(const [type,coefficient] of [['dsDNA','303.7'],['ssDNA','607.4'],['ssRNA','303.7'],['ssDNA','320.5']])assert.throws(()=>molecularWeight({type,method:'average',coefficient,length:'100'}));
for(const length of ['','0','1.5','-1','100000001'])assert.throws(()=>molecularWeight({type:'ssDNA',method:'average',coefficient:'303.7',length}));
equal(molecularWeight({type:'ssRNA',method:'average',coefficient:'320.5',length:'1'}).mw,'479.5');
equal(molecularWeight({type:'dsDNA',method:'average',coefficient:'607.4',length:'100000000'}).mw,'60740000157.9');
console.log('PASS: 10 Thermo reference MWs, terminal offsets, mass/molar/copy equivalence, type/length validation, basis/version/3-column9pt copy.');
