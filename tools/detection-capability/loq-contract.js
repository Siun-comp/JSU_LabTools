/* EP17 §6.5 one-group result contract; no pooling or experimental method. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.LoQContract=factory();})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 const method={id:'ep17-westgard-te-raw',wrapperVersion:'1.0.0',source:'CLSI EP17-A2 (2012), §6.2–6.5 식(13)/(15), Appendix D2 식(D4)',scale:'raw',sdDenominator:'n-1',teMultiplier:2};
 const object=x=>x&&typeof x==='object'&&!Array.isArray(x),str=(x,max)=>typeof x==='string'&&x.length<=max;
 function validate(q){
  if(!object(q)||Object.keys(q).some(k=>!['unit','limitFraction','samples'].includes(k)))return ['LOQ_INPUT'];
  if(!str(q.unit,80)||!q.unit.trim())return ['LOQ_UNIT'];
  if(/^(ct|cq|cp|tt)(?:$|\b|\s|\()/i.test(q.unit.trim())||/rfu|log\s*10|log₁₀/i.test(q.unit))return ['LOQ_SCALE'];
  if(q.limitFraction!==null&&!(Number.isFinite(q.limitFraction)&&Number.isFinite(q.limitFraction*100)&&q.limitFraction>0))return ['LOQ_LIMIT'];
  if(!Array.isArray(q.samples)||q.samples.length<1||q.samples.length>8)return ['LOQ_SAMPLES'];
  const seen=new Set();
  for(const s of Array.from(q.samples)){
   if(!object(s)||Object.keys(s).some(k=>!['sampleName','referenceValue','referenceSource','values'].includes(k)))return ['LOQ_INPUT'];
   if(!str(s.sampleName,256)||!s.sampleName.trim()||seen.has(s.sampleName.trim()))return ['LOQ_NAME'];seen.add(s.sampleName.trim());
   if(!Number.isFinite(s.referenceValue)||s.referenceValue<=0||!str(s.referenceSource,2000))return ['LOQ_REFERENCE'];
   if(!Array.isArray(s.values)||s.values.length<2||s.values.length>1000)return ['LOQ_COUNT'];
   if(!Array.from(s.values).every(Number.isFinite))return ['LOQ_VALUES'];
  }return [];
 }
 function assemble(q,stats,versions){
  if(validate(q).length||!Array.isArray(stats)||stats.length!==q.samples.length||!str(versions?.rVersion,40)||!versions.rVersion||!str(versions.statsVersion,40)||!versions.statsVersion)throw Error('invalid_response');
  const samples=q.samples.map((s,i)=>{const m=stats[i];if(!m||!['mean','sd','bias','te','teFraction'].every(k=>Number.isFinite(m[k]))||m.n!==s.values.length||m.sd<0||m.te<0||m.teFraction<0)throw Error('invalid_response');
   // Transport consistency, not an alternative statistics implementation or criterion tolerance.
   const close=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=1e-12*Math.max(1,Math.abs(a),Math.abs(b));
   if(!Number.isFinite(m.teFraction*100))throw Error('invalid_response');
   if(!close(m.bias,m.mean-s.referenceValue)||!close(m.te,Math.abs(m.bias)+2*m.sd)||!close(m.teFraction,m.te/s.referenceValue))throw Error('invalid_response');
   return {sampleName:s.sampleName,referenceValue:s.referenceValue,referenceSource:s.referenceSource,...Object.fromEntries(['n','mean','sd','bias','te','teFraction'].map(k=>[k,m[k]])),criterionStatus:q.limitFraction===null?'not_set':m.teFraction<=q.limitFraction?'met':'not_met'};
  });
  const reasons=[];
  if(q.limitFraction===null)reasons.push('CRITERION_NOT_SET');
  if(samples.length<4||samples.some(s=>s.n<9))reasons.push('CANDIDATE_COUNT_HELD');
  if(samples.some(s=>!s.referenceSource.trim()))reasons.push('REFERENCE_SOURCE_MISSING');
  if(samples.some(s=>s.mean<=0))reasons.push('NONPOSITIVE_MEAN');
  const met=samples.filter(s=>s.criterionStatus==='met');if(q.limitFraction!==null&&!met.length)reasons.push('NONE_MET');
  const candidate=reasons.length?null:Math.min(...met.map(s=>s.mean));
  return {version:'loq-1',status:'calculated',unit:q.unit,limitFraction:q.limitFraction,samples,groupLoQCandidate:candidate,candidateSamples:candidate===null?[]:met.filter(s=>s.mean===candidate).map(s=>s.sampleName),candidateReasons:reasons,overallLoQ:null,reportableLoQ:null,studyAssessment:'not_evaluated',method:{...method,...versions},warnings:samples.filter(s=>s.sd===0).map(s=>({code:'ZERO_SD',sampleName:s.sampleName}))};
 }
 function validResponse(e,q){try{
  const versions={rVersion:e.method?.rVersion,statsVersion:e.method?.statsVersion};
  const fields=['executionRuntime','webRVersion','channelType','sourceSHA256','applicationVersion'];
  if(fields.some(k=>Object.hasOwn(e.method||{},k))){
   if(e.method.executionRuntime!=='browser-webR'||e.method.webRVersion!=='0.6.0'||e.method.channelType!=='PostMessage'||!str(e.method.sourceSHA256,64)||!/^[a-f0-9]{64}$/.test(e.method.sourceSHA256)||!str(e.method.applicationVersion,80)||!e.method.applicationVersion)return false;
   for(const k of fields)versions[k]=e.method[k];
  }
  return e?.version==='loq-1'&&JSON.stringify(e)===JSON.stringify(assemble(q,e.samples,versions));
 }catch{return false;}}
 return {validate,assemble,validResponse};
});
