import {tQuantile,normalQuantile} from './math.mjs';
import {distribution} from './core.mjs';
export const METHODS={ba:'평균 차이: t CI / 95% LoA: 평균±1.96 SD / LoA CI: 정규차이 근사 t CI',deming:'일반 Deming / delete-one jackknife SE / t(n−1) CI / 전체 입력 고정'};
export const SOURCES={ba:'https://www-users.york.ac.uk/~mb55/meas/ba.pdf',interpretation:'https://www-users.york.ac.uk/~mb55/meas/interlim.htm',deming:'https://cran.r-project.org/web/packages/mcr/mcr.pdf'};
const pairRows=rows=>rows.filter(r=>r.pair&&Number.isFinite(r.x)&&Number.isFinite(r.y));
const mean=a=>a.reduce((s,v)=>s+v/a.length,0);
const variance=a=>{const m=mean(a);return a.reduce((s,v)=>s+(v-m)**2,0)/(a.length-1);};
const interval=(center,half)=>[center-half,center+half];
export function configuration(options={}){
  const unit=String(options.unit||'').trim(),basis=String(options.basis||'').trim(),lambda=Number(options.lambda);
  const independent=options.independent===true,sameScale=options.sameScale===true;
  const xUnit=String(options.xUnit||(sameScale?unit:'')).trim(),yUnit=String(options.yUnit||(sameScale?unit:'')).trim();
  const baReasons=[],demingReasons=[];
  if(!independent){baReasons.push('독립 검체 1개당 1쌍인지 확인하세요. 반복측정은 별도 모형이 필요합니다.');demingReasons.push('독립 검체 1개당 1쌍인지 확인하세요.');}
  if(!sameScale||!unit)baReasons.push('같은 측정항목·단위·결과 정의를 확인하고 공통 단위를 입력하세요.');
  if(!xUnit||!yUnit)demingReasons.push('Reference와 Product의 단위/척도를 각각 입력하세요.');
  if(!['equal','precision'].includes(options.lambdaSource))demingReasons.push('λ의 근거를 선택하세요.');
  if(!(lambda>0&&Number.isFinite(lambda)))demingReasons.push('λ는 0보다 큰 유한한 값이어야 합니다.');
  if(options.lambdaSource==='equal'&&lambda!==1)demingReasons.push('동등 측정오차 분산 가정은 λ=1입니다.');
  if(options.lambdaSource==='precision'&&!basis)demingReasons.push('별도 정밀도 자료의 출처·적용 범위를 입력하세요.');
  const lower=options.lower===''||options.lower==null?null:Number(options.lower),upper=options.upper===''||options.upper==null?null:Number(options.upper);
  const toleranceValid=(!options.toleranceRequired&&lower===null&&upper===null)||Number.isFinite(lower)&&Number.isFinite(upper)&&lower<upper;
  if(!toleranceValid)baReasons.push('허용 차이는 하한·상한을 모두 입력하고 하한 < 상한으로 설정하세요.');
  return {independent,sameScale,unit,xUnit,yUnit,lambda,lambdaSource:options.lambdaSource||'',basis:options.lambdaSource==='equal'?'탐색적 동등 오차분산 가정 (λ=1)':basis,lower,upper,toleranceValid,baReasons,demingReasons};
}
export function blandAltman(rows,confidence=.95){
  if(!(confidence>0&&confidence<1))throw Error('신뢰수준 오류');
  const pairs=pairRows(rows).map(r=>({...r,average:r.x/2+r.y/2,difference:r.y-r.x})),n=pairs.length;
  const result={n,pairs,bias:null,sd:null,biasCI:null,loa:null,loaCI:null,outside:0,distribution:null,reasons:[],method:METHODS.ba};
  if(!n){result.reasons.push('분석 가능한 양쪽 양성 수치쌍이 없습니다.');return result;}
  if(pairs.some(p=>!Number.isFinite(p.difference)||!Number.isFinite(p.average))){result.reasons.push('차이 또는 평균이 표현 가능한 수치 범위를 벗어납니다.');return result;}
  const differences=pairs.map(p=>p.difference),bias=mean(differences);
  Object.assign(result,{bias,distribution:distribution(differences)});
  if(n<2){result.reasons.push('SD·CI·LoA는 수치쌍 2개 이상이 필요합니다.');return result;}
  const sd=Math.sqrt(variance(differences)),t=tQuantile((1+confidence)/2,n-1),z=1.96;
  const loa=interval(bias,z*sd),half=t*sd*Math.sqrt(1/n+z*z/(2*(n-1)));
  if(![sd,t,half,...loa].every(Number.isFinite)){result.reasons.push('차이의 수치 범위가 너무 커서 SD·CI·LoA를 계산할 수 없습니다.');return result;}
  Object.assign(result,{sd,biasCI:interval(bias,t*sd/Math.sqrt(n)),loa,loaCI:loa.map(v=>interval(v,half)),outside:pairs.filter(p=>p.difference<loa[0]||p.difference>loa[1]).length});
  if(sd===0)result.reasons.push('관측 차이가 모두 같습니다. 폭 0의 구간이 실제 측정오차 0을 입증하지 않습니다.');
  result.reasons.push('차이의 정규성·독립성·일정한 분산을 가정합니다. 퍼짐이 값에 따라 변하거나 치우침이 심하면 이 LoA와 근사 CI 해석을 재검토하세요.');
  return result;
}
// Centered moments and rank-one deletion keep delete-one jackknife O(n).
function fit(mx,my,xx,yy,xy,lambda){
  if(!(xx>0)||!(yy>0)||xy===0)return null;
  const scale=Math.max(xx,yy),u=xx/scale,v=yy/scale,w=xy/scale;
  // Divide by max(1,lambda) to avoid overflow for a large finite lambda.
  const f=Math.max(1,lambda),d=v/f-lambda/f*u,h=Math.hypot(d,2*Math.sqrt(lambda)/f*w);
  const slope=d>=0?(d+h)/(2*w/f):(2*(lambda/f)*w)/(h-d),intercept=my-slope*mx;
  return Number.isFinite(slope)&&Number.isFinite(intercept)?{slope,intercept}:null;
}
export function deming(rows,lambda=1,confidence=.95){
  if(!(lambda>0&&Number.isFinite(lambda)))throw Error('λ는 0보다 큰 유한한 값이어야 합니다.');
  if(!(confidence>0&&confidence<1))throw Error('신뢰수준 오류');
  const pairs=pairRows(rows),n=pairs.length,result={n,lambda,pairs,slope:null,intercept:null,slopeCI:null,interceptCI:null,slopeSE:null,interceptSE:null,reasons:[],method:METHODS.deming};
  if(n<2){result.reasons.push('수치쌍이 2개 미만입니다.');return result;}
  const mx=mean(pairs.map(p=>p.x)),my=mean(pairs.map(p=>p.y));let xx=0,yy=0,xy=0;
  for(const p of pairs){xx+=(p.x-mx)**2;yy+=(p.y-my)**2;xy+=(p.x-mx)*(p.y-my);}
  if(![mx,my,xx,yy,xy].every(Number.isFinite)){result.reasons.push('수치 범위가 너무 큽니다.');return result;}
  const estimate=fit(mx,my,xx,yy,xy,lambda);
  if(!estimate){result.reasons.push('한쪽 값이 일정하거나 공분산이 0인 자료는 유한한 Deming 직선으로 요약하지 않습니다.');return result;}
  Object.assign(result,estimate);
  if(n<3){result.reasons.push('Jackknife CI는 3쌍 이상이 필요합니다.');return result;}
  const leave=[];
  for(const p of pairs){const dx=p.x-mx,dy=p.y-my,weight=n/(n-1);const q=fit(mx-dx/(n-1),my-dy/(n-1),xx-weight*dx*dx,yy-weight*dy*dy,xy-weight*dx*dy,lambda);if(!q){result.reasons.push('한 검체를 제외하면 직선을 계산할 수 없어 jackknife CI를 제공하지 않습니다.');return result;}leave.push(q);}
  const t=tQuantile((1+confidence)/2,n-1);
  for(const key of ['slope','intercept']){const a=leave.map(q=>q[key]),center=mean(a),se=Math.sqrt((n-1)/n*a.reduce((s,v)=>s+(v-center)**2,0));const ci=interval(result[key],t*se);if(![se,...ci].every(Number.isFinite)){result.reasons.push('Jackknife CI가 유한하지 않습니다.');continue;}result[key+'SE']=se;result[key+'CI']=ci;}
  return result;
}
export function analyses(snapshot,selected){
  const config=configuration(snapshot.comparison),ba=config.baReasons.length?null:blandAltman(selected,snapshot.confidence);
  const model=config.demingReasons.length?null:deming(snapshot.rows,config.lambda,snapshot.confidence);
  return {config,ba,deming:model,selectedN:pairRows(selected).length};
}
export function olsDiagnostics(model){
  const {pairs,n,mx,xx,se,slope,intercept}=model;
  if(n<3||slope===null||!Number.isFinite(se)||!xx)return [];
  const mse=se*se,sse=mse*(n-2);
  return pairs.map(p=>{const residual=p.y-(intercept+slope*p.x),dx=p.x-mx,leverage=1/n+dx*dx/xx,remaining=1-leverage;
    if(!(remaining>1e-14))return {...p,leverage,cook:null,studentized:null,withoutSlope:null,withoutIntercept:null};
    const cook=mse>0?residual**2/(2*mse)*leverage/remaining**2:null;
    const deletedVariance=n>3?(sse-residual**2/remaining)/(n-3):null;
    const studentized=deletedVariance>0?residual/Math.sqrt(deletedVariance*remaining):null;
    const withoutSlope=slope-dx*residual/(xx*remaining),withoutIntercept=intercept-residual/remaining*(1/n-mx*dx/xx);
    return {...p,leverage,cook:Number.isFinite(cook)?cook:null,studentized:Number.isFinite(studentized)?studentized:null,withoutSlope,withoutIntercept};
  });
}
export function comparisonFacts(result){
  const c=result.config,b=result.ba,d=result.deming;
  return [['BA 대상','현재 선택 범위 · 양쪽 Positive + 두 숫자'],['차이 방향','Product − Reference'],['독립 검체 확인',c.independent?'확인':'미확인'],['동일 측정항목·단위·결과 정의',c.sameScale?'확인':'미확인'],['공통 단위',c.unit||'미입력'],['BA 계산법',METHODS.ba],['BA 상태',c.baReasons.join(' ')||b?.reasons.join(' ')||'계산 완료'],['BA 방법 출처',SOURCES.ba],['Deming 대상','전체 입력 고정 · 양쪽 Positive + 두 숫자'],['Deming λ 정의','Var(Product 측정오차) / Var(Reference 측정오차)'],['Deming λ',Number.isFinite(c.lambda)?c.lambda:null],['Deming λ 근거',c.basis||'미설정'],['Deming 계산법',METHODS.deming],['Deming 상태',c.demingReasons.join(' ')||d?.reasons.join(' ')||'계산 완료'],['Deming 방법 참고',SOURCES.deming],['사전 허용 차이',c.lower===null&&c.upper===null?'미설정':`${c.lower} ~ ${c.upper}`]];
}
