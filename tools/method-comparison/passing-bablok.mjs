// Passing–Bablok regression (Passing & Bablok 1983, J Clin Chem Clin Biochem 21:709–720).
// Written from the published method. Rank and tie conventions follow R mcr 1.3.3.1 (mcreg PaBa,
// method.ci="analytical", slope.measure="radian") so that results can be checked against R:
//  - pair slopes are handled as angles atan(Δy/Δx); equal x with different y counts as +90°;
//    identical points carry no slope; differences below 1e-12 relative are treated as ties;
//  - slopes of exactly −1 are removed by the doubled-rank shift (2·#(<−1) + #(=−1)), same as the paper;
//  - CI ranks use C rounded to an integer, (N ∓ C + shift + 1)/2; a half rank averages the two angles.
// Only a positive relation is summarised (Kendall τ ≥ 0, same as mcr). No bootstrap.
import {normalQuantile} from './math.mjs';
export const PB_METHOD='Passing–Bablok (1983) / 기울기: 이동 중앙값 / CI: 순위 기반 근사(정규 분위수, R mcr analytical과 같은 순위 규칙) / 직선성: cusum 진단 / 전체 입력 고정';
export const PB_SOURCE='https://doi.org/10.1515/cclm.1983.21.11.709';
const CUSUM_CRITICAL={'0.9':1.22,'0.95':1.36,'0.99':1.63}; // Kolmogorov–Smirnov values used in the paper
const QUARTER=Math.PI/4;
const gap=(a,b)=>{const d=a-b;return d===0||Math.abs(d)<1e-12*(Math.abs(a)+Math.abs(b))/2?0:d;};
const middle=a=>{const s=a.slice().sort((p,q)=>p-q),m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2;};
function kendallSign(xs,ys){let s=0;for(let i=0;i<xs.length;i++)for(let j=i+1;j<xs.length;j++)s+=Math.sign(xs[j]-xs[i])*Math.sign(ys[j]-ys[i]);return s;}
export function passingBablokXY(xs,ys,confidence=.95){
 if(!(confidence>0&&confidence<1))throw Error('신뢰수준 오류');
 if(xs.length!==ys.length)throw Error('x·y 길이가 다릅니다.');
 const n=xs.length,result={n,slope:null,intercept:null,slopeCI:null,interceptCI:null,slopeCount:0,shift:0,linearity:null,negativeValues:false,reasons:[],method:PB_METHOD};
 if(n<3){result.reasons.push('수치쌍이 3개 미만입니다.');return result;}
 if(!xs.concat(ys).every(Number.isFinite)){result.reasons.push('유한한 숫자가 아닌 값이 있습니다.');return result;}
 result.negativeValues=xs.concat(ys).some(v=>v<0);
 if(kendallSign(xs,ys)<0){result.reasons.push('두 값이 반대 방향으로 움직이는 자료(음의 관계)는 Passing–Bablok으로 요약하지 않습니다.');return result;}
 const angles=[];let below=0,minusOne=0;
 for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){
  const dx=gap(xs[j],xs[i]),dy=gap(ys[j],ys[i]);
  if(dx===0&&dy===0)continue;
  const t=dx===0?Math.PI/2:Math.atan(dy/dx);
  if(t<-QUARTER)below++;else if(t===-QUARTER)minusOne++;
  angles.push(t);
 }
 angles.sort((p,q)=>p-q);
 const N=angles.length,shift=2*below+minusOne;result.slopeCount=N;result.shift=shift;
 if(N<1){result.reasons.push('기울기를 만들 수 있는 검체 쌍이 없습니다.');return result;}
 // value at doubled rank m (1-based rank = (m+1)/2): odd m → one angle, even m → mean of two angles.
 const atRank=m=>{const k=Math.floor((m+1)/2);if(k<1||k>N||(m%2===0&&k+1>N))return undefined;return Math.tan(m%2===0?(angles[k-1]+angles[k])/2:angles[k-1]);};
 const b=atRank(N+shift);
 if(!Number.isFinite(b)){result.reasons.push('기울기가 유한한 값으로 정해지지 않습니다(같은 Reference 값이 많은 자료일 수 있음).');return result;}
 const a=middle(xs.map((x,i)=>gap(ys[i],b*x)));
 result.slope=b;result.intercept=a;
 const C=Math.round(normalQuantile(1-(1-confidence)/2)*Math.sqrt(n*(n-1)*(2*n+5)/18));
 const mLow=N-C+shift,mHigh=N+C+shift;
 const lowOK=Math.floor((mLow+1)/2)>=2*minusOne+1,highOK=Math.floor((mHigh+1)/2)<=N;
 const lo=lowOK?atRank(mLow):undefined,hi=highOK?atRank(mHigh):undefined;
 if(Number.isFinite(lo)&&Number.isFinite(hi)){
  result.slopeCI=[lo,hi];
  result.interceptCI=[middle(xs.map((x,i)=>gap(ys[i],hi*x))),middle(xs.map((x,i)=>gap(ys[i],lo*x)))];
 }else result.reasons.push('검체 수가 적어 기울기·절편 CI를 정할 수 없습니다.');
 result.linearity=cusum(xs,ys,a,b,confidence);
 return result;
}
// Cusum linearity check from the paper. Diagnostic only; never an automatic pass/fail.
export function cusum(xs,ys,a,b,confidence=.95){
 const critical=CUSUM_CRITICAL[String(confidence)]??null;
 const sign=xs.map((x,i)=>{const r=gap(ys[i],a+b*x);return r>0?1:r<0?-1:0;});
 const above=sign.filter(s=>s>0).length,below=sign.filter(s=>s<0).length;
 if(!above||!below||!(b>0))return {statistic:null,critical,above,below,exceeds:null,reason:!(b>0)?'기울기가 0 이하이면 계산하지 않습니다.':'직선 한쪽에만 점이 있어 계산하지 않습니다.'};
 const up=Math.sqrt(below/above),down=-Math.sqrt(above/below),scale=Math.sqrt(1+1/(b*b));
 const order=xs.map((x,i)=>({i,d:(ys[i]+x/b-a)/scale})).sort((p,q)=>p.d-q.d||p.i-q.i);
 let sum=0,max=0;for(const {i} of order){sum+=sign[i]>0?up:sign[i]<0?down:0;max=Math.max(max,Math.abs(sum));}
 const statistic=max/Math.sqrt(below+1);
 return {statistic,critical,above,below,exceeds:critical===null?null:statistic>critical,reason:null};
}
const pairRows=rows=>rows.filter(r=>r.pair&&Number.isFinite(r.x)&&Number.isFinite(r.y));
export function passingBablok(rows,confidence=.95){const pairs=pairRows(rows);return {...passingBablokXY(pairs.map(p=>p.x),pairs.map(p=>p.y),confidence),pairs};}
