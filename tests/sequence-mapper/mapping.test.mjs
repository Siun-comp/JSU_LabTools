import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {createMapper,ENGINE} from '../../tools/sequence-mapper/engine/engine.mjs';
import {mapChunk,mergeChunks} from '../../tools/sequence-mapper/core/map-chunk.mjs';
import {STRIDE,REF,REV,expandRow} from '../../tools/sequence-mapper/core/alignment.mjs';
import {computeRecordStats,statusOf,summarize} from '../../tools/sequence-mapper/core/stats.mjs';
import {createHash} from 'node:crypto';
import {makeDataset,rc} from './synth.mjs';
const wasm=await readFile(new URL('../../tools/sequence-mapper/engine/mm2.wasm',import.meta.url));
assert.equal(createHash('sha256').update(wasm).digest('hex'),ENGINE.wasmSha256);
const enc=new TextEncoder(),mapper=await createMapper(wasm);
function run(n,seed){
 const {ref,records}=makeDataset({n,seed}),refBytes=enc.encode(ref);mapper.setReference(refBytes);
 const offs=new Uint32Array(n+1);records.forEach((r,i)=>{offs[i+1]=offs[i]+r.seq.length;});const pool=new Uint8Array(offs[n]);records.forEach((r,i)=>pool.set(enc.encode(r.seq),offs[i]));
 const flags=new Uint8Array(n),parts=[];
 for(let f=0;f<n;f+=700){const l=Math.min(n,f+700),o=offs.slice(f,l+1).map(x=>x-offs[f]);parts.push({first:f,...mapChunk(mapper,pool.subarray(offs[f],offs[l]),o,flags.subarray(f,l))});}
 const m=mergeChunks(n,parts);return {S:{pool,offs,flags,fileIdx:new Uint16Array(n),...m},records,ref,refBytes};
}
for(const [n,seed] of [[1000,3],[10000,4]]){
 const {S,records,ref,refBytes}=run(n,seed),row=new Uint8Array(ref.length),ins=new Uint16Array(ref.length),comp={A:'T',C:'G',G:'C',T:'A',N:'N'};
 let checked=0,wrongNoIndel=0,wrong=0,strand=0,mappable=0,unrelatedMapped=0;const missed={};
 records.forEach((r,i)=>{const b=i*STRIDE;
  if(r.cat==='unrelated'){if(S.meta[b+REF]>=0)unrelatedMapped++;return;}
  mappable++;if(S.meta[b+REF]<0){missed[r.cat]=(missed[r.cat]||0)+1;return;}if(!!S.meta[b+REV]===r.reverse)strand++;
  expandRow(S,i,row,ins);const f=r.reverse?rc(r.seq):r.seq,clean=r.map.every((t,q)=>t>=0&&(q===0||t===r.map[q-1]+1));
  r.map.forEach((t,q)=>{const v=row[t];if(t<0||!v||v===45)return;checked++;if(v!==f.charCodeAt(q)){wrong++;if(clean)wrongNoIndel++;}});});
 const c=summarize(S),mapped=c.mapped+c.partial;
 assert.equal(unrelatedMapped,0,'unrelated sequences stay unmapped');
 // Full-length and near-identical records must all map; only very divergent or very short ones may be missed.
 for(const cat of ['normal','duplicate','partial','nrun'])assert.equal(missed[cat]??0,0,cat+' unmapped');
 const hard=records.filter(r=>r.cat==='divergent'||r.cat==='short').length;assert((missed.divergent??0)+(missed.short??0)<hard*.05,'hard category '+JSON.stringify(missed));assert.equal(strand,mapped,'strand');
 // Adjacent substitutions may legitimately be written as a 1D..1I pair by the aligner, so this is a rate, not zero.
 assert(wrongNoIndel/checked<1e-4,'records without indels '+wrongNoIndel);assert(wrong/checked<.001,'indel placement '+wrong/checked);
 const R=computeRecordStats(S,refBytes);assert.equal(R.length,n*6);
 console.log(`PASS: ${n} synthetic records · mapped ${mapped}/${mappable} · checked bases ${checked} · differ ${wrong} (without indels ${wrongNoIndel}) · missed ${JSON.stringify(missed)}`);
}
// Exact placement of a known case, both strands
{const {ref}=makeDataset({n:1,seed:8}),refBytes=enc.encode(ref),q=ref.slice(300,900);mapper.setReference(refBytes);
 for(const [s,rev] of [[q,0],[rc(q),1]]){const b=enc.encode(s),r=mapChunk(mapper,b,Uint32Array.of(0,b.length),new Uint8Array(1));assert.equal(r.meta[REF],300);assert.equal(r.meta[REV],rev);assert.equal(r.cig.length,1);assert.equal(r.cig[0],600*16+7);}}
// Invalid and empty records are skipped, not guessed
{const b=enc.encode('ACGT'),r=mapChunk(mapper,b,Uint32Array.of(0,4,4),Uint8Array.of(1,4));assert.equal(r.meta[REF],-2);assert.equal(r.meta[STRIDE+REF],-2);}
console.log('PASS: Sequence Mapper mapping accuracy on synthetic truth.');
