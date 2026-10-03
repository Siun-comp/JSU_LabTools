/* EP17-A2 §5.3.3.1 (1), Appendix A (A1-A2). One group, raw higher-tail values.
 * Deliberately distinct from historical type-7/normal exploratory estimates. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.LoBAnalysis=factory();})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 const method={id:'ep17-nonparametric-lob',version:'1.0.0',source:'CLSI EP17-A2 (2012), §5.3.3.1 식 (1), Appendix A (A1–A2)',direction:'higher',scale:'raw',supportedAlpha:.05,minResults:60,maxResults:1000};
 function analyze(q){
  const out={status:'blocked',groupLoB:null,overallLoB:null,criterionStatus:'not_evaluated',method:{...method},errors:[],warnings:[],rank:null};
  const stop=code=>{out.errors.push(code);return out;};
  if(!q||typeof q!=='object'||Array.isArray(q)||Object.keys(q).some(k=>!['values','alpha','unit'].includes(k)))return stop('LOB_INPUT');
  if(q.alpha!==.05)return stop('LOB_ALPHA_UNSUPPORTED');
  if(typeof q.unit!=='string'||!q.unit.trim())return stop('LOB_UNIT');
  const unit=q.unit.trim().toLowerCase();
  if(/^(ct|cq|cp|tt)(?:$|\b|\s|\()/i.test(unit)||/log\s*10|log₁₀/.test(unit))return stop('LOB_SCALE_UNSUPPORTED');
  if(!Array.isArray(q.values)||q.values.length<60||q.values.length>1000)return stop('LOB_COUNT_UNSUPPORTED');
  if(!Array.from(q.values).every(v=>typeof v==='number'&&Number.isFinite(v)))return stop('LOB_NONNUMERIC');
  const sorted=[...q.values].sort((a,b)=>a-b),B=sorted.length;
  const h=.5+B*.95,lower=Math.floor(h),upper=Math.ceil(h),weight=h-lower;
  if(lower<1||upper>B)return stop('LOB_RANK_UNSUPPORTED');
  const a=sorted[lower-1],b=sorted[upper-1],value=lower===upper?a:a+weight*(b-a);
  if(!Number.isFinite(value))return stop('LOB_NUMERIC_RANGE');
  if(sorted[0]===sorted.at(-1))out.warnings.push('LOB_ALL_EQUAL');
  if(unit.includes('rfu'))out.warnings.push('LOB_INTERNAL_SIGNAL');
  return {...out,status:'calculated',groupLoB:value,count:B,alpha:.05,percentile:.95,unit:q.unit,
   rank:{position:h,lower,upper,lowerValue:a,upperValue:b,upperWeight:weight},
   // Original row positions are 1-based; sorting never rewrites the input.
   bracketingRows:{lower:q.values.flatMap((v,i)=>v===a?[i+1]:[]),upper:q.values.flatMap((v,i)=>v===b?[i+1]:[])}};
 }
 return {analyze,method};
});
