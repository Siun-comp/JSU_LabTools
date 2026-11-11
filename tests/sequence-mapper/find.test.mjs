import assert from 'node:assert/strict';
import {parseQuery,matchTable,buildForms,findInTarget,findInRows,FIND_LIMITS} from '../../tools/sequence-mapper/core/find.mjs';
import {STRIDE,REF,REV,QS,QE,COFF,CN,OP,buildColumns,columnOfQuery,projectRow,reverseComplementBytes} from '../../tools/sequence-mapper/core/alignment.mjs';
import {reverseComplement} from '../../tools/sequence-mapper/core/primer.mjs';
const B=s=>new TextEncoder().encode(s),D=b=>new TextDecoder().decode(b);
// Input
assert.equal(parseQuery("5'-acgu acgt-3'").sequence,'ACGTACGT');assert.match(parseQuery('').error,/입력/);assert.match(parseQuery('ACG').error,/4 nt/);assert.match(parseQuery('ACGT1').error,/1/);assert.match(parseQuery('A'.repeat(201)).error,/200/);assert.match(parseQuery('ACGTACGT',3).error,/12 nt/);assert.equal(parseQuery('ACGTACGTACGT',3).sequence,'ACGTACGTACGT');
// The four combinations of the ambiguity options
const yes=(q,t,o)=>!!matchTable(q,o)[t.charCodeAt(0)];
const both={queryAmbiguity:true,sequenceAmbiguity:true},none={queryAmbiguity:false,sequenceAmbiguity:false},query={queryAmbiguity:true,sequenceAmbiguity:false},seq={queryAmbiguity:false,sequenceAmbiguity:true};
assert(yes('A','A',none));assert(!yes('A','C',both));
assert(yes('R','A',both));assert(yes('R','A',query));assert(!yes('R','A',none));assert(!yes('R','A',seq));
assert(yes('A','N',both));assert(yes('A','N',seq));assert(!yes('A','N',none));assert(!yes('A','N',query));
assert(yes('R','N',both));assert(!yes('R','Y',both));assert(yes('N','N',none));assert(!yes('A','-',both));assert(!matchTable('A')[0]);
// Reference search
const ref='TTTTTTTTTTACGGATCCTAGGCAATTTTTTTTTTTGGCATTAGCCAGTCCCCCCCCCC',R=B(ref);
const run=(q,o={})=>findInTarget(R,buildForms(q,o),o).hits;
assert.deepEqual(run('ACGGATCCTAGG').map(h=>[h.start,h.end,h.strand,h.mismatches]),[[10,22,1,0]]);
assert.deepEqual(run(reverseComplement('GGCATTAGCCAG')).map(h=>[h.start,h.end,h.strand]),[[36,48,-1]]);
assert.equal(run(reverseComplement('GGCATTAGCCAG'),{bothStrands:false}).length,0);
assert.equal(run('ACGGATCCTRGG').length,1);assert.equal(run('ACGGATCCTRGG',{queryAmbiguity:false}).length,0);
assert.equal(run('ACGGTTCCTAGG').length,0);assert.equal(run('ACGGTTCCTAGG',{maxMismatch:1})[0].mismatches,1);
// A palindrome is one site, not two
assert.equal(run('GGATCC').length,1);assert.equal(buildForms('GGATCC').length,1);
// Sites at the ends
assert.equal(run(ref.slice(0,8),{bothStrands:false}).filter(h=>h.start===0).length,1);assert.equal(run(ref.slice(-8),{bothStrands:false}).at(-1).end,ref.length);
// Sequence ambiguity: an N run counts only while the option is on
{const t=B('ACGTNNNNNNNNACGT');assert.equal(findInTarget(t,buildForms('GGAATTCC',{bothStrands:false}),{}).hits.length,1);assert.equal(findInTarget(t,buildForms('GGAATTCC',{bothStrands:false,sequenceAmbiguity:false}),{}).hits.length,0);
 const one=B('TTACGGNTCCTAGGTT');assert.equal(findInTarget(one,buildForms('ACGGATCCTAGG',{bothStrands:false}),{}).hits.length,1);assert.equal(findInTarget(one,buildForms('ACGGATCCTAGG',{bothStrands:false,sequenceAmbiguity:false}),{}).hits.length,0);}
// Consensus: a site across a gap is found and spans it; an uncovered stretch blocks
{const t=B('ACGGAT--CCTAGGCA');const h=findInTarget(t,buildForms('GATCCTAG',{}),{}).hits;assert.deepEqual([h[0].start,h[0].end],[3,13]);const u=new Uint8Array(B('ACGGATCCTAGG'));u[5]=0;assert.equal(findInTarget(u,buildForms('GGATCCTA',{}),{}).hits.length,0);}
assert.equal(findInTarget(R,buildForms('TTTT',{bothStrands:false}),{limit:3}).hits.length,3);assert.equal(findInTarget(R,buildForms('TTTT',{bothStrands:false}),{limit:3}).capped,true);
// Rows. Records built by hand: forward, reverse, a deletion, an insertion, soft clips, unmapped
const refLen=60,reference=B('GATTCCAGTCAGGTCTAGCATCGGATCAAGTCGCTTAGGACATTCGGCATAGCTTAGGCA');assert.equal(reference.length,refLen);
const cig=(...ops)=>ops.map(([l,o])=>l<<4|o);
function dataset(rows){const pool=[],offs=[0],meta=new Int32Array(rows.length*STRIDE),all=[];rows.forEach((r,i)=>{const b=i*STRIDE;pool.push(...B(r.seq));offs.push(pool.length);meta[b+REF]=r.ref??-1;meta[b+REV]=r.rev?1:0;meta[b+QS]=r.qs??0;meta[b+QE]=r.qe??r.seq.length;meta[b+COFF]=all.length;meta[b+CN]=r.cig?.length??0;all.push(...(r.cig??[]));});return {pool:Uint8Array.from(pool),offs:Uint32Array.from(offs),meta,cig:Uint32Array.from(all)};}
const fwd=D(reference),rc=reverseComplement(fwd),del=fwd.slice(0,20)+fwd.slice(24),ins=fwd.slice(0,30)+'AAA'+fwd.slice(30);
const insMax=new Uint16Array(refLen);insMax[30]=3;const cols=buildColumns(insMax);
const S=dataset([{seq:fwd,ref:0,cig:cig([60,OP.EQ])},{seq:rc,ref:0,rev:1,cig:cig([60,OP.EQ])},{seq:del,ref:0,cig:cig([20,OP.EQ],[4,OP.D],[36,OP.EQ])},{seq:ins,ref:0,cig:cig([30,OP.EQ],[3,OP.I],[30,OP.EQ])},{seq:'CCCCC'+fwd.slice(0,40)+'GGGGG',ref:0,qs:5,qe:45,cig:cig([40,OP.EQ])},{seq:fwd},{seq:rc,ref:10,rev:1,qs:0,qe:50,cig:cig([50,OP.EQ])}]);
// Columns agree with the drawn rows at every aligned base
for(let i=0;i<7;i++){if(S.meta[i*STRIDE+REF]<0)continue;const buf=new Uint8Array(cols.total);projectRow(S,i,cols,buf,0,cols.total);const raw=S.pool.subarray(S.offs[i],S.offs[i+1]),o=S.meta[i*STRIDE+REV]?reverseComplementBytes(raw):raw;let seen=0;for(let q=0;q<o.length;q++){const c=columnOfQuery(S,i,cols,q);if(c<0)continue;assert.equal(buf[c],o[q],`row ${i} q ${q}`);seen++;}assert(seen>=40);}
assert.equal(columnOfQuery(S,4,cols,4),-1);assert.equal(columnOfQuery(S,4,cols,5),0);assert.equal(columnOfQuery(S,4,cols,45),-1);assert.equal(columnOfQuery(S,5,cols,0),-1);
const all=(q,o={},order=[0,1,2,3,4,5,6])=>{const g=findInRows(S,Uint32Array.from(order),cols,buildForms(q,o),{...o,slice:2});let x,flat=[],yields=0;while(!(x=g.next()).done){flat.push(...x.value.hits);yields++;}flat.push(...x.value.hits);const hits=[];for(let k=0;k<flat.length;k+=5)hits.push(flat.slice(k,k+5));return {...x.value,hits,yields};};
{const q=fwd.slice(5,17),r=all(q,{bothStrands:false});assert.deepEqual(r.hits.map(h=>h[0]),[0,1,2,3,4]);assert(r.hits.every(h=>h[1]===5&&h[2]===17&&h[3]===1));assert(r.yields>=3);assert.equal(r.outside,1);}
// A reverse record reads forward on the screen, so strand follows the screen and not the stored file
{const q=rc.slice(0,12),r=all(q,{bothStrands:true});for(const h of r.hits.filter(x=>x[0]<2)){assert.equal(h[3],-1);assert.deepEqual([h[1],h[2]],[cols.colOf[48],cols.colOf[59]+1]);}assert.equal(all(fwd.slice(5,17),{bothStrands:true}).hits.find(h=>h[0]===1)[3],1);}
// Across a deletion the hit covers the gap columns
{const q=del.slice(14,26),h=all(q,{bothStrands:false}).hits.find(x=>x[0]===2);assert.deepEqual([h[1],h[2]],[14,30]);}
// Across an insertion
{const q=ins.slice(26,38),h=all(q,{bothStrands:false}).hits;assert.deepEqual(h.map(x=>x[0]),[3]);assert.deepEqual([h[0][1],h[0][2]],[cols.colOf[26],cols.colOf[34]+1]);}
// Bases outside the alignment are counted, not shown
{const r=all('CCCCC'+fwd.slice(0,7),{bothStrands:false});assert.equal(r.hits.length,0);assert.equal(r.outside,1);}
// Unmapped rows have nothing on screen
assert.equal(all(fwd.slice(5,17),{bothStrands:false},[5]).hits.length,0);
// View order decides the row numbers
assert.deepEqual(all(fwd.slice(5,17),{bothStrands:false},[4,0]).hits.map(h=>h[0]),[0,1]);
// Hit cap
{const r=all(fwd.slice(5,17),{bothStrands:false,limit:2});assert.equal(r.hits.length,2);assert.equal(r.capped,true);}
assert.equal(FIND_LIMITS.maxMismatch,3);
console.log('find tests ok');
