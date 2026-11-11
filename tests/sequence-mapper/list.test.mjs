import assert from 'node:assert/strict';
import {REASON,recordFacts,applyConditions,sortedIds,visibleIds,selectedIds,lengthSummary,lengthHistogram,basesOf,gatherChunk,subsetData,lengthOf,mergeRecords} from '../../tools/sequence-mapper/core/list.mjs';
import {RecordStore,readInto,readRecordInfo,FLAG} from '../../tools/sequence-mapper/core/parse.mjs';
const records=[['A1.1 alpha','ACGTACGTAC'],['B1.1 beta','ACGTNNACGTAC'],['A1.1 again','ACGT'],['C1.1 gamma','ACRYACGTACGTACGT'],['D1.1 empty',''],['E1.1 bad','ACGTX']];
async function read(text,name='x.fasta'){const s=new RecordStore(1<<10),report=await readInto(s,new File([text],name),0),d=s.finish();return {d,report};}
const {d}=await read(records.map(([n,q])=>`>${n}\n${q}\n`).join(''));
const L={...d,...recordFacts(d)},n=records.length;
// Facts
assert.deepEqual([...L.ambiguous],[0,2,0,2,0,1]);assert.deepEqual([...L.duplicate],[0,0,1,0,0,0]);
assert.equal(L.flags[4]&FLAG.EMPTY,FLAG.EMPTY);assert.equal(L.flags[5]&FLAG.INVALID,FLAG.INVALID);
// Conditions: each bound is inclusive, and several reasons can hold at once
const check=c=>[...applyConditions(L,c,new Uint8Array(n))];
assert.deepEqual(check({}),[0,0,0,0,0,0]);
assert.deepEqual(check({min:10,max:12}).map(Boolean),[false,false,true,true,true,true]);
assert.equal(check({name:'BETA'})[1],0);assert.equal(check({name:'BETA'})[0],REASON.NAME);
assert.equal(check({maxAmbiguous:12.5})[3],0);assert.equal(check({maxAmbiguous:12})[3],REASON.AMBIGUOUS);assert.equal(check({maxAmbiguous:0})[4],0);
assert.equal(check({firstOnly:true})[2],REASON.DUPLICATE);assert.equal(check({firstOnly:true})[0],0);
assert.equal(check({min:10,firstOnly:true,name:'alpha'})[2],REASON.LENGTH|REASON.NAME|REASON.DUPLICATE);
// Sorting keeps the input order among equals
assert.deepEqual([...sortedIds(L)],[0,1,2,3,4,5]);assert.deepEqual([...sortedIds(L,'input',false)],[5,4,3,2,1,0]);
assert.deepEqual([...sortedIds(L,'length')],[4,2,5,0,1,3]);assert.deepEqual([...sortedIds(L,'length',false)],[3,1,0,5,2,4]);
assert.deepEqual([...sortedIds(L,'ambiguous',false)].slice(0,3),[1,3,5]);assert.equal(sortedIds(L,'name')[0],2);
// Shown and chosen rows
{const r=applyConditions(L,{min:10},new Uint8Array(n)),s=sortedIds(L);assert.deepEqual([...visibleIds(s,r,false)],[0,1,3]);assert.deepEqual([...visibleIds(s,r,true)],[0,1,2,3,4,5]);
 const manual=new Uint8Array(n);manual[1]=1;assert.deepEqual([...selectedIds(r,manual)],[0,3]);assert.deepEqual([...selectedIds(r,manual,3)],[0]);}
// Lengths
assert.deepEqual(lengthSummary(L,Uint32Array.of(0,1,3)),{min:10,median:12,max:16});assert.deepEqual(lengthSummary(L,Uint32Array.of(0,1)),{min:10,median:11,max:12});assert.equal(lengthSummary(L,new Uint32Array(0)),null);
{const h=lengthHistogram(L,Uint32Array.of(0),8);assert.equal(h.min,4);assert.equal(h.max,16);assert.equal(h.all.reduce((a,b)=>a+b),5);assert.equal(h.kept.reduce((a,b)=>a+b),1);}
{const one={...L,names:['x'],offs:Uint32Array.of(0,5)},h=lengthHistogram(one,Uint32Array.of(0),8);assert.equal(h.all[0],1);}
// The unmappable record counts in the total, not in what can be mapped
{const b=basesOf(L,Uint32Array.of(0,5));assert.equal(b.total,15);assert.equal(b.mappable,10);}
// Chunks and subset hold the same bytes for any selection
{const ids=Uint32Array.of(5,3,1,0),dec=new TextDecoder(),s=subsetData(d,ids);assert.deepEqual(s.names,[records[5][0],records[3][0],records[1][0],records[0][0]]);assert.equal(s.offs.at(-1),s.pool.length);assert.equal(s.flags[0]&FLAG.INVALID,FLAG.INVALID);
 const got=[];let first=0;while(first<ids.length){const c=gatherChunk(d,ids,first,12);for(let k=0;k<c.last-first;k++){got.push(dec.decode(c.pool.subarray(c.offs[k],c.offs[k+1])));assert.equal(c.flags[k],d.flags[ids[first+k]]);}first=c.last;}
 assert.equal(got.length,4);got.forEach((g,k)=>assert.equal(g,dec.decode(s.pool.subarray(s.offs[k],s.offs[k+1]))));}
// Empty first record cannot stall chunking
{const c=gatherChunk(d,Uint32Array.of(4,0),0,1);assert.equal(c.last,2);}
// Annotation of one GenBank record, read again on demand
const gb=(id,feature)=>`LOCUS       ${id}             20 bp    DNA     linear   UNA 01-JAN-2026\nDEFINITION  Record ${id}.\nVERSION     ${id}.1\nFEATURES             Location/Qualifiers\n     ${feature}\nORIGIN\n        1 acgtacgtac gtacgtacgt\n//\n`;
{const f=new File([gb('AA1','gene            1..5')+gb('BB2','CDS             2..9')+gb('CC3','misc            3..4')],'g.gb');let r=await readRecordInfo(f,1);assert.equal(r.source.version,'BB2.1');assert.match(r.features,/CDS +2\.\.9/);assert.doesNotMatch(r.features,/gene|misc/);r=await readRecordInfo(f,0);assert.equal(r.source.locus,'AA1');assert.match(r.features,/gene/);r=await readRecordInfo(f,2);assert.match(r.features,/misc/);}
// Reading many records keeps no annotation
{const {report}=await read(gb('AA1','gene            1..5')+gb('BB2','CDS             2..9'),'g.gb');assert.equal(report.features,null);assert.equal(report.records,2);}
// Add sequences: current records then new ones, new file indexes after the current files, sequences unchanged
{const a=subsetData(d,Uint32Array.of(0,3)),{d:b}=await read([">N1.1 new","GGGG",">N2.1 new2","TTAA",""].join(String.fromCharCode(10)),"n.fasta"),m=mergeRecords(a,b,2);
 assert.deepEqual(m.names,["A1.1 alpha","C1.1 gamma","N1.1 new","N2.1 new2"]);assert.deepEqual([...m.fileIdx],[0,0,2,2]);
 const seq=i=>new TextDecoder().decode(m.pool.subarray(m.offs[i],m.offs[i+1]));assert.deepEqual([0,1,2,3].map(seq),["ACGTACGTAC","ACRYACGTACGTACGT","GGGG","TTAA"]);
 assert.equal(m.offs.length,5);assert.equal(m.pool.length,m.offs[4]);assert.deepEqual([...m.flags],[a.flags[0],a.flags[1],b.flags[0],b.flags[1]]);
 assert.equal(m.inputOrder,undefined);assert.equal(m.meta,undefined);
 const e=mergeRecords(a,{names:[],pool:new Uint8Array(0),offs:new Uint32Array(1),flags:new Uint8Array(0),fileIdx:new Uint16Array(0)},2);assert.deepEqual(e.names,a.names);
 assert.throws(()=>mergeRecords(a,{...b,fileIdx:Uint16Array.of(0,1)},0xffff),/파일 수/);}
console.log('PASS: Sequence Mapper list conditions, sorting, selection, chunks and on-demand annotation.');
