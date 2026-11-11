import assert from 'node:assert/strict';
import {buildConsensus,computeStats} from '../../tools/sequence-mapper/core/stats.mjs';
import {coversBase,STRIDE,REF,QS,QE,COFF,CN,OP} from '../../tools/sequence-mapper/core/alignment.mjs';
const text=b=>new TextDecoder().decode(b);
// Counts per position: A C G T other deletion
function make(rows){const n=rows.length,L=rows[0].length,counts=new Uint32Array(L*6),coverage=new Uint32Array(L),S='ACGT';for(const r of rows)for(let i=0;i<L;i++){const k=r[i]==='-'?5:S.indexOf(r[i]);counts[i*6+(k<0?4:k)]++;coverage[i]++;}return {counts,coverage};}
const at=(rows,p)=>{const {counts,coverage}=make(rows);return text(buildConsensus(counts,coverage,p));};
const four=['AAAA','AATA','AAAT','AATC'];
assert.equal(at(four,100),'AAWH');assert.equal(at(four,75),'AAWH');assert.equal(at(four,50),'AAWA');assert.equal(at(four,0),'AAWA');
// A stray base only enters when the threshold needs it
{const rows=[...Array(99).fill('A'),'C'];assert.equal(at(rows,100),'M');assert.equal(at(rows,99),'A');assert.equal(at(rows,98),'A');assert.equal(at(rows,99.5),'M');assert.equal(at(rows,0),'A');}
// Exactly at the threshold is enough
{const rows=[...Array(95).fill('G'),...Array(5).fill('T')];assert.equal(at(rows,95),'G');assert.equal(at(rows,96),'K');}
// Deletion majority stays a gap; other letters leave the denominator; nothing readable gives N; no coverage stays empty
assert.equal(at(['-','-','A'],100),'-');assert.equal(at(['A','A','N'],100),'A');assert.equal(at(['N','N'],100),'N');
{const r=make(['A']);r.coverage[0]=0;assert.equal(buildConsensus(r.counts,r.coverage,100)[0],0);}
// All four
assert.equal(at(['A','C','G','T'],100),'N');assert.equal(at(['A','A','C','G','T'],100),'N');
// computeStats takes the same threshold
{const pool=new TextEncoder().encode('AAAA'+'AATA'+'AAAT'+'AATC'),meta=new Int32Array(4*STRIDE),cig=new Uint32Array(4).fill(4<<4|OP.EQ);for(let i=0;i<4;i++){const b=i*STRIDE;meta[b+REF]=0;meta[b+QS]=0;meta[b+QE]=4;meta[b+COFF]=i;meta[b+CN]=1;}const S={pool,offs:Uint32Array.of(0,4,8,12,16),meta,cig},order=Uint32Array.of(0,1,2,3);assert.equal(text(computeStats(S,order,4,100).consensus),'AAWH');assert.equal(text(computeStats(S,order,4).consensus),'AAWA');}
// Comparing a base with a code
const c=s=>s.charCodeAt(0);assert(coversBase(c('W'),c('A')));assert(!coversBase(c('W'),c('C')));assert(coversBase(c('N'),c('R')));assert(!coversBase(c('R'),c('N')));assert(!coversBase(45,c('A')));assert(!coversBase(0,c('A')));
console.log('PASS: Sequence Mapper consensus threshold, ties, deletions and base-in-code comparison.');
