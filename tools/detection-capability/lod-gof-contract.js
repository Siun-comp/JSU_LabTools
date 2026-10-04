/* Diagnostic contract only. Does not alter fitted model, point estimate or CI. */
'use strict';
(function(root){
 const method=()=>({id:'chi-square-upper-tail',version:'1.0.0',source:'stats::pchisq(statistic,df,lower.tail=FALSE)',dispersionRatio:'Pearson/residualDF',smallExpectedReference:5,rowIndexBasis:'analysis-order-1-based',devianceRoundoffTolerance:1e-10,assessment:'review_required',ciDispersion:1});
 function empty(){return {version:'lod-gof-1',status:'not_available',pearsonP:null,devianceP:null,pearsonPerDF:null,minExpectedPositive:null,minExpectedNegative:null,smallExpectedRows:[],warnings:[],method:method()};}
 function fromFields(f,e,q){
  const g=empty();if(e.status!=='candidate')return g;
  const scalar=k=>{if(!f[k]?.trim()||!Number.isFinite(Number(f[k])))throw Error('invalid_response');return Number(f[k]);};
  if(!Number.isInteger(e.residualDF)||e.residualDF!==q.c.length-2||!Number.isFinite(e.pearson)||!Number.isFinite(e.deviance)||e.pearson<0||e.deviance < -1e-10)throw Error('invalid_response');
  // R may return a tiny negative deviance at an effectively exact fit. Keep raw value.
  // pchisq's lower.tail=FALSE result is retained; expose roundoff instead of rewriting it.
  if(e.deviance<0)g.warnings.push('DEVIANCE_ROUNDOFF');
  for(let i=0;i<q.c.length;i++){
   const p=e.expectedPositive[i],n=e.expectedNegative[i];
   if(!Number.isFinite(p)||!Number.isFinite(n)||p<0||n<0||Math.abs(p+n-q.n[i])>1e-10*Math.max(1,q.n[i]))throw Error('invalid_response');
   if(p<5||n<5)g.smallExpectedRows.push(i+1);
  }
  g.minExpectedPositive=Math.min(...e.expectedPositive);g.minExpectedNegative=Math.min(...e.expectedNegative);
  if(g.smallExpectedRows.length)g.warnings.push('SMALL_EXPECTED_COUNT');
  if(e.diagnostics.some(s=>['R_WARNING','R_STDERR'].includes(s)))g.warnings.push('EXECUTION_WARNING');
  if(e.residualDF<=0){if(f.gofStatus!=='held')throw Error('invalid_response');g.status='held';g.warnings.push('NO_RESIDUAL_DF');return g;}
  if(f.gofStatus!=='calculated')throw Error('invalid_response');
  g.status='calculated';g.pearsonP=scalar('pearsonP');g.devianceP=scalar('devianceP');g.pearsonPerDF=scalar('pearsonPerDF');
  if(g.pearsonP<0||g.pearsonP>1||g.devianceP<0||g.devianceP>1||g.pearsonPerDF<0||Math.abs(g.pearsonPerDF-e.pearson/e.residualDF)>1e-12*Math.max(1,g.pearsonPerDF))throw Error('invalid_response');
  return g;
 }
 function valid(g,e,q){try{
  const f={gofStatus:g.status,pearsonP:String(g.pearsonP),devianceP:String(g.devianceP),pearsonPerDF:String(g.pearsonPerDF)};
  return JSON.stringify(g)===JSON.stringify(fromFields(f,e,q));
 }catch{return false;}}
 const api={empty,fromFields,valid};if(typeof module==='object'&&module.exports)module.exports=api;else root.LoDGOFContract=api;
})(globalThis);
