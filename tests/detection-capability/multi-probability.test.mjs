import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),tool=path.join(import.meta.dirname,'../../tools/detection-capability');
const Q=require(path.join(tool,'lod-quantile.js')),P=require(path.join(tool,'confirmation-plan.js'));
require(path.join(tool,'lod-quantile-source.js'));require(path.join(tool,'confirmation-plan-source.js'));
const fx=JSON.parse(fs.readFileSync(path.join(import.meta.dirname,'multi-probability-fixture.json'),'utf8'));
const rel=(a,b)=>Math.abs(a-b)/Math.max(1,Math.abs(a),Math.abs(b));
const close=(a,b,label,tol=1e-12)=>assert(Number.isFinite(a)&&Number.isFinite(b)&&rel(a,b)<=tol,`${label}: ${a} != ${b}`);
const Z={0.5:0,0.9:1.2815515655446004,0.95:1.6448536269514722,0.99:2.3263478740408408};
let groups=0;const test=(name,fn)=>{fn();groups++;};
test('R table equals 10^((z−b0)/b1) from the LoD program coefficients (independent of dose.p)',()=>{
 assert.equal(fx.lod.length,4);
 for(const c of fx.lod){const [b0,b1]=c.lod.coefficients;assert.equal(c.table.status,'calculated');assert.equal(c.consistent,true,c.name);
  for(const r of c.table.rows)close(r.estimate,10**((Z[r.probability]-b0)/b1),c.name+' C'+r.probability);
  close(c.table.targetCandidate,c.lod.candidate,c.name+' target');
  const at=c.table.rows.find(r=>Math.abs(r.probability-c.q.target)<1e-12);if(at){close(at.estimate,c.lod.candidate,c.name+' row');if(at.ciStatus==='calculated'&&c.lod.ci.status==='calculated'){close(at.lower,c.lod.ci.lower,c.name+' lower');close(at.upper,c.lod.ci.upper,c.name+' upper');}}}});
test('CI is held outside the tested range and when the LoD program would hold it',()=>{
 const by=Object.fromEntries(fx.lod.map(c=>[c.name,c]));
 for(const c of fx.lod)for(const r of c.table.rows){const outside=r.estimate<Math.min(...c.q.c)||r.estimate>Math.max(...c.q.c);assert.equal(r.extrapolated,outside,c.name);if(outside||c.table.tableHeld.length){assert.equal(r.ciStatus,'held');assert.equal(r.lower,null);}else{assert.equal(r.ciStatus,'calculated');assert(r.lower<r.estimate&&r.estimate<r.upper);}}
 assert.deepEqual(by['no-residual-df'].table.tableHeld,['NO_RESIDUAL_DF']);assert.equal(by['c99-outside'].table.rows[3].ciStatus,'held');});
const env={rVersion:'4.6.0',statsVersion:'4.6.0',massVersion:'7.3.66',webRVersion:'0.6.0',sourceSHA256:'x'};
function output(t,overrides={}){const rows=t.rows,v=k=>rows.map(r=>r[k]);const f={status:'calculated',probability:[.5,.9,.95,.99].join(','),logEstimate:v('logEstimate').join(','),estimate:v('estimate').join(','),logSE:v('logSE').join(','),
 logLower:rows.map(r=>r.logLower??r.logEstimate-1.959963984540054*r.logSE).join(','),logUpper:rows.map(r=>r.logUpper??r.logEstimate+1.959963984540054*r.logSE).join(','),lower:rows.map(r=>r.lower??10**(r.logEstimate-1.959963984540054*r.logSE)).join(','),upper:rows.map(r=>r.upper??10**(r.logEstimate+1.959963984540054*r.logSE)).join(','),
 outsideRange:rows.map(r=>r.extrapolated?1:0).join(','),tableHeld:t.tableHeld.length?t.tableHeld.join(','):'none',targetCandidate:t.targetCandidate,massVersion:'7.3.66',rVersion:'4.6.0',statsVersion:'4.6.0',...overrides};return Object.entries(f).map(([k,x])=>k+'\t'+x).join('\n');}
test('decode: round trip, statuses, and rejected responses',()=>{
 const c=fx.lod[0],d=Q.decode(output(c.table),c.q,env,false);assert.equal(d.version,'lod-quantile-1');d.rows.forEach((r,i)=>close(r.estimate,c.table.rows[i].estimate,'decode'));
 assert(Q.decode(output(c.table),c.q,env,true).rows.every(r=>r.ciStatus==='held'&&r.ciReasons.includes('R_STDERR')),'stderr holds CI');
 assert.equal(Q.decode('status\tseparation',c.q,env,false).status,'separation');
 for(const bad of [{probability:'0.5,0.9,0.95,0.98'},{estimate:'1,2,3'},{massVersion:'7.3.65'},{tableHeld:'OTHER'},{estimate:[...c.table.rows].reverse().map(r=>r.estimate).join(',')}])assert.throws(()=>Q.decode(output(c.table,bad),c.q,env,false));
 assert.throws(()=>Q.decode('status\tcalculated\nstatus\tcalculated',c.q,env,false));});
test('consistency check blocks a table that disagrees with the LoD result',()=>{
 const c=fx.lod[0],t=Q.decode(output(c.table),c.q,env,false),lod={status:'candidate',modelDoseCandidate:c.lod.candidate,method:{target:c.q.target},ci:c.lod.ci};
 assert.equal(Q.consistent(t,lod),true);assert.equal(Q.consistent(t,{...lod,modelDoseCandidate:c.lod.candidate*1.001}),false);assert.equal(Q.consistent(t,{...lod,ci:{...lod.ci,lower:lod.ci.lower*1.01}}),false);assert.equal(Q.consistent({...t,status:'separation'},lod),false);});
// Binomial closed forms, independent of R.
const choose=(n,k)=>{let r=1;for(let i=1;i<=k;i++)r=r*(n-k+i)/i;return r;};
const atLeast=(n,k,p)=>{let s=0;for(let j=Math.max(k,0);j<=n;j++)s+=choose(n,j)*p**j*(1-p)**(n-j);return s;};
const betaCdfA2=(x,a)=>x**a*((a+1)-a*x); // regularized incomplete beta I_x(a,2)
const cpLowerMinus1=n=>{let lo=0,hi=1;for(let i=0;i<200;i++){const m=(lo+hi)/2;if(betaCdfA2(m,n-1)<0.025)lo=m;else hi=m;}return (lo+hi)/2;};
test('plan table equals binomial sums and Clopper–Pearson closed forms',()=>{
 assert.equal(fx.plan.p,0.95);assert.deepEqual(fx.plan.rows.map(r=>r.n),[1,2,20,24,30,60]);
 for(const row of fx.plan.rows){close(row.expected,row.n*0.95,'expected');
  row.cells.forEach((c,m)=>{const k=row.n-m;if(k<0){assert.equal(c,null);return;}close(c.atLeast,atLeast(row.n,k,0.95),`P(X>=${k}|n=${row.n})`,1e-11);
   if(k===0)assert.equal(c.cpLower,0);else if(m===0)close(c.cpLower,0.025**(1/row.n),`CP n/n ${row.n}`,1e-12);else if(m===1&&row.n>=2)close(c.cpLower,cpLowerMinus1(row.n),`CP (n-1)/n ${row.n}`,1e-9);});}});
test('plan input validation and decode rejection',()=>{
 for(const bad of [{p:1,n:[20]},{p:0.95,n:[]},{p:0.95,n:[20,20]},{p:0.95,n:[0]},{p:0.95,n:[1.5]},{p:0.95,n:Array.from({length:13},(_,i)=>i+1)}])assert.equal(P.validate(bad),false);
 assert.equal(P.validate({p:0.95,n:[20,24]}),true);
 const q={p:0.95,n:[20]},env2={rVersion:'4.6.0',statsVersion:'4.6.0'},good=['status\tcalculated','n\t20,20,20,20','miss\t0,1,2,3','valid\t1,1,1,1','atLeast\t0.3,0.7,0.9,0.98','cpLower\t0.8,0.7,0.6,0.5','expected\t19','rVersion\t4.6.0','statsVersion\t4.6.0'];
 assert.equal(P.decode(good.join('\n'),q,env2,false).rows[0].cells[1].detections,19);
 assert.throws(()=>P.decode(good.join('\n'),q,env2,true));assert.throws(()=>P.decode(good.map(l=>l.startsWith('atLeast')?'atLeast\t1.2,0.7,0.9,0.98':l).join('\n'),q,env2,false));assert.throws(()=>P.decode(good.map(l=>l.startsWith('miss')?'miss\t0,2,1,3':l).join('\n'),q,env2,false));});
test('wrapped R programs keep their recorded SHA-256',()=>{const {createHash}=require('node:crypto');for(const s of [globalThis.LoDQuantileSource,globalThis.ConfirmationPlanSource])assert.equal(createHash('sha256').update(s.program).digest('hex'),s.sha256);assert.equal(globalThis.ConfirmationPlanSource.sha256,fx.environment.planSHA);});
console.log(`PASS: LoD detection-probability table and confirmation plan, ${groups} groups / 4 R LoD cases, binomial and Clopper–Pearson closed forms.`);
