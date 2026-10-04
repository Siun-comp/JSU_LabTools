import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {calculate,format,units,MASS_UNITS,MOLAR_UNITS,COPY_UNITS,VERSION} from '../../tools/nucleic-acid-calculator/core.mjs';
import {clipboardData,TOOL_VERSION} from '../../tools/nucleic-acid-calculator/clipboard.mjs';
import {copyScientific} from '../../tools/nucleic-acid-calculator/math.mjs';
import {VECTOR_DATA,vectorInput,vectorProvenance} from '../../tools/nucleic-acid-calculator/vectors.mjs';
// Execute actual app source with a synthetic DOM. Layout and OS clipboard are separate checks.
class Element{constructor(){this.value='';this.textContent='';this.hidden=false;this.disabled=false;this.children=[];this.events={};}get options(){return this.children;}addEventListener(k,f){(this.events[k]??=[]).push(f);}replaceChildren(...xs){this.children=[...xs];}append(...xs){this.children.push(...xs);}focus(){}}
const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
function reset(){for(const [id,value]of Object.entries({molecule:'dsDNA',kind:'mass',value:'',method:'',length:'',coefficient:'',mw:'',source:'',sequence:'',topology:'',ends:'',vector:''}))get(id).value=value;}
reset();get('calc-form').reset=reset;let copied;
const source=(await readFile(new URL('../../tools/nucleic-acid-calculator/app.mjs',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'');
vm.runInNewContext(source,{calculate,format,units,MASS_UNITS,MOLAR_UNITS,COPY_UNITS,clipboardData,copyScientific,VECTOR_DATA,vectorInput,vectorProvenance,document:{getElementById:get,createElement:()=>new Element()},navigator:{clipboard:{writeText:async text=>{copied=text;}}}});
const emit=(id,event)=>{for(const fn of get(id).events[event]||[])fn({preventDefault(){}});};
const change=(id,value)=>{get(id).value=value;emit(id,'change');emit('calc-form','change');};
const input=(id,value)=>{get(id).value=value;emit(id,'input');emit('calc-form','input');};
const submit=()=>emit('calc-form','submit');
assert.equal(TOOL_VERSION,'1.0.1');assert.equal(VERSION,'0.2.1');
for(const [type,c,label,mw]of [['ssDNA','303.7','303.7n+79 · Thermo · 5′ 인산1개','30449'],['ssRNA','320.5','320.5n+159 · Thermo · 5′ 삼인산','32209'],['dsDNA','607.4','607.4n+157.9 · Thermo · 말단 상수','60897.9'],['Plasmid','607.4','607.4n+157.9 · Thermo · 말단 상수','60897.9']]){
 change('molecule',type);change('method','average');assert.equal(get('coefficient').options.find(o=>o.value===c).textContent,label);change('coefficient',c);input('length','100');input('value','1');submit();assert.equal(get('mw-result').textContent,'MW '+mw+' g/mol');assert(get('basis').textContent.includes('Thermo Fisher'));assert(get('mw-method-note').textContent.includes('동일한 기준'));assert(get('mw-method-note').textContent.includes('\n'));assert.equal(get('copy').disabled,false);await get('copy').events.click[0]();assert(copied.includes('1.0.1 / 0.2.1'));assert(copied.includes('Thermo Fisher'));assert(copied.split('\n').every(l=>l.split('\t').length===3));
}
change('molecule','ssDNA');change('method','sequence');change('topology','linear');change('ends','P');input('sequence','>named original description\naGc');submit();assert.equal(get('mw-result').textContent,'MW 949.6095 g/mol');assert(get('basis').textContent.includes('무수 유리산'));assert(get('mw-method-note').textContent.includes('길이 평균법'));await get('copy').events.click[0]();assert(copied.includes('named original description'));assert(copied.includes('AGC'));assert.equal(get('sequence').value,'>named original description\naGc');
for(const raw of ['>\nATGC','>   \r\nATGC']){input('sequence',raw);submit();assert(get('message').textContent.includes('FASTA 이름이 비어'));assert.equal(get('results').hidden,true);assert.equal(get('copy').disabled,true);assert.equal(get('mw-method-note').textContent,'');assert.equal(get('sequence').value,raw);}
input('sequence','atgc');submit();assert.equal(get('copy').disabled,false);input('sequence','ATNG');submit();assert.equal(get('copy').disabled,true);assert(get('message').textContent.includes('모호염기'));
change('method','direct');input('mw','650000');input('source','제조사 MW');submit();assert(get('mw-method-note').textContent.includes('질량농도'));assert(get('mw-result').textContent.includes('제조사 MW'));
change('method','');change('kind','molar');input('value','1');submit();assert.equal(get('mw-method-note').textContent,'');assert.equal(get('result-body').children[2].children[1].textContent,'602214076');
input('value','2');assert.equal(get('copy').disabled,true);assert.equal(get('results').hidden,true);emit('clear','click');assert.equal(get('value').value,'');assert.equal(get('sequence').value,'');assert.equal(get('mw-method-note').textContent,'');assert.equal(get('copy').disabled,true);
console.log('PASS: actual nucleic app Thermo labels/fixed values, MW note/partial result, condition/version/3-column copy, FASTA empty-name/raw retention, plain sequence/errors/stale/Clear. Synthetic DOM, no OS clipboard claim.');
