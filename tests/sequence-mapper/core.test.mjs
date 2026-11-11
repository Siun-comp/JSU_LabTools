import assert from 'node:assert/strict';
import {RecordStore,readInto,createFileParser,FLAG,summarizeFlags,duplicateIds,displayName} from '../../tools/sequence-mapper/core/parse.mjs';
import {STRIDE,REF,REV,QS,QE,MAPQ,HITS,COFF,CN,OP,expandRow,countRow,identityOf,buildColumns,projectRow,samCigar,clips,toDisplay,fromDisplay,reverseComplementBytes,GAP} from '../../tools/sequence-mapper/core/alignment.mjs';
import {computeStats,computeRecordStats,statusOf,summarize,buildConsensus} from '../../tools/sequence-mapper/core/stats.mjs';
import {alignedToRecords,alignedRowLength,findReferenceRow} from '../../tools/sequence-mapper/core/aligned-import.mjs';
import {summaryCsv,samFile,alignedFasta,selectedFasta,csvCell,uniqueIds} from '../../tools/sequence-mapper/core/export.mjs';
import {judge,judgeAligned,LIMITS,formatBases,repeatShare,REPEAT_WARNING_SHARE} from '../../tools/sequence-mapper/core/limits.mjs';
import {mergeChunks} from '../../tools/sequence-mapper/core/map-chunk.mjs';
const enc=new TextEncoder(),str=b=>new TextDecoder().decode(b),bytes=s=>enc.encode(s);
const parse=async(text,o)=>{const st=new RecordStore(16,o?.keepGaps),rep=await readInto(st,new File([text],'t.fa'),0,o);return {...st.finish(),rep};};
const seqOf=(r,i)=>str(r.pool.subarray(r.offs[i],r.offs[i+1]));

// FASTA
{const r=await parse('﻿>a one\r\nACGT\r\nacgt\r\n>a two\nAC\n GT 1\n>b\n>c\nACGU\n');
 assert.equal(r.names.length,4);assert.equal(seqOf(r,0),'ACGTACGT');assert(r.flags[0]&FLAG.LOWER);assert.equal(seqOf(r,3),'ACGT');assert(r.flags[3]&FLAG.RNA);assert(r.flags[1]&FLAG.INVALID);assert(r.flags[2]&FLAG.EMPTY);
 assert.equal(duplicateIds(r.names),1);assert.equal(summarizeFlags(r.flags).invalid,1);assert.equal(r.rep.format,'FASTA');}
{const r=await parse('ACGT\n>a\nAC\n');assert.match(r.rep.errors[0],/파일|머리글|형식/);}
{const r=await parse('');assert.match(r.rep.errors[0],/비어/);}
{const r=await parse('>a\nAC-GT..A\n');assert.equal(seqOf(r,0),'ACGTA');assert(r.flags[0]&FLAG.GAP);}
{const r=await parse('>a\nAC-G\n',{keepGaps:true});assert.equal(seqOf(r,0),'AC-G');}
{const st=new RecordStore(16),p=createFileParser(st,0,'x');const b=bytes('>name here\nACGTACGT\nAC');for(const c of [b.slice(0,3),b.slice(3,14),b.slice(14)])p.push(c);p.finish();const r=st.finish();assert.equal(r.names[0],'name here');assert.equal(seqOf(r,0),'ACGTACGTAC');}
// List label
assert.equal(displayName('NC_002208.1 Influenza B virus (B/Lee/1940) segment 5, complete sequence'),'NC_002208.1 (Influenza B virus (B/Lee/1940) segment 5, complete sequence)');
assert.equal(displayName('PV353636.1 |Influenza B virus (B/Texas/ISC-1021/2024)'),'PV353636.1 (Influenza B virus (B/Texas/ISC-1021/2024))');
assert.equal(displayName('PV353636.1| Influenza B'),'PV353636.1 (Influenza B)');assert.equal(displayName('A.1 |Flu B','accession'),'A.1');assert.equal(displayName('A.1 |Flu B','description'),'Flu B');assert.equal(displayName('ONLY.1','description'),'ONLY.1','no description falls back to the accession');assert.equal(displayName('ONLY.1'),'ONLY.1');assert.equal(displayName(''),'');
// GenBank
const GB=`LOCUS       NC_1      12 bp    DNA     linear   VRL 01-JAN-2020
DEFINITION  Test virus
            segment 5.
ACCESSION   NC_1
VERSION     NC_1.2
FEATURES             Location/Qualifiers
     gene            1..12
                     /gene="x"
ORIGIN
        1 acgtacgtac gt
//
LOCUS       B 4 bp
VERSION     B.1
ORIGIN
        1 ttaa
//
`;
{const r=await parse(GB,{keepFeatures:true});assert.equal(r.rep.format,'GenBank');assert.equal(r.names.length,2);assert.equal(r.names[0],'NC_1.2 Test virus segment 5.');assert.equal(seqOf(r,0),'ACGTACGTACGT');assert.equal(seqOf(r,1),'TTAA');assert.match(r.rep.features,/gene="x"/);assert.equal(r.rep.errors.length,0);}
{const r=await parse(GB.slice(0,GB.indexOf('//')));assert.match(r.rep.errors[0],/잘렸/);}
{const r=await parse('hello\n');assert.match(r.rep.errors[0],/형식/);}

// Alignment model on a hand-built record
// ref  ACGTACGTAC  (0-based)
// q    --GTA-GTTAC: reverse case built below. Forward: start 2, cigar 3=,1D,2=,1I,1X,2=
const ref=bytes('ACGTACGTAC');
function rec(seqs,hits){const pool=bytes(seqs.join('')),offs=new Uint32Array(seqs.length+1);seqs.forEach((s,i)=>{offs[i+1]=offs[i]+s.length;});const meta=new Int32Array(seqs.length*STRIDE),cig=[];
 hits.forEach((h,i)=>{const b=i*STRIDE;meta[b+COFF]=cig.length;if(!h){meta[b+REF]=-1;return;}meta[b+REF]=h.start;meta[b+REV]=h.rev?1:0;meta[b+QS]=h.qs??0;meta[b+QE]=h.qe??seqs[i].length;meta[b+MAPQ]=60;meta[b+HITS]=1;meta[b+CN]=h.cig.length;for(const [l,o] of h.cig)cig.push(l*16+o);});
 return {pool,offs,flags:new Uint8Array(seqs.length),fileIdx:new Uint16Array(seqs.length),meta,cig:Uint32Array.from(cig),extra:new Int32Array(0)};}
const {EQ,X,I,D}=OP;
const fwd={start:2,cig:[[3,EQ],[1,D],[2,EQ],[1,I],[1,X],[1,EQ]]}; // GTA - GT T(ins) T(vs A) ... see below
const S=rec(['GTAGTTTC'],[fwd]);
{const row=new Uint8Array(10),ins=new Uint16Array(10);assert(expandRow(S,0,row,ins));
 assert.deepEqual([...row].map(x=>x?String.fromCharCode(x):'_').join(''),'__GTA-GTTC');assert.equal(ins[8],1);
 const c=countRow(S,0,ref);assert.deepEqual([c.match,c.mismatch,c.insertion,c.deletion,c.refEnd],[6,1,1,1,10]);assert.equal(identityOf(c),6/9);}
// Reverse strand: query is the reverse complement of ref[2..8)
{const q=str(reverseComplementBytes(ref.subarray(2,8)));assert.equal(q,'ACGTAC');
 const R=rec(['TT'+q],[{start:2,rev:true,qs:2,qe:8,cig:[[6,EQ]]}]);const row=new Uint8Array(10),ins=new Uint16Array(10);expandRow(R,0,row,ins);assert.equal(str(row.subarray(2,8)),'GTACGT');assert.deepEqual(clips(8,true,2,8),[0,2]);
 assert.equal(samCigar(R.cig,0,1,...clips(8,true,2,8)),'6M2S');}
// IUPAC stays ambiguous and leaves the identity denominator; reference ambiguity too
{const R=rec(['ACNT'],[{start:0,cig:[[2,EQ],[1,X],[1,EQ]]}]);const c=countRow(R,0,bytes('ACGT'));assert.deepEqual([c.match,c.mismatch,c.ambiguous],[3,0,1]);assert.equal(identityOf(c),1);}
// Coordinates and CIGAR text
assert.equal(toDisplay(0),1);assert.equal(fromDisplay(1),0);assert.deepEqual(clips(10,false,2,9),[2,1]);
assert.equal(samCigar(S.cig,0,S.cig.length,0,0),'3M1D2M1I2M');assert.equal(samCigar(S.cig,0,S.cig.length,1,2,true),'1S3=1D2=1I1X1=2S');
// Columns: an insertion before ref position 8 opens one column in every row
{const two=rec(['GTAGTTTC','ACGTACGT'],[fwd,{start:0,cig:[[8,EQ]]}]),insMax=new Uint16Array(10);insMax[8]=1;const cols=buildColumns(insMax);assert.equal(cols.total,11);assert.equal(cols.colOf[8],9);assert.equal(cols.refOfCol[8],-1);
 const out=new Uint8Array(11);projectRow(two,0,cols,out,0,11);assert.equal([...out].map(x=>x?String.fromCharCode(x):'_').join(''),'__GTA-GTTTC');
 projectRow(two,1,cols,out,0,11);assert.equal([...out].map(x=>x?String.fromCharCode(x):'_').join(''),'ACGTACGT___');
 const part=new Uint8Array(3);projectRow(two,0,cols,part,7,10);assert.equal(str(part),'TTT');}
// Row covering past an insertion column gets a gap, not a blank
{const t=rec(['ACGTACGTAC','GTAGTTTC'],[{start:0,cig:[[10,EQ]]},fwd]),st=computeStats(t,Uint32Array.from([0,1]),10),cols=buildColumns(st.insMax,10),o=new Uint8Array(cols.total);projectRow(t,0,cols,o,0,cols.total);assert.equal(str(o),'ACGTACGT-AC');assert.equal(st.insRows[8],1);}
// Position statistics: missing != deletion != N != mismatch
{const t=rec(['AC','AG','A-'.replace('-','N'),'AC'],[{start:0,cig:[[2,EQ]]},{start:0,cig:[[1,EQ],[1,X]]},{start:0,cig:[[1,EQ],[1,X]]},{start:1,qs:1,qe:2,cig:[[1,EQ]]}]);
 const st=computeStats(t,Uint32Array.from([0,1,2]),4);assert.equal(st.coverage[0],3);assert.equal(st.called[1],2);assert.equal(st.coverage[1],3);assert.equal(st.coverage[2],0);assert(Number.isNaN(st.identity[2]));assert.equal(st.consensus[2],0);assert.equal(String.fromCharCode(st.consensus[1]),'S');assert.equal(st.identity[1],0);/* C and G: the one pair differs (mean pairwise, AP-272; was most-common share .5) */
 const one=computeStats(t,Uint32Array.from([0]),4);assert.equal(String.fromCharCode(one.consensus[1]),'C');assert.equal(one.coverage[0],1);
 // One sequence has nothing to be conserved against: no conservation value, coverage still counts it.
 assert(Number.isNaN(one.identity[0]));assert(Number.isNaN(one.identity[1]));}
// A deletion in the only sequence: covered (counted as deletion), no conservation value
{const t=rec(['AT'],[{start:0,cig:[[1,EQ],[1,D],[1,EQ]]}]),st=computeStats(t,Uint32Array.from([0]),3);assert.equal(st.coverage[1],1);assert.equal(st.called[1],0);assert.equal(st.counts[1*6+5],1);assert(Number.isNaN(st.identity[1]));assert.equal(st.consensus[1],GAP);}
{const t=rec(['AT','AT','AGT'],[{start:0,cig:[[1,EQ],[1,D],[1,EQ]]},{start:0,cig:[[1,EQ],[1,D],[1,EQ]]},{start:0,cig:[[3,EQ]]}]),st=computeStats(t,Uint32Array.from([0,1,2]),3);assert.equal(st.consensus[1],GAP);assert.equal(st.coverage[1],3);assert.equal(st.called[1],1);assert.equal(st.identity[1],Math.fround(1/3));/* deletion, deletion, G: 1 of 3 pairs alike (AP-272; was 2/3) */
 // Geneious check cases (synthetic): 9A+1C 80%, 7A+3C 53.3%, 4A+3C+3G 26.7% (red), all alike 100%
 {const one=b=>({A:'A',C:'C',G:'G'})[b];const cases=[['AAAAAAAAAC',.8],['AAAAAAACCC',24/45],['AAAACCCGGG',12/45],['AAAAAAAAAA',1]];
  for(const [col,want] of cases){const seqs=[...col].map(one),t2=rec(seqs,seqs.map(()=>({start:0,cig:[[1,EQ]]}))),s2=computeStats(t2,Uint32Array.from(seqs.map((_,i)=>i)),1);assert.equal(s2.identity[0],Math.fround(want),col);}}}
// Status keeps states apart
{const t=rec(['ACGTACGTAC','ACGTACGTAC','ACGT'],[{start:0,cig:[[10,EQ]]},{start:0,qs:0,qe:5,cig:[[5,EQ]]},null]);t.meta[2*STRIDE+REF]=-1;assert.deepEqual([0,1,2].map(i=>statusOf(t,i)),['mapped','partial','unmapped']);const n=rec(['AC'],[null]);n.meta[REF]=-2;assert.equal(statusOf(n,0),'skipped');assert.equal(summarize(t).partial,1);}
// Chunks merge with shifted offsets
{const a={first:0,meta:new Int32Array(STRIDE),cig:Uint32Array.of(5),extra:new Int32Array(0)},b={first:1,meta:new Int32Array(STRIDE),cig:Uint32Array.of(7,9),extra:Int32Array.of(0,3,0,0,4,60,0,0,2)};b.meta[CN]=1;const m=mergeChunks(2,[b,a]);assert.deepEqual([...m.cig],[5,7,9]);assert.equal(m.meta[STRIDE+COFF],1);assert.equal(m.extra[0],1);assert.equal(m.extra[7],1);}

// Aligned import
{const st=new RecordStore(16,true);const p=createFileParser(st,0,'a');p.push(bytes('>ref\nAC-GTACGT\n>q1\nAC-GTACGT\n>q2\n--TGTA-GT\n>q3\nAC-TT----\n>empty\n---------\n'));p.finish();const raw=st.finish();assert.equal(alignedRowLength(raw),9);
 const res=alignedToRecords(raw,0);assert.equal(str(res.reference.sequence),'ACGTACGT');const d=res.data;assert.equal(d.names.length,4);
 assert.equal(d.meta[REF],0);assert.equal(samCigar(d.cig,d.meta[COFF],d.meta[CN],0,0,true),'8=');
 const b=STRIDE;assert.equal(d.meta[b+REF],2);assert.equal(samCigar(d.cig,d.meta[b+COFF],d.meta[b+CN],0,0,true),'1I3=1D2=');
 const row=new Uint8Array(8),ins=new Uint16Array(8),S2={...d};expandRow(S2,2,row,ins);assert.equal(str(row.subarray(0,3)),'ACT');assert.equal(d.meta[3*STRIDE+REF],-1);
 assert.equal(findReferenceRow(raw.names,'q3'),3);assert.throws(()=>findReferenceRow(raw.names,'zzz'));assert.throws(()=>findReferenceRow(raw.names,'q'));}
{const st=new RecordStore(16,true),p=createFileParser(st,0,'a');p.push(bytes('>r\nACGT\n>q\nACG\n'));p.finish();assert.throws(()=>alignedRowLength(st.finish()),/행 길이/);}

// Exports
const fwd2={start:2,cig:[[3,EQ],[1,D],[2,EQ],[1,I],[1,X],[1,EQ]]};
function ctx(){const E=rec(['GTAGTTTC','ACGTACGT','GGGG'],[fwd2,{start:0,rev:true,cig:[[8,EQ]]},null]);const R=computeRecordStats(E,ref),st=computeStats(E,Uint32Array.from([0,1]),10);return {S:E,R,names:['q one desc','q one dup','=bad name'],files:['f.fa'],refId:'REF1',refLength:10,ref,stats:st,cols:buildColumns(st.insMax,10),meta:{engine:'2.31',parameters:'-x test',tool:'t'}};}
const all=g=>[...g].join('');
{const c=ctx(),sam=all(samFile(c,Uint32Array.from([0,1,2]))).trim().split('\n');assert.match(sam[0],/^@HD/);assert.match(sam[1],/SN:REF1\tLN:10/);const rows=sam.filter(l=>l[0]!=='@').map(l=>l.split('\t'));assert.equal(rows.length,3);
 assert.deepEqual(rows.map(r=>r[0]),['q','q_dup1','=bad']);assert.equal(rows[0][1],'0');assert.equal(rows[0][3],'3');assert.equal(rows[0][5],'3M1D2M1I2M');assert.equal(rows[0][9],'GTAGTTTC');assert.match(rows[0][11],/NM:i:3/);
 assert.equal(rows[1][1],'16');assert.equal(rows[1][9],str(reverseComplementBytes(bytes('ACGTACGT'))));assert.equal(rows[2][1],'4');assert.equal(rows[2][2],'*');
 // CIGAR must consume exactly the sequence
 for(const r of rows.slice(0,2)){let q=0;for(const m of r[5].matchAll(/(\d+)([MIDS=X])/g))if('MIS=X'.includes(m[2]))q+=+m[1];assert.equal(q,r[9].length);}}
{const c=ctx(),lines=all(alignedFasta(c,Uint32Array.from([0,1,2]),{includeConsensus:true})).trim().split('\n');assert.equal(lines.length,8);const w=lines[1].length;assert.equal(w,11);for(let i=1;i<lines.length;i+=2)assert.equal(lines[i].length,w);assert.equal(lines[1],'ACGTACGT-AC');assert.equal(lines[0],'>REF1 reference');assert.equal(lines[2],'>consensus');assert.equal(lines[5],'--GTA-GTTTC');}
{const c=ctx(),csv=all(summaryCsv(c,Uint32Array.from([0,2]))).split('\r\n');assert.match(csv[0],/^﻿source_file,/);assert.match(csv[1],/,6,1,0,1,1,66\.667,/);assert.match(csv[2],/'=bad/);assert.equal(csvCell('a,"b"'),'"a,""b"""');assert.equal(csvCell('-x'),"'-x");}
{const c=ctx();const f=all(selectedFasta(c,Uint32Array.from([1]),{orientation:'reference'}));assert.equal(f,`>q one dup\n${str(reverseComplementBytes(bytes('ACGTACGT')))}\n`);assert.equal(all(selectedFasta(c,Uint32Array.from([1]))),'>q one dup\nACGTACGT\n');assert.deepEqual(uniqueIds(['a b','a c','c']),['a','a_dup1','c']);}

// Support range
{let r=7;const rand=n=>{let s='';for(let i=0;i<n;i++){r=(r*1103515245+12345)&0x7fffffff;s+='ACGT'[r>>16&3];}return s;},plain=rand(3000),unit=rand(200);assert(repeatShare(bytes(plain))<REPEAT_WARNING_SHARE);assert(repeatShare(bytes(unit.repeat(15)))>=REPEAT_WARNING_SHARE);assert(repeatShare(bytes(plain+'A'.repeat(30)))<REPEAT_WARNING_SHARE,'a short poly-A tail is not a repeat problem');assert.equal(repeatShare(bytes('ACG')),0);}
assert.equal(judge({totalBases:LIMITS.recommendedBases,referenceLength:2000}).level,'ok');
assert.equal(judge({totalBases:LIMITS.recommendedBases+1,referenceLength:2000}).level,'caution');
assert.equal(judge({totalBases:LIMITS.maxBases,referenceLength:2000}).level,'caution');
assert.equal(judge({totalBases:LIMITS.maxBases+1,referenceLength:2000}).level,'blocked');
assert.equal(judge({totalBases:1000,referenceLength:LIMITS.maxReferenceLength+1}).level,'blocked');
assert.equal(judge({totalBases:1000,referenceLength:10}).level,'blocked');
assert.equal(judgeAligned({rows:1e6,columns:2000}).level,'blocked');assert.equal(formatBases(4e8),'400 Mb');
console.log('PASS: Sequence Mapper parser, coordinates, CIGAR, statistics, aligned import, exports and support range.');
