/* Existing confirmation-1 assembly/validation, no alternate CI estimator. */
'use strict';
(function(root){
 const method={id:'observed-rate-clopper-pearson',wrapperVersion:'1.0.0',confidence:.95,sidedness:'two_sided',source:'Clopper & Pearson (1934); R stats::binom.test CI branch via stats::qbeta'};
 function validate(q){
  if(!q||typeof q!=='object'||Array.isArray(q)||Object.keys(q).some(k=>!['c','k','n','criterion'].includes(k)))return false;
  if(!['c','k','n'].every(k=>Array.isArray(q[k]))||q.c.length<1||q.c.length>1000||q.n.length!==q.c.length||q.k.length!==q.c.length)return false;
  if(q.criterion!==null&&!(Number.isFinite(q.criterion)&&q.criterion>=0&&q.criterion<=1))return false;
  return new Set(q.c).size===q.c.length&&Array.from(q.c).every((c,i)=>Number.isFinite(c)&&c>0&&Number.isSafeInteger(q.n[i])&&q.n[i]>0&&q.n[i]<=1e9&&Number.isSafeInteger(q.k[i])&&q.k[i]>=0&&q.k[i]<=q.n[i]);
 }
 function assemble(q,lower,upper,versions){
  if(!validate(q)||!Array.isArray(lower)||!Array.isArray(upper)||lower.length!==q.c.length||upper.length!==q.c.length||!versions?.rVersion||!versions.statsVersion||!lower.every((v,i)=>Number.isFinite(v)&&Number.isFinite(upper[i])&&v>=0&&upper[i]<=1&&v<=q.k[i]/q.n[i]&&upper[i]>=q.k[i]/q.n[i]))throw Error('invalid_response');
  return {version:'confirmation-1',status:'calculated',criterion:q.criterion,studyAssessment:'not_evaluated',reportableLoD:null,method:{...method,...versions},rows:q.c.map((c,i)=>({concentration:c,n:q.n[i],positive:q.k[i],negative:q.n[i]-q.k[i],observedRate:q.k[i]/q.n[i],ci:{lower:lower[i],upper:upper[i]},criterionStatus:q.criterion===null?'not_set':q.k[i]/q.n[i]>=q.criterion?'met':'not_met'}))};
 }
 function validResponse(e,q){return e?.version==='confirmation-1'&&e.status==='calculated'&&e.criterion===q.criterion&&e.studyAssessment==='not_evaluated'&&e.reportableLoD===null&&e.method?.id===method.id&&e.method.wrapperVersion===method.wrapperVersion&&e.method.source===method.source&&typeof e.method.rVersion==='string'&&!!e.method.rVersion&&typeof e.method.statsVersion==='string'&&!!e.method.statsVersion&&e.method.confidence===.95&&e.method.sidedness==='two_sided'&&Array.isArray(e.rows)&&e.rows.length===q.c.length&&e.rows.every((r,i)=>r.concentration===q.c[i]&&r.n===q.n[i]&&r.positive===q.k[i]&&r.negative===q.n[i]-q.k[i]&&r.observedRate===q.k[i]/q.n[i]&&Number.isFinite(r.ci?.lower)&&Number.isFinite(r.ci?.upper)&&r.ci.lower>=0&&r.ci.upper<=1&&r.ci.lower<=r.observedRate&&r.ci.upper>=r.observedRate&&r.criterionStatus===(q.criterion===null?'not_set':r.observedRate>=q.criterion?'met':'not_met'));}
 const api={validate,assemble,validResponse};if(typeof module==='object'&&module.exports)module.exports=api;else root.ConfirmationContract=api;
})(globalThis);
