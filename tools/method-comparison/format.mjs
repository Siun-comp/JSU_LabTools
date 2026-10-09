const fixed2=v=>{const a=Math.abs(v),rounded=Math.round((a+Number.EPSILON*a)*100)/100;return (v<0&&rounded>0?'-':'')+rounded.toFixed(2);};
export function formatNumber(v){
  if(v===null||v===undefined||!Number.isFinite(v))return '—';
  const a=Math.abs(v);
  if(a!==0&&(a<.005||a>=1e6))return v.toExponential(2).replace('e','E').replace(/E([+-])(\d)$/,(_,sign,n)=>`E${sign}0${n}`);
  return fixed2(v);
}
export const formatPercent=v=>v===null||v===undefined||!Number.isFinite(v)?'—':fixed2(100*v)+'%';
export const numberFormat=v=>v!==0&&v!==null&&(Math.abs(v)<.005||Math.abs(v)>=1e6)?'0.00E+00':'0.00';
