import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {parseHairpin,readableStructure,textHTML} from '../../tools/oligo-thermodynamics/structure.mjs';
import {writeClipboard} from '../../tools/oligo-thermodynamics/clipboard.mjs';
import {resultCSV,resultText,resultHTML,structureReport} from '../../tools/oligo-thermodynamics/report.mjs';
import {makeRequest} from '../../tools/oligo-thermodynamics/analysis-core.mjs';
import {normalize,selection} from '../../tools/oligo-thermodynamics/sequence.mjs';
const refs=JSON.parse(await fs.readFile(new URL('../../tests/oligo-thermodynamics/reference.json',import.meta.url)));
const r=refs.find(x=>x.hairpin[1].status===1),hp=r.hairpin[1],raw=hp.structure,seq=r.seq;
const request=makeRequest({raw:seq,parsed:normalize(seq),range:selection(seq.length,1,seq.length),parentName:'=SUM(1,2)',role:'<img src=x onerror=alert(1)>',memo:'line1\nline2',conditions:r.c},1,0);
const record={request,duplex:{...r.duplex,status:'ok'},hairpinA:{status:'ok',tm:hp.values[0],dg:hp.values[1],dh:hp.values[2],ds:hp.values[3],structure:raw},hairpinB:{status:'no-structure'},duplexMgZeroReference:null,applied:{},limitations:['test only'],calculatedAt:'2026-10-27T00:00:00.000Z',parentRaw:seq};
test('every returned fixture structure preserves sequence, positions and symbol round-trip',()=>{
 let count=0;for(const row of refs)for(const h of row.hairpin)if(h.structure){
  const s=parseHairpin(h.structure,row.seq);assert.equal(s.status,'ok',JSON.stringify(row));assert.equal(s.raw,h.structure);assert.equal(s.dotBracket.length,row.seq.length);
  const rebuilt=[...s.dotBracket].map(c=>c==='('?'/':c===')'?'\\':'-').join('');assert.equal(rebuilt,h.structure.split('\n')[0].split('\t')[1]);
  const check=[...'.'.repeat(row.seq.length)];for(const p of s.pairs){assert(p.left<p.right);assert.equal(check[p.left-1],'.');assert.equal(check[p.right-1],'.');check[p.left-1]='(';check[p.right-1]=')';}assert.equal(check.join(''),s.dotBracket);count++;
 }assert(count>0);console.log('FIXTURE STRUCTURES '+count);
});
test('CRLF parsed without mutating raw',()=>{const x=raw.replaceAll('\n','\r\n');assert.equal(parseHairpin(x,seq).status,'ok');assert.equal(parseHairpin(x,seq).raw,x);});
test('labels, sequence, lengths, unsupported symbols, unbalanced and unknown model fail safely',()=>{
 for(const [x,s,m] of [[raw.replace('SEQ','STR'),seq],[raw,seq+'A'],[raw.replace('/','X'),seq],[raw.replace('/','-'),seq],[raw,seq,'future'],[raw+'extra\n',seq],['SEQ\t----\nSTR\tAAAA\n','AAAA']]){
  const v=parseHairpin(x,s,m);assert.equal(v.status,'unavailable');assert.equal(v.dotBracket,'');assert.deepEqual(v.pairs,[]);assert(readableStructure(x,s,m).includes('변환 불가'));
 }
});
test('presentation does not invent base-pair chemistry validation',()=>{const s=parseHairpin('SEQ\t/--\\\nSTR\tAATC\n','AATC');assert.equal(s.status,'ok');assert.equal(s.pairs[0].bases,'A–C');});
test('HTML escapes metadata and contains no executable image/script',()=>{const html=resultHTML([record]);assert(html.includes('&lt;img'));assert(!html.includes('<img'));assert(html.includes('<pre><font face="Consolas'));assert(!html.includes('style='));assert(textHTML('<script>&"').includes('&lt;script&gt;&amp;&quot;'));});
test('readable text and structure export preserve raw, coordinates, model and scope',()=>{const text=resultText([record]),s=structureReport(record,'hairpinA');assert(text.includes(raw));assert(s.includes(raw));assert(s.includes(seq));assert(s.includes('1-based'));assert(s.includes(request.contract.wasm));assert(!text.includes('사용자가 포함한 계산 당시 전체 원문:'));assert(resultText([record],{includeParent:true}).includes('사용자가 포함한 계산 당시 전체 원문:'));assert.throws(()=>structureReport(record,'duplex'));});
test('CSV keeps legacy prefix and raw while appending derived fields',async()=>{const csv=resultCSV([record]);assert(csv.includes('structure_dot_bracket'));assert(csv.includes('structure_pairs_1based'));assert(csv.includes('thal-dot-bracket/1'));});
test('rich clipboard sends plain + HTML with same text',async()=>{let payload;class Item{constructor(data){this.data=data;}}const mode=await writeClipboard('seq\nstr',textHTML('seq\nstr'),{clipboard:{async write(items){payload=items[0].data;}},Item});assert.equal(mode,'formatted');assert.equal(await payload['text/plain'].text(),'seq\nstr');assert.equal(payload['text/html'].type,'text/html');});
test('rich rejection uses only same plain text fallback',async()=>{let actual;const mode=await writeClipboard('keep\t\n',textHTML('keep\t\n'),{clipboard:{async write(){throw Error('unsupported');},async writeText(t){actual=t;}},Item:class{}});assert.equal(mode,'plain');assert.equal(actual,'keep\t\n');});
test('plain only environments and total rejection are distinguished',async()=>{let actual;assert.equal(await writeClipboard('plain','',{clipboard:{async writeText(t){actual=t;}},Item:null}),'plain');assert.equal(actual,'plain');await assert.rejects(writeClipboard('x','html',{clipboard:{async write(){throw Error('write');},async writeText(){throw Error('denied');}},Item:class{}}));});
