import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import * as c from '../../tools/oligo-analysis/core.mjs';
// Test-only frozen pre-optimization exhaustive placement algorithm; independent of production range index.
const d=c,helices=c.helices,disjoint=c.disjoint,LIMITS={polyHelices:100000,polyComparisons:20000000};
function brutePoly(records,pools,progress){
 const variants=pools.flatMap((pool,i)=>pool.map(sequence=>({name:records[i].name,sequence,parent:i}))),cache=new Map(),groups=new Map();let comparisons=0,helixCount=0,triples=0;
 const contacts=(i,j)=>{const key=i+'/'+j;if(!cache.has(key)){const h=helices(variants[i].sequence,variants[j].sequence);helixCount+=h.length;if(helixCount>LIMITS.polyHelices)throw Error('Polydimer 구간 탐색 상한에 도달했습니다. Polydimer를 제외하거나 대상을 줄이세요.');cache.set(key,h);}return cache.get(key);};
 for(let i=0;i<variants.length;i++)for(let j=i;j<variants.length;j++)for(let k=j;k<variants.length;k++){
  const ids=[i,j,k],molecules=ids.map(id=>variants[id]),key=molecules.map(v=>v.parent).join('/');let group=groups.get(key);if(!group){group={kind:'poly',first:molecules.map(v=>v.name).join(' × '),second:'',mode:'poly',structures:[],comparisons:0,counts:{strong:0,mixed:0},best:{},variantTriples:0};groups.set(key,group);}group.variantTriples++;
  for(let central=0;central<3;central++){if(ids.slice(0,central).includes(ids[central]))continue;const others=[0,1,2].filter(x=>x!==central),left=contacts(ids[central],ids[others[0]]),right=contacts(ids[central],ids[others[1]]);
   for(let x=0;x<left.length;x++)for(let y=ids[others[0]]===ids[others[1]]?x:0;y<right.length;y++){
    if(++comparisons>LIMITS.polyComparisons)throw Error('Polydimer 동시 배치 탐색 상한에 도달했습니다. 부분 후보는 출력하지 않습니다. Polydimer를 제외하거나 대상을 줄이세요.');group.comparisons++;const a=left[x],b=right[y];if(!disjoint(a,b))continue;
    const category=d.isWarning(a.micros)&&d.isWarning(b.micros)?'strong':'mixed',scoreMicros=a.micros+b.micros;group.counts[category]++;
    if(!group.best[category]||scoreMicros<group.best[category].scoreMicros)group.best[category]={category,scoreMicros,molecules,central,others,edges:[a,b]};
   }
  }triples++;progress?.({kind:'poly',done:triples});
 }
 for(const group of groups.values()){group.structures=Object.values(group.best).sort((a,b)=>a.scoreMicros-b.scoreMicros);delete group.best;group.minimum=group.structures.length?group.structures[0].scoreMicros:null;}
 return {pairs:[...groups.values()],stats:{comparisons,helixCount,triples}};
}
const tests=[],test=(name,f)=>{f();tests.push({name,pass:true});};let seed=7381;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const cases=['A GCGGCG\nB CGC\nC CGC','A GCGCAAAAGCGC\nB GCGC','A GCG\nB CGC','A GCNGC\nB GCGC','A GCGCGCGC\nB GCGCGCGC\nC GCGCGCGC','A AAAAAA\nB TTTTTT\nC AAAAAA','A ATGACCTGATCGTAGCTAGC\nB GCTAGCTACGATCAGGTCAT\nC ATGACCTGATCGTAGCTAGC'];
for(let n=0;n<64;n++){const len=3+Math.floor(random()*10),count=1+Math.floor(random()*4);cases.push(Array.from({length:count},(_,i)=>'S'+i+' '+Array.from({length:len},()=> 'ACGT'[Math.floor(random()*4)]).join('')).join('\n'));}
for(const [i,input] of cases.entries())test('Exact brute-force candidate/count/tie regression '+i,()=>{const rs=c.parseInput(input).records,pools=rs.map(r=>c.expand(r.sequence)),expected=brutePoly(rs,pools),actual=c.polyModule(rs,pools);assert.deepEqual(actual.pairs,expected.pairs);assert.equal(actual.stats.comparisons,expected.stats.comparisons);for(const p of actual.pairs)for(const s of p.structures)assert.ok(c.disjoint(...s.edges));});
test('Time protection deterministic',()=>{let tick=0;const rs=c.parseInput('A GCGC').records;assert.throws(()=>c.polyModule(rs,rs.map(r=>c.expand(r.sequence)),null,{now:()=>++tick,timeMs:2}),/실행 시간/);});
test('Estimated-storage protection deterministic',()=>{const rs=c.parseInput('A GCGC').records;assert.throws(()=>c.polyModule(rs,rs.map(r=>c.expand(r.sequence)),null,{memoryBytes:1}),/추정 보관량/);});
test('Degenerate per-primer expansion guard retained',()=>{assert.ok(c.preflight(c.parseInput('A NNNNNN').records,'idt').blocked);});
test('Polydimer length guard retained',()=>{assert.ok(c.preflight([{name:'A',sequence:'A'.repeat(61)}],'idt').blocked);});

const engineURL=new URL('../../tools/oligo-analysis/dimer.mjs',import.meta.url),moduleURL=new URL('../../tools/oligo-analysis/core.mjs',import.meta.url),code=(await readFile(moduleURL,'utf8')).replace("'./dimer.mjs'",JSON.stringify(engineURL.href)).replace('polyMemoryBytes:134217728','polyMemoryBytes:1'),limited=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
test('Limited Poly preserves completed dimers and exposes no partial candidates',()=>{const r=limited.runAnalysis(c.parseInput('A GCGCGC\nB GCGC').records,'idt');assert.equal(r.modules.self.state,'complete');assert.equal(r.modules.hetero.state,'complete');assert.equal(r.modules.poly.state,'limited');assert.ok(r.pairs.every(p=>p.kind!=='poly'));});
console.log('PASS: '+tests.length+' exhaustive-vs-optimized Poly cases and deterministic resource protection.');
