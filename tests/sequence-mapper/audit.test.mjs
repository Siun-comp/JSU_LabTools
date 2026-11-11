// Cases from the code audit review (docs/249). Synthetic sequences only.
import assert from 'node:assert/strict';
import {computeStats,differsFrom,POSITION_DEFINITIONS} from '../../tools/sequence-mapper/core/stats.mjs';
import {buildColumns,projectRow,OP} from '../../tools/sequence-mapper/core/alignment.mjs';
import {findSites,placePrimer,parseText,MASK} from '../../tools/sequence-mapper/core/primer.mjs';
import {computeBinding,runToEnd,classify,CAT,END3_FLAG,variantParts,isWholeDeletion} from '../../tools/sequence-mapper/core/binding.mjs';
import {alignedToRecords} from '../../tools/sequence-mapper/core/aligned-import.mjs';
import {RecordStore,createFileParser} from '../../tools/sequence-mapper/core/parse.mjs';
import {alignedFasta,summaryCsv,excelSafe,csvCell} from '../../tools/sequence-mapper/core/export.mjs';
import {checkDataset} from '../../tools/sequence-mapper/core/project.mjs';
import {subsetData} from '../../tools/sequence-mapper/core/list.mjs';
import {repeatKey} from '../../tools/sequence-mapper/core/limits.mjs';
const enc=new TextEncoder(),dec=new TextDecoder();
const store=fa=>{const s=new RecordStore(1<<16,true),p=createFileParser(s,0,'a.fasta');p.push(enc.encode(fa));p.finish();return s.finish();};
const aligned=(fa,ref=0)=>alignedToRecords(store(fa),ref);
const dataset=r=>{const d=r.data;return {pool:d.pool,offs:d.offs,flags:d.flags,fileIdx:d.fileIdx,inputOrder:d.inputOrder,meta:d.meta,cig:d.cig,extra:d.extra};};
const all=S=>Uint32Array.from({length:S.offs.length-1},(_,i)=>i);
const statsOf=r=>{const S=dataset(r),L=r.reference.sequence.length,st=computeStats(S,all(S),L);return {S,L,st,cols:buildColumns(st.insMax,L)};};
const variants=(st,ref)=>{const out=[];for(let i=0;i<ref.length;i++)if(differsFrom(st.counts,i,ref[i]))out.push(i);return out;};
const join=g=>{let s='';for(const b of g)s+=b;return s;};
const rows=txt=>txt.trim().split('\n').filter(l=>!l.startsWith('>'));

// T02: a change every record shares is a variant against the reference
{const r=aligned('>R\nACGTACGTAC\n>a\nACGTGCGTAC\n>b\nACGTGCGTAC\n'),{st}=statsOf(r);assert.equal(st.identity[4],1,'conservation stays 1');assert.deepEqual(variants(st,r.reference.sequence),[4]);}
{const r=aligned('>R\nACGTACGTAC\n>a\nACGT--GTAC\n>b\nACGT--GTAC\n'),{st}=statsOf(r);assert.deepEqual(variants(st,r.reference.sequence),[4,5]);}
// T01: identical records have no variant
{const r=aligned('>R\nACGTACGTAC\n>a\nACGTACGTAC\n'),{st}=statsOf(r);assert.deepEqual(variants(st,r.reference.sequence),[]);}
// T03: a few records only; a base in an N position or an N read says nothing
{const r=aligned('>R\nACGTACGTAC\n>a\nACGTGCGTAC\n>b\nACGTACGTAC\n'),{st}=statsOf(r);assert.deepEqual(variants(st,r.reference.sequence),[4]);}
{const r=aligned('>R\nACGNACGTAC\n>a\nACGTACGTAN\n'),{st}=statsOf(r);assert.deepEqual(variants(st,r.reference.sequence),[]);}
// Consensus codes cover their own bases, and a deletion consensus flags bases
{const counts=new Uint32Array(6);counts[0]=3;counts[2]=1;assert.equal(differsFrom(counts,0,'R'.charCodeAt(0)),false);assert.equal(differsFrom(counts,0,'A'.charCodeAt(0)),true);assert.equal(differsFrom(counts,0,45),true);const d=new Uint32Array(6);d[5]=2;assert.equal(differsFrom(d,0,45),false);assert.equal(differsFrom(d,0,65),true);}
assert.match(POSITION_DEFINITIONS.identity,/Reference 일치율이 아닙니다/);

// T07: N in the reference
{let site='';for(let i=0;i<24;i++)site+='ACGTTGCA'[(i*i+3*i)%8];const left='GATTACA'.repeat(30),gap='CCTTGGAA'.repeat(25),ref=left+'N'.repeat(40)+gap+site+gap,R=enc.encode(ref),h=findSites(R,site,{maxMismatch:3});assert.equal(h[0].start,ref.indexOf(site));assert.equal(h[0].mismatches,0);assert.equal(h[0].unresolved,0);assert.equal(placePrimer({sequence:site},R,null,{maxMismatch:3}).site.start,ref.indexOf(site));}
{const R=enc.encode('TTTTACGNACGTACGTTTT'),q='ACGTACGTACGT',h=findSites(R,q,{maxMismatch:1}).filter(x=>x.strand>0);assert.equal(h.length,1);assert.deepEqual([h[0].start,h[0].mismatches,h[0].unresolved],[4,0,1]);assert.equal(findSites(R,q,{maxMismatch:0}).filter(x=>x.strand>0).length,0,'N is not an exact match');}
{const R=enc.encode('TTACGTACGTACGNTT'),q='ACGTACGTACGT';assert.equal(findSites(R,q,{maxMismatch:1,end3Exact:3}).filter(x=>x.strand>0&&x.start===2).length,0,'N inside the 3-prime zone');}
{const R=enc.encode('TTTTACGTACGTACGTTTT');assert.equal(findSites(R,'ACGYACGTACGT').filter(x=>x.strand>0)[0].unresolved,0,'a mixed base in the primer is still a match');}
{const R=enc.encode('TTTTACGRACGTACGTTTT'),h=findSites(R,'ACGRACGTACGT').filter(x=>x.strand>0);assert.equal(h[0].unresolved,0,'same code on both sides');assert.equal(findSites(R,'ACGAACGTACGT').filter(x=>x.strand>0).length,0,'R against A is unresolved');}
// A certain site beats an unresolved one at the same score
{const R=enc.encode('NCGTACGTACGTTTTTTGCGTACGTACGT'),h=findSites(R,'ACGTACGTACGT',{maxMismatch:1}).filter(x=>x.strand>0);assert.deepEqual(h.map(x=>[x.start,x.mismatches,x.unresolved]),[[17,1,0],[0,0,1]]);}

// T06: terminal insertion, and the round trip through Aligned FASTA
function roundTrip(fa){const r=aligned(fa),{S,L,st,cols}=statsOf(r),txt=join(alignedFasta({S,names:r.data.names,cols,ref:r.reference.sequence,stats:st,refId:'R'},all(S))),back=aligned(txt);assert.deepEqual([...back.reference.sequence],[...r.reference.sequence]);assert.deepEqual([...back.data.pool],[...r.data.pool]);assert.deepEqual([...back.data.cig],[...r.data.cig]);assert.deepEqual([...back.data.meta],[...r.data.meta]);return {txt,L,cols};}
{const {txt,cols}=roundTrip('>R\nACGT--\n>a\nACGTGG\n');assert.equal(cols.total,6);assert.deepEqual(rows(txt),['ACGT--','ACGTGG']);}
{const {txt}=roundTrip('>R\nACGT--\n>a\nACGTGG\n>b\nACGT-G\n>c\nACGT--\n');assert.deepEqual(rows(txt),['ACGT--','ACGTGG','ACGTG-','ACGT--']);}
// T05: internal and leading insertions, deletions
{const {txt}=roundTrip('>R\n--ACGT--ACGTAC\n>a\nGGACGTTTACGTAC\n>b\n--AC-T--ACGTAC\n');assert.deepEqual(rows(txt),['--ACGT--ACGTAC','GGACGTTTACGTAC','--AC-T--ACGTAC']);}
// Terminal columns stay inside the projection
{const r=aligned('>R\nACGT--\n>a\nACGTGG\n'),{S,cols}=statsOf(r),o=new Uint8Array(cols.total);projectRow(S,0,cols,o,4,6);assert.equal(dec.decode(o.subarray(0,2)),'GG');assert.equal(cols.colOf[4],6);assert.equal(cols.refOfCol[5],-1);}
// Long insertions do not wrap
{const n=70000,r=aligned(`>R\nA${'-'.repeat(n)}CGT\n>a\nA${'G'.repeat(n)}CGT\n`),{st,cols}=statsOf(r);assert.equal(st.insMax[1],n);assert.equal(cols.total,n+4);}

// T08 and mixed cases of the binding classes
{const p={start:0,masks:Uint8Array.from('ACGTACGT',c=>MASK[c.charCodeAt(0)]),strand:1},ins=new Uint32Array(8),c=s=>classify(enc.encode(s),ins,p,3);assert.equal(c('ACGTACGA')&7,CAT.MM1);assert.ok(c('ACGTACGA')&END3_FLAG);assert.equal(c('ACGNACGA')&7,CAT.UNRESOLVED);assert.ok(c('ACGNACGA')&END3_FLAG,'a 3-prime mismatch stays flagged');assert.equal(c('ACGNTCGA')&7,CAT.MM2,'two certain mismatches stay');assert.equal(c('ACGNACGT')&7,CAT.UNRESOLVED);assert.equal(c('ACGTACGT')&7,CAT.MATCH);}
// An insertion inside the site is its own variant, on both strands
{const r=aligned('>R\nACGTAC--GTACGT\n>exact\nACGTAC--GTACGT\n>ins\nACGTACTTGTACGT\n'),S=dataset(r),go=primer=>runToEnd(computeBinding(S,all(S),[primer],12)).result[0];let t=go({id:1,name:'P',set:'',sequence:'GTACGTAC',site:{start:2,end:10,strand:1}});assert.deepEqual(t.counts,[1,0,0,1,0,0]);assert.equal(t.variantCount,2);assert.deepEqual(t.variants.map(v=>[v.sequence,v.count,v.differences]).sort(),[['GTAC(+2)GTAC',1,2],['GTACGTAC',1,0]]);
 t=go({id:2,name:'Q',set:'',sequence:'GTACGTAC',site:{start:2,end:10,strand:-1}});assert.equal(t.variantCount,2);assert.ok(t.variants.some(v=>v.sequence==='GTAC(+2)GTAC'));}

// Different inserted bases at one place share a variant (only place and length are kept); N reads are not counted as differences
{const r=aligned('>R\nACGTAC---GTACGT\n>a\nACGTACAAAGTACGT\n>b\nACGTACGGGGTACGT\n>c\nACGTACN--GTACGT\n'),S=dataset(r),t=runToEnd(computeBinding(S,all(S),[{id:1,name:'P',set:'',sequence:'GTACGTAC',site:{start:2,end:10,strand:1}}],12)).result[0];assert.deepEqual(t.variants.map(v=>[v.sequence,v.count,v.differences]),[['GTAC(+3)GTAC',2,3],['GTAC(+1)GTAC',1,1]]);
 const n=aligned('>R\nACGTACGTACGT\n>a\nACGTNCGTACGT\n'),u=runToEnd(computeBinding(dataset(n),all(dataset(n)),[{id:1,name:'P',set:'',sequence:'GTACGTAC',site:{start:2,end:10,strand:1}}],12)).result[0];assert.equal(u.counts[CAT.UNRESOLVED],1);assert.equal(u.variants[0].differences,0,'an N is not a certain difference');}
// Variant marks against the primer (primer direction); whole-site deletion; ratio base excludes uncovered records
{const k=x=>x.map(p=>`${p.kind||'='}:${p.text}`).join(' ');assert.equal(k(variantParts('GTACGTAC','GTACGTAC')),'=:GTACGTAC');assert.equal(k(variantParts('GTTCGTAC','GTACGTAC')),'=:GT mm:T =:CGTAC');assert.equal(k(variantParts('GT-CGTAC','GTACGTAC')),'=:GT del:- =:CGTAC');
 assert.equal(k(variantParts('GTAC(+2)GTAC','GTACGTAC')),'=:GTAC ins:(+2) =:GTAC');assert.equal(k(variantParts('GTNCGTAC','GTACGTAC')),'=:GT uk:N =:CGTAC');assert.equal(k(variantParts('GTRCGTAC','GTACGTAC')),'=:GT uk:R =:CGTAC');assert.equal(k(variantParts('GTCCGTAC','GTMCGTAC')),'=:GTCCGTAC');assert.equal(variantParts('GTAC','GTACGTAC'),null);
 assert.ok(isWholeDeletion('--------'));assert.ok(!isWholeDeletion('GT--GTAC'));
 const r=aligned('>R\nAAACGTACGTACAAAAAAAAAA\n>ok\nAAACGTACGTACAAAAAAAAAA\n>mm\nAAACGTTCGTACAAAAAAAAAA\n>gap\nAAA--------AAAAAAAAAAA\n>short\n-----------AAAAAAAAAAA\n'),S=dataset(r),go=strand=>runToEnd(computeBinding(S,all(S),[{id:1,name:'P',set:'',sequence:strand>0?'CGTACGTA':'TACGTACG',site:{start:3,end:11,strand}}],22)).result[0];
 for(const strand of [1,-1]){const t=go(strand);assert.equal(t.primer,strand>0?'CGTACGTA':'TACGTACG');assert.equal(t.total,4);assert.equal(t.counts[CAT.UNCOVERED],1);assert.equal(t.counts[CAT.INDEL],1);assert.equal(t.variants.length,3);assert.ok(t.variants.some(v=>isWholeDeletion(v.sequence)));
  for(const v of t.variants){const parts=variantParts(v.sequence,t.primer);assert.ok(parts,v.sequence);assert.equal(parts.filter(p=>p.kind==='mm'||p.kind==='del').reduce((a,p)=>a+p.text.length,0),v.differences,v.sequence);}}}
// T12-adjacent bookkeeping
{const r=parseText('name,sequence\n"F,1",ACGTACGTAC\n"He said ""x""",TTTTTTTTTT\nplain, GGGGGGGG\n').rows;assert.deepEqual(r[1],['F,1','ACGTACGTAC']);assert.deepEqual(r[2],['He said "x"','TTTTTTTTTT']);assert.deepEqual(r[3],['plain','GGGGGGGG']);assert.deepEqual(parseText('a\tb c\n').rows[0],['a','b c']);}
{const data={pool:enc.encode('AAAACCCCGGGG'),offs:Uint32Array.of(0,4,8,12),flags:new Uint8Array(3),fileIdx:new Uint16Array(3),names:['one','two','three']},sub=subsetData(data,Uint32Array.of(0,2)),n=2,S={...sub,meta:new Int32Array(n*8),cig:new Uint32Array(0),extra:new Int32Array(0)};for(let i=0;i<n;i++)S.meta[i*8]=-1;assert.deepEqual([...sub.inputOrder],[1,3]);const lines=join(summaryCsv({S,R:new Int32Array(n*6),names:sub.names,files:['f'],refId:'R',refLength:12},all(S))).split('\r\n');assert.equal(lines[2].split(',')[1],'3');assert.equal(lines[2].split(',')[3],'three');}
{const r=aligned('>a\nACGT\n>R\nACGT\n>b\nACGT\n',1);assert.deepEqual([...r.data.inputOrder],[1,3]);}
// Project links
{const good=()=>({pool:enc.encode('ACGT'),offs:Uint32Array.of(0,4),meta:Int32Array.of(0,0,0,4,60,1,0,1),cig:Uint32Array.of(4*16+OP.EQ),extra:new Int32Array(0)});assert.doesNotThrow(()=>checkDataset(good(),10,1));assert.doesNotThrow(()=>checkDataset({...good(),meta:Int32Array.of(0,0,0,4,60,1,0,2),cig:Uint32Array.of(2*16+OP.EQ,2*16+OP.I)},2,1),'a terminal insertion is legal');
 assert.throws(()=>checkDataset({...good(),cig:Uint32Array.of(2**27*16+OP.EQ>>>0)},10,1),/정렬 길이/);assert.throws(()=>checkDataset({...good(),cig:Uint32Array.of(9*16+OP.D)},5,1),/정렬 길이/);assert.throws(()=>checkDataset({...good(),meta:Int32Array.of(0,0,0,4,60,1,0,2),cig:Uint32Array.of(4*16+OP.EQ,1*16+OP.I)},10,1),/정렬 길이/);assert.throws(()=>checkDataset({...good(),inputOrder:new Uint32Array(5)},10,1),/입력 순서/);assert.throws(()=>checkDataset({...good(),extra:Int32Array.of(0,0,0,0,4,0,0,5,9)},10,1),/추가 정렬/);}
{assert.notEqual(repeatKey(enc.encode('ACGATTAACGATTACC'.repeat(5))),repeatKey(enc.encode('ATATATATCTATATAT'.repeat(5))));assert.equal(excelSafe('=1+1'),"'=1+1");assert.equal(excelSafe('-'),'-');assert.equal(excelSafe(12),'12');assert.equal(csvCell('=a,b'),'"\'=a,b"');}
console.log('PASS: Sequence Mapper audit review cases.');
