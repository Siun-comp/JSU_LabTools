/* D-027 response/display contract. No estimator or alternative solver. */
'use strict';
(function(root){
 const fields=['logEstimate','logSE','logLower','logUpper','lower','upper'];
 const reasonLabels={POINT_UNAVAILABLE:'모형 후보값 미제공',NO_RESIDUAL_DF:'잔차 자유도 없음',FIT_WARNING:'모형 계산 경고',R_STDERR:'실행 환경 메시지',POINT_EXTRAPOLATED:'시험 범위 밖 모형 후보값',CI_LIBRARY_UNAVAILABLE:'MASS 라이브러리 사용 불가',CI_EXECUTION_FAILED:'CI 계산 오류/경고',CI_NUMERIC_RANGE:'CI 수치 범위 또는 구간 순서 오류'};
 const warning='CI_EXTENDS_BEYOND_TEST_RANGE';
 function empty(status='not_available',reasons=['POINT_UNAVAILABLE']){return {version:'lod-ci-1',status,reasons,warnings:[],confidence:0.95,sidedness:'two-sided',scale:'log10',approximationAssessment:'review_required',...Object.fromEntries(fields.map(k=>[k,null])),method:{id:'lod-log10-delta-wald-95',version:'1.0.0',source:'MASS::dose.p SE + normal/Wald approximation on log10 dose',dispersion:1,covariance:'MASS::dose.p -> stats::vcov.glm',massVersion:null}};}
 const close=(a,b)=>Math.abs(a-b)<=1e-10*Math.max(1,Math.abs(a),Math.abs(b));
 function valid(ci,e,concentrations){if(!ci||ci.version!=='lod-ci-1'||ci.confidence!==0.95||ci.sidedness!=='two-sided'||ci.scale!=='log10'||ci.approximationAssessment!=='review_required'||ci.method?.id!=='lod-log10-delta-wald-95'||ci.method.version!=='1.0.0'||ci.method.dispersion!==1||ci.method.covariance!=='MASS::dose.p -> stats::vcov.glm'||typeof ci.method.source!=='string'||!(ci.method.massVersion===null||typeof ci.method.massVersion==='string')||!Array.isArray(ci.reasons)||!Array.isArray(ci.warnings)||new Set(ci.reasons).size!==ci.reasons.length||new Set(ci.warnings).size!==ci.warnings.length||ci.warnings.some(w=>w!==warning))return false;
  const held=[];if(e.status==='candidate'){if(e.residualDF<=0)held.push('NO_RESIDUAL_DF');if(e.diagnostics.includes('R_WARNING'))held.push('FIT_WARNING');if(e.diagnostics.includes('R_STDERR'))held.push('R_STDERR');if(e.diagnostics.includes('EXTRAPOLATED'))held.push('POINT_EXTRAPOLATED');}
  if(e.status!=='candidate')return ci.status==='not_available'&&ci.reasons.length===1&&ci.reasons[0]==='POINT_UNAVAILABLE'&&ci.warnings.length===0&&fields.every(k=>ci[k]===null);
  if(held.length)return ci.status==='held'&&ci.reasons.length===held.length&&held.every(r=>ci.reasons.includes(r))&&ci.warnings.length===0&&fields.every(k=>ci[k]===null);
  if(ci.status==='failed')return ci.reasons.length===1&&['CI_LIBRARY_UNAVAILABLE','CI_EXECUTION_FAILED','CI_NUMERIC_RANGE'].includes(ci.reasons[0])&&ci.warnings.length===0&&fields.every(k=>ci[k]===null);
  if(ci.status!=='calculated'||ci.reasons.length||!fields.every(k=>Number.isFinite(ci[k]))||!ci.method.massVersion||ci.logSE<=0||!(ci.lower>0&&ci.lower<e.modelDoseCandidate&&e.modelDoseCandidate<ci.upper)||!(ci.logLower<ci.logEstimate&&ci.logEstimate<ci.logUpper))return false;
  const z=1.959963984540054; // Validation only; endpoints are computed by R qnorm.
  if(!close(Math.log10(e.modelDoseCandidate),ci.logEstimate)||!close(Math.log10(ci.lower),ci.logLower)||!close(Math.log10(ci.upper),ci.logUpper)||!close(ci.logLower,ci.logEstimate-z*ci.logSE)||!close(ci.logUpper,ci.logEstimate+z*ci.logSE))return false;
  const outside=ci.lower<Math.min(...concentrations)||ci.upper>Math.max(...concentrations);return outside?ci.warnings.length===1&&ci.warnings[0]===warning:ci.warnings.length===0;
 }
 function fromFields(f,e,c,stderr){if(e.status!=='candidate')return empty();const reasons=[];if(e.residualDF<=0)reasons.push('NO_RESIDUAL_DF');if(e.diagnostics.includes('R_WARNING'))reasons.push('FIT_WARNING');if(stderr)reasons.push('R_STDERR');if(e.diagnostics.includes('EXTRAPOLATED'))reasons.push('POINT_EXTRAPOLATED');if(reasons.length)return empty('held',reasons);
  if(!['calculated','failed'].includes(f.ciStatus))throw Error('invalid_response');const ci=empty(f.ciStatus,f.ciReasons?f.ciReasons.split(','):[]);ci.method.massVersion=f.massVersion||null;
  if(ci.status==='calculated'){const vs=f.ciValues?.split(',');if(vs?.length!==6||vs.some(v=>!v.trim()||!Number.isFinite(Number(v))))throw Error('invalid_response');fields.forEach((k,i)=>ci[k]=Number(vs[i]));if(ci.lower<Math.min(...c)||ci.upper>Math.max(...c))ci.warnings.push(warning);}return ci;
 }
 const describe=ci=>ci.status==='calculated'?`양측95% 근사 CI (log10 delta/Wald): ${Number(ci.lower.toPrecision(6))}–${Number(ci.upper.toPrecision(6))}`:`CI ${ci.status==='failed'?'계산 실패':'보류'}: ${ci.reasons.map(r=>reasonLabels[r]).join(' / ')}`;
 const api={fields,empty,valid,fromFields,describe,reasonLabels};if(typeof module==='object'&&module.exports)module.exports=api;else root.LoDCIContract=api;
})(globalThis);
