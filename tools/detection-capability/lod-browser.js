/* D-031: existing R source, browser transport only. No alternative estimator. */
'use strict';
(function(root){
 function validate(q){
  return !!q&&typeof q==='object'&&!Array.isArray(q)&&Object.keys(q).every(k=>['c','k','n','target'].includes(k))&&['c','k','n'].every(k=>Array.isArray(q[k]))&&q.c.length>=2&&q.c.length<=1000&&q.k.length===q.c.length&&q.n.length===q.c.length&&Number.isFinite(q.target)&&q.target>0&&q.target<1&&new Set(q.c).size===q.c.length&&Array.from(q.c).every((c,i)=>Number.isFinite(c)&&c>0&&Number.isSafeInteger(q.n[i])&&q.n[i]>0&&q.n[i]<=1e9&&Number.isSafeInteger(q.k[i])&&q.k[i]>=0&&q.k[i]<=q.n[i]);
 }
 function decode(output,q,env,source,ciContract,curveContract,stderr){
  const f={};if(typeof output!=='string'||output.length>500000)throw Error('invalid_response');
  for(const line of output.trim().split(/\r?\n/)){const parts=line.split('\t');if(parts.length!==2||Object.hasOwn(f,parts[0]))throw Error('invalid_response');f[parts[0]]=parts[1];}
  const status=f.status;if(!['candidate','input_blocked','all_one_outcome','separation','nonconvergence','rank_or_coefficient','nonpositive_slope','numeric_range','execution_failed'].includes(status))throw Error('invalid_response');
  const e={version:'lod-point-2',status,modelDoseCandidate:null,reportableLoD:null,ci:ciContract.empty(),curve:null,fitAssessment:'review_required',diagnostics:[],method:{id:'binomial-probit-log10',source:'CLSI EP17-A2 (2012) §5.5.3.2; Appendix C',wrapperVersion:'1.2.0',link:'probit',scale:'log10',epsilon:1e-12,maxit:200,target:q.target,...env,sourceSHA256:source.sha256,applicationVersion:env.applicationVersion||root.AppRelease?.version||'unavailable'}};
  const scalar=k=>{if(!f[k]?.trim()||!Number.isFinite(Number(f[k])))throw Error('invalid_response');return Number(f[k]);};
  const vector=(k,n)=>{const v=f[k]?.split(',');if(v?.length!==n||v.some(x=>!x.trim()||!Number.isFinite(Number(x))))throw Error('invalid_response');return v.map(Number);};
  if(status==='candidate'){
   e.modelDoseCandidate=scalar('candidate');if(!(e.modelDoseCandidate>0)||f.rVersion!==env.rVersion||f.statsVersion!==env.statsVersion)throw Error('invalid_response');
   e.coefficients=vector('coefficients',2);for(const k of ['fittedProbability','expectedPositive','expectedNegative'])e[k]=vector(k,q.c.length);
   for(const k of ['deviance','pearson','residualDF','rank','iterations'])e[k]=scalar(k);e.converged=true;
   if(f.curveStatus==='available'){e.curve={version:'probit-curve-1',method:'stats::predict.glm(type=response,se.fit=FALSE)',grid:'log10-even-201',logConcentration:vector('curveLogConcentration',201),probability:vector('curveProbability',201)};if(!curveContract.valid(e.curve,q.c))throw Error('invalid_response');}else e.diagnostics.push('CURVE_UNAVAILABLE');
   if(scalar('warning'))e.diagnostics.push('R_WARNING');if(scalar('extrapolated'))e.diagnostics.push('EXTRAPOLATED');if(e.residualDF<=0)e.diagnostics.push('NO_RESIDUAL_DF');if(stderr)e.diagnostics.push('R_STDERR');
  }else e.diagnostics.push(status);
  e.ci=ciContract.fromFields(f,e,q.c,stderr);if(!ciContract.valid(e.ci,e,q.c)||e.ci.method.massVersion&&e.ci.method.massVersion!==env.massVersion)throw Error('invalid_response');return e;
 }
 function create(options={}){
  const source=options.source||root.LoDBrowserSource,ci=options.ciContract||root.LoDCIContract,curve=options.curveContract||root.LoDCurveContract;
  const runtime=options.runtime||(typeof module==='object'&&module.exports?require('./browser-r-runtime.js'):root.BrowserRRuntime).create({loadRuntime:options.loadRuntime});
  const task={validate,source,needsMASS:true,label:'LoD 모형·CI',encode:q=>q.target+'\n'+q.c.map((c,i)=>[c,q.k[i],q.n[i]].join('\t')).join('\n')+'\n',decode:(output,q,env,stderr)=>decode(output,q,env,source,ci,curve,stderr)};
  return {run:(q,options)=>runtime.run(task,q,options),state:runtime.state};
 }
 const api={create,validate,decode};if(typeof module==='object'&&module.exports)module.exports=api;else root.BrowserLoD={...api,...create({runtime:root.BrowserRRuntime.shared})};
})(globalThis);
