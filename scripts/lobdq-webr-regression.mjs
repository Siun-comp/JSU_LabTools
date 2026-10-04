/* Actual webR test, separate from pure contract tests. No host package installation.
 * Official fixed npm tarball is downloaded into an isolated temporary directory.
 * Failures are failures: there is no skipped/pass fallback. Supported CI: Linux Node24.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url)),require=createRequire(import.meta.url),dir=path.join(root,'tools/detection-capability');
const plan=JSON.parse(await fs.readFile(path.join(root,'tests/detection-capability/ANALYTIC_FIXTURES.json'),'utf8'));
const archiveURL='https://registry.npmjs.org/webr/-/webr-0.6.0.tgz',integrity='M2b8m3/ZBk7XMIR7LD97s5k/9jUla83Z0Hl4b+WnrK7XmSMpZdajCiP3XkSzHKHDUgscHKe+lVUvk3aym8q0bw==';
if(process.platform==='win32')throw Error('Actual Node webR regression requires Linux CI. Browser verification is a separate check. No skipped pass.');
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'jsu-webr-regression-')),archive=path.join(temp,'webr.tgz');
const response=await fetch(archiveURL,{signal:AbortSignal.timeout(60000)});assert(response.ok,'Official fixed webR download');
const bytes=Buffer.from(await response.arrayBuffer());assert.equal(createHash('sha512').update(bytes).digest('base64'),integrity,'Pinned official npm integrity');await fs.writeFile(archive,bytes);
const list=spawnSync('tar',['-tf',archive],{encoding:'utf8'});assert.equal(list.status,0);assert(list.stdout.trim().split(/\r?\n/).every(p=>p.startsWith('package/')&&!p.split('/').includes('..')),'Archive path boundary');
const extract=spawnSync('tar',['-xf',archive,'-C',temp]);assert.equal(extract.status,0);
const base=path.join(temp,'package/dist/'),mod=await import(pathToFileURL(path.join(base,'webr.mjs')).href),instances=[];
const Runtime=class extends mod.WebR{constructor(options){super({...options,baseUrl:base});instances.push(this);}};
require(path.join(dir,'app-release.js'));require(path.join(dir,'lod-browser-source.js'));require(path.join(dir,'continuous-browser-source.js'));
const source=globalThis.LoDBrowserSource,continuousSources=globalThis.ContinuousBrowserSources;
const lod=require(path.join(dir,'lod-browser.js')).create({source,ciContract:require(path.join(dir,'lod-ci-contract.js')),curveContract:require(path.join(dir,'lod-curve-contract.js')),gofContract:require(path.join(dir,'lod-gof-contract.js')),loadRuntime:async()=>({...mod,WebR:Runtime})});
const runtime=require(path.join(dir,'browser-r-runtime.js')).create({loadRuntime:async()=>({...mod,WebR:Runtime})});
const continuous=require(path.join(dir,'continuous-browser.js')).create({runtime,sources:continuousSources,contracts:{confirmation:require(path.join(dir,'confirmation-contract.js')),loq:require(path.join(dir,'loq-contract.js'))}});
let checks=0;const close=(actual,expected,tolerance=plan.tolerances.analyticScalarRelativeToMax1)=>{assert(Number.isFinite(actual));assert(Math.abs(actual-expected)<=tolerance*Math.max(1,Math.abs(expected)),`${actual} versus ${expected}`);checks++;};
const results=[];
try{
 for(const test of [...plan.lod,plan.lod95]){
  const e=await lod.run(test.query);assert.equal(e.status,test.expected.status||'candidate');checks++;assert.equal(e.reportableLoD,null);assert.equal(e.fitAssessment,'review_required');
  if(e.status==='candidate'){
   if(test.expected.modelDoseCandidate!==undefined)close(e.modelDoseCandidate,test.expected.modelDoseCandidate);assert.equal(e.ci.status,test.expected.ciStatus||'calculated');
   if(test.expected.reasons)assert.deepEqual(e.ci.reasons,test.expected.reasons);
   if(e.ci.status==='calculated')for(const key of ['lower','upper','logEstimate','logSE','logLower','logUpper'])close(e.ci[key],test.expected.ci[key]);
   if(test.expected.coefficients)test.expected.coefficients.forEach((b,i)=>close(e.coefficients[i],b));
   if(test.expected.fittedProbability)test.expected.fittedProbability.forEach((p,i)=>close(e.fittedProbability[i],p,plan.tolerances.analyticProbabilityAbsolute));
   if(e.residualDF===0){assert.equal(e.gof.status,'held');assert.equal(e.gof.pearsonP,null);}else{assert.equal(e.gof.status,'calculated');close(e.gof.pearsonPerDF,e.pearson/e.residualDF,1e-12);assert(e.gof.pearsonP>=0&&e.gof.pearsonP<=1);assert(e.gof.devianceP>=0&&e.gof.devianceP<=1);}
  }
  results.push({name:test.name,execution:e});
 }
 // Independently closed-form chi-square survival anchors for df=2 and df=4.
 const r=instances[0];for(const x of [0,2,10,100])for(const df of [2,4])close(await r.evalRNumber(`stats::pchisq(${x},${df},lower.tail=FALSE)`),Math.exp(-x/2)*(df===4?1+x/2:1),2e-14);
 const cp=await continuous.run('confirmation',plan.cpQuery);
 for(let i=0;i<plan.cp.length;i++){
  const t=plan.cp[i],row=cp.rows[i];assert.equal(row.n,t.n);assert.equal(row.positive,t.k);
  if(t.closedLower!==null)close(row.ci.lower,Number(t.closedLower),plan.tolerances.cpClosedAbsolute);
  if(t.closedUpper!==null)close(row.ci.upper,Number(t.closedUpper),plan.tolerances.cpClosedAbsolute);
  const sum=(p,lo,hi)=>{let out=0;for(let j=lo;j<=hi;j++){let comb=1;for(let a=1;a<=j;a++)comb*= (t.n-a+1)/a;out+=comb*p**j*(1-p)**(t.n-j);}return out;};
  if(t.k>0&&t.k<t.n){close(sum(row.ci.lower,t.k,t.n),.025,plan.tolerances.cpTailAbsolute);close(sum(row.ci.upper,0,t.k),.025,plan.tolerances.cpTailAbsolute);}
 }
 // Independent, exact sample arithmetic; support boundaries still apply.
 const samples=[10,20,30,40].map((v,i)=>({sampleName:'S'+i,referenceValue:v,referenceSource:'Independent synthetic arithmetic',values:[v-1,v,v+1,v-1,v,v+1,v-1,v,v+1]}));
 const q={unit:'ng/mL',limitFraction:.25,samples},l=await continuous.run('loq',q);
 l.samples.forEach((s,i)=>{close(s.mean,samples[i].referenceValue,1e-12);close(s.sd,Math.sqrt(6/8),1e-12);close(s.te,2*Math.sqrt(6/8),1e-12);assert.equal(s.bias,0);});assert.equal(l.groupLoQCandidate,10);checks++;
 // Nonzero lack-of-fit statistics: df=2 upper tail has an independent exp(-x/2) form.
 const mixedQuery={c:[1,2,4,8],k:[1,12,8,19],n:[20,20,20,20],target:.95},mixed=await lod.run(mixedQuery);
 assert.equal(mixed.status,'candidate');assert.equal(mixed.residualDF,2);assert(mixed.pearson>1&&mixed.deviance>1);
 close(mixed.gof.pearsonP,Math.exp(-mixed.pearson/2),2e-13);close(mixed.gof.devianceP,Math.exp(-mixed.deviance/2),2e-13);assert.equal(mixed.ci.method.dispersion,1);assert.equal(mixed.fitAssessment,'review_required');results.push({name:'nonzero-GOF-df2',execution:mixed});
 console.log(JSON.stringify({status:'PASS',checks,lodCases:13,cpRows:21,loqSamples:4,runtime:'Actual webR under Linux Node PostMessage; browser verification is a separate check',webR:r.version,r:await r.evalRString('as.character(getRversion())'),stats:await r.evalRString('as.character(packageVersion("stats"))'),mass:await r.evalRString('as.character(packageVersion("MASS"))'),sourceSHA256:source.sha256,archiveURL,integrity}));
 if(process.env.JSU_LOBDQ_TEST_OUTPUT)await fs.writeFile(process.env.JSU_LOBDQ_TEST_OUTPUT,JSON.stringify({results,cp,loq:l,checks},null,2));
}finally{for(const r of instances)r.close();}
