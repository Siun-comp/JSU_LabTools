/* Detection-probability table (C50/C90/C95/C99) over the shared browser R transport.
 * The R program refits the same probit/log10 model as the LoD program (same input, same glm call)
 * and uses MASS::dose.p with the same log10 Wald 95% CI. The table is shown only when its value at
 * the LoD target (and the LoD CI) equals the LoD program's result. No automatic LoD choice. */
'use strict';
(function(root){
 const PROBABILITIES=[0.5,0.9,0.95,0.99];
 const STATUSES=['calculated','input_blocked','all_one_outcome','separation','nonconvergence','rank_or_coefficient','nonpositive_slope','numeric_range','library_unavailable','execution_warning','execution_failed'];
 const close=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=1e-9*Math.max(1,Math.abs(a),Math.abs(b));
 function decode(output,q,env,stderr){
  const f={};if(typeof output!=='string'||output.length>100000)throw Error('invalid_response');
  for(const line of output.trim().split(/\r?\n/)){const parts=line.split('\t');if(parts.length!==2||Object.hasOwn(f,parts[0]))throw Error('invalid_response');f[parts[0]]=parts[1];}
  if(!STATUSES.includes(f.status))throw Error('invalid_response');
  const result={version:'lod-quantile-1',status:f.status,rows:[],tableHeld:[],targetCandidate:null,
   method:{id:'lod-log10-delta-wald-95',source:'MASS::dose.p SE + normal/Wald approximation on log10 dose (same as the LoD CI)',confidence:0.95,probabilities:PROBABILITIES,model:'same probit/log10 glm as the LoD program (refit from the same input)',...env}};
  if(f.status!=='calculated')return result;
  const vector=k=>{const v=f[k]?.split(',');if(v?.length!==4||v.some(x=>!x.trim()||!Number.isFinite(Number(x))))throw Error('invalid_response');return v.map(Number);};
  const p=vector('probability');if(!p.every((v,i)=>close(v,PROBABILITIES[i])))throw Error('invalid_response');
  if(f.rVersion!==env.rVersion||f.statsVersion!==env.statsVersion||f.massVersion!==env.massVersion)throw Error('invalid_response');
  const held=f.tableHeld==='none'?[]:String(f.tableHeld||'').split(',');if(!held.every(c=>['NO_RESIDUAL_DF','FIT_WARNING'].includes(c)))throw Error('invalid_response');
  if(stderr)held.push('R_STDERR');result.tableHeld=held;
  result.targetCandidate=Number(f.targetCandidate);if(!(result.targetCandidate>0))throw Error('invalid_response');
  const [logEstimate,estimate,logSE,logLower,logUpper,lower,upper,outside]=['logEstimate','estimate','logSE','logLower','logUpper','lower','upper','outsideRange'].map(vector);
  result.rows=PROBABILITIES.map((probability,i)=>{const extrapolated=outside[i]===1,reasons=[...held,...(extrapolated?['POINT_EXTRAPOLATED']:[])];
   if(!(estimate[i]>0&&logSE[i]>0&&lower[i]>0&&lower[i]<estimate[i]&&estimate[i]<upper[i]))throw Error('invalid_response');
   return {probability,estimate:estimate[i],logEstimate:logEstimate[i],logSE:logSE[i],extrapolated,ciStatus:reasons.length?'held':'calculated',ciReasons:reasons,
    lower:reasons.length?null:lower[i],upper:reasons.length?null:upper[i],logLower:reasons.length?null:logLower[i],logUpper:reasons.length?null:logUpper[i]};});
  for(let i=1;i<4;i++)if(!(result.rows[i].estimate>result.rows[i-1].estimate))throw Error('invalid_response');
  return result;
 }
 // The table must agree with the LoD program at the LoD target before it is shown.
 function consistent(table,lod){
  if(table?.status!=='calculated'||lod?.status!=='candidate')return false;
  if(!close(table.targetCandidate,lod.modelDoseCandidate))return false;
  const row=table.rows.find(r=>close(r.probability,lod.method.target));
  if(row&&!close(row.estimate,lod.modelDoseCandidate))return false;
  if(row&&row.ciStatus==='calculated'&&lod.ci?.status==='calculated'&&!(close(row.lower,lod.ci.lower)&&close(row.upper,lod.ci.upper)))return false;
  return true;
 }
 const REASONS={NO_RESIDUAL_DF:'잔차 자유도 없음',FIT_WARNING:'모형 계산 경고',R_STDERR:'실행 환경 메시지',POINT_EXTRAPOLATED:'시험 농도 범위 밖(외삽)'};
 function create(options={}){
  const source=options.source||root.LoDQuantileSource,runtime=options.runtime||root.BrowserRRuntime.shared,validate=options.validate||root.BrowserLoD.validate;
  const task={validate,source,needsMASS:true,label:'검출 확률별 농도',encode:q=>q.target+'\n'+q.c.map((c,i)=>[c,q.k[i],q.n[i]].join('\t')).join('\n')+'\n',decode};
  return {run:(q,settings)=>runtime.run(task,q,settings)};
 }
 const api={PROBABILITIES,REASONS,decode,consistent,create};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.LoDQuantile={...api,...create()};
})(globalThis);
