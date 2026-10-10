import {extractInput} from './headers.mjs';
import {dateLabels} from './date-boundaries.mjs';
import {proportion,regression,tQuantile} from './math.mjs';
export const VERSION='0.3.1';
export const HEADERS=['검체 ID','채취일','Reference 결과','Reference 검출값','Product 결과','Product 검출값'];
export function readDelimited(text){text=text.replace(/^\uFEFF/,'');const delimiter=text.includes('\t')?'\t':',';const rows=[];let row=[],field='',quote=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quote&&text[i+1]==='"'){field+='"';i++;}else if(quote||field==='')quote=!quote;else field+=c;}else if(c===delimiter&&!quote){row.push(field);field='';}else if((c==='\n'||c==='\r')&&!quote){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);rows.push(row);row=[];field='';}else field+=c;}if(quote)throw Error('닫히지 않은 따옴표가 있습니다.');if(field!==''||row.length){row.push(field);rows.push(row);}if(rows.some(r=>r.length>6&&r.slice(6).some(v=>v.trim()!=='')))throw Error('입력은 기존 양식의 A–F, 6개 열만 붙여넣으세요.');return extractInput(rows.map((cells,i)=>({cells:Array.from({length:6},(_,j)=>cells[j]??''),sourceRow:i+1})));}
export const parseDelimited=text=>readDelimited(text).records;
export function numberValue(v){const s=String(v??'').trim();if(!s)return null;const grouped=/^[+-]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)?s.replaceAll(',',''):s;if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(grouped))return null;const n=Number(grouped);return Number.isFinite(n)?n:null;}
export function dateValue(v){const s=String(v??'').trim();if(!s)return null;const m=s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);if(!m)return null;const [,year,month,day]=m.map(Number);if(year<1900||year>9999)return null;const date=new Date(Date.UTC(year,month-1,day));return date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day?date.toISOString().slice(0,10):null;}
export function excelDate(value,date1904=false){const n=Number(value);if(!Number.isFinite(n)||n<0||(!date1904&&Math.floor(n)===60))return String(value);const epoch=Date.UTC(date1904?1904:1899,date1904?0:11,date1904?1:31);const adjusted=date1904?n:n>=60?n-1:n;try{return new Date(epoch+Math.floor(adjusted)*86400000).toISOString().slice(0,10);}catch{return String(value);}}
export function statusValue(v){const s=String(v??'').trim().toLowerCase();if(!s)return 'missing';return ({positive:'positive',negative:'negative',nd:'negative',invalid:'invalid','양성':'positive','음성':'negative','미검출':'negative','무효':'invalid'})[s]??'unknown';}
export function normalize(records){
  const rows=records.filter(r=>r.cells.some(v=>String(v??'').trim()!=='' )).map((r,uid)=>{
    const raw=r.cells.map(v=>String(v??'')),id=raw[0].trim();
    const x=numberValue(raw[3]),y=numberValue(raw[5]),date=dateValue(raw[1]),ref=statusValue(raw[2]),product=statusValue(raw[4]),issues=[];
    if(!id)issues.push('ID 없음 — 전체 분석 제외');
    if(!date)issues.push(raw[1].trim()?'날짜 형식 오류':'날짜 없음');
    for(const [label,status] of [['Reference',ref],['Product',product]])if(['missing','invalid','unknown'].includes(status))issues.push(`${label} ${status==='missing'?'결과 없음':status==='invalid'?'Invalid':'결과 미인식'}`);
    for(const [label,index,value] of [['Reference',3,x],['Product',5,y]])if(value===null)issues.push(`${label} ${raw[index].trim()?'수치 형식 오류':'검출값 없음'}`);
    for(const [label,status,value] of [['Reference',ref,x],['Product',product,y]])if(status==='negative'&&value!==null)issues.push(`${label} 음성·ND의 수치 — 수치 분석 제외`);
    for(const [label,value] of [['Reference',x],['Product',y]])if(value!==null&&value<=0)issues.push(`${label} 검출값 0 이하 — 입력 확인 (이 사유로 제외하지 않음)`);
    const inputErrors=[];
    if(raw[1].trim()&&!date)inputErrors.push('채취일 형식 오류');
    if(raw[3].trim()&&x===null)inputErrors.push('Reference 수치 형식 오류');
    if(raw[5].trim()&&y===null)inputErrors.push('Product 수치 형식 오류');
    if(ref==='unknown')inputErrors.push('Reference 결과 미인식');
    if(product==='unknown')inputErrors.push('Product 결과 미인식');
    const eligible=Boolean(id)&&inputErrors.length===0;
    if(inputErrors.length)issues.push('입력 형식 오류 — 전체 분석 제외');
    const qual=eligible&&['positive','negative'].includes(ref)&&['positive','negative'].includes(product);
    const cls=qual?(ref==='positive'?(product==='positive'?'TP':'FN'):(product==='positive'?'FP':'TN')):null;
    const pair=eligible&&ref==='positive'&&product==='positive'&&x!==null&&y!==null;
    return {...r,uid,raw,id,eligible,inputErrors,x,y,date,ref,product,qual,cls,pair,issues};
  });
  const counts=new Map();rows.forEach(r=>{if(r.id)counts.set(r.id,(counts.get(r.id)||0)+1);});
  rows.forEach(r=>{if(r.id&&counts.get(r.id)>1)r.issues.push('중복 ID (행 유지)');});return rows;
}
export function inputAudit(rows){
  return {total:rows.length,eligible:rows.filter(r=>r.eligible).length,idExcluded:rows.filter(r=>!r.id).length,formatExcluded:rows.filter(r=>r.id&&r.inputErrors.length).length,
    dateFormat:rows.filter(r=>r.raw[1].trim()&&!r.date).length,xFormat:rows.filter(r=>r.raw[3].trim()&&r.x===null).length,yFormat:rows.filter(r=>r.raw[5].trim()&&r.y===null).length,
    referenceUnknown:rows.filter(r=>r.ref==='unknown').length,productUnknown:rows.filter(r=>r.product==='unknown').length,
    referenceNonpositive:rows.filter(r=>r.x!==null&&r.x<=0).length,productNonpositive:rows.filter(r=>r.y!==null&&r.y<=0).length};
}
export function inputAuditEntries(rows){const a=inputAudit(rows);return [
  ['전체 입력 행',a.total],['전체 입력 분석 적격 행',a.eligible],['전체 입력 ID 누락 제외',a.idExcluded],['전체 입력 형식 오류 제외 (ID 존재)',a.formatExcluded],
  ['채취일 형식 오류 (항목별)',a.dateFormat],['Reference 수치 형식 오류 (항목별)',a.xFormat],['Product 수치 형식 오류 (항목별)',a.yFormat],
  ['Reference 결과 미인식 (항목별)',a.referenceUnknown],['Product 결과 미인식 (항목별)',a.productUnknown],
  ['Reference 0 이하 수치 · 확인',a.referenceNonpositive],['Product 0 이하 수치 · 확인',a.productNonpositive]];}
export const numericCaution=n=>n>0&&n<10?'수치쌍이 10개 미만입니다. 상관·회귀·PI는 소표본과 값의 범위에 영향을 받을 수 있으므로 탐색적으로 해석하세요.':'';
export function bounds(text,type='number'){const items=text.trim()?text.trim().split(/[\s,;]+/):[];if(items.length>30)throw Error('경계값은 30개 이하로 입력하세요.');const values=items.map(s=>type==='date'?dateValue(s):numberValue(s));if(values.some(v=>v===null))throw Error(type==='date'?'날짜 경계는 YYYY-MM-DD로 입력하세요.':'검출값 경계는 숫자로 입력하세요.');if(values.some((v,i)=>i>0&&v<=values[i-1]))throw Error('경계값을 중복 없이 작은 값부터 입력하세요.');return values;}
export function bucket(value,cuts){return cuts.findIndex(c=>value<c)===-1?cuts.length:cuts.findIndex(c=>value<c);}
export function labels(cuts){return cuts.length?cuts.map((c,i)=>i===0?`< ${c}`:`${cuts[i-1]} ≤ 값 < ${c}`).concat(`≥ ${cuts.at(-1)}`):['전체'];}
export function subset(rows,scope,ctCuts,dateCuts){
  return rows.filter(r=>(r.eligible||scope.ct==='all'&&scope.date==='all')&&(scope.ct==='all'||r.x!==null&&bucket(r.x,ctCuts)===Number(scope.ct))&&(scope.date==='all'||r.date!==null&&(dateCuts.length?bucket(r.date,dateCuts)===Number(scope.date):r.date===scope.date)));
}
const asPairs=rows=>rows.filter(r=>r.pair).map(r=>({x:r.x,y:r.y,id:r.id,uid:r.uid,sourceRow:r.sourceRow,pair:true}));
export function buildModel(rows,confidence=.95,piLevel=.95){
  if(!(piLevel>0&&piLevel<1))throw Error('PI 수준은 0%보다 크고 100%보다 작아야 합니다.');
  const pairs=asPairs(rows),model=regression(pairs,confidence);
  const mx=pairs.length?pairs.reduce((s,p)=>s+p.x/pairs.length,0):null;
  const xx=pairs.reduce((s,p)=>s+(p.x-mx)**2,0);
  return {...model,mx,xx,piLevel,piT:model.n>=3?tQuantile((1+piLevel)/2,model.n-2):null,pairs};
}
export function prediction(model,x){
  if(model.n<3||!(model.xx>0)||model.slope===null||model.se===null||![model.mx,model.xx,model.slope,model.intercept,model.se,model.piT,x].every(Number.isFinite))return null;
  const fit=model.intercept+model.slope*x,half=model.piT*model.se*Math.sqrt(1+1/model.n+(x-model.mx)**2/model.xx);
  const lo=fit-half,hi=fit+half;
  return [fit,lo,hi].every(Number.isFinite)?{fit,lo,hi}:null;
}
export function evaluateRow(r,model){
  if(!r.pair)return {state:'분석 제외',fit:null,residual:null,lo:null,hi:null,excess:null};
  const fit=model.slope!==null?model.intercept+model.slope*r.x:null;
  const residual=Number.isFinite(fit)?r.y-fit:null,interval=prediction(model,r.x);
  if(!interval)return {state:'계산 불가',fit:Number.isFinite(fit)?fit:null,residual,lo:null,hi:null,excess:null};
  const state=r.y<interval.lo?'하한 이탈':r.y>interval.hi?'상한 이탈':'범위 내';
  return {...interval,residual,state,excess:Math.max(0,interval.lo-r.y,r.y-interval.hi)};
}
export function summarize(rows,confidence=.95,method='exact',model=null){
  const eligible=rows.filter(r=>r.eligible),c={TP:0,FN:0,FP:0,TN:0};eligible.forEach(r=>{if(r.cls)c[r.cls]++;});
  const valid=c.TP+c.FN+c.FP+c.TN,pairs=asPairs(eligible),refPositive=eligible.filter(r=>r.ref==='positive');
  const evals=model?eligible.filter(r=>r.pair).map(r=>evaluateRow(r,model)):[];
  const piValid=evals.filter(r=>r.lo!==null),outliers=piValid.filter(r=>r.state!=='범위 내'),residuals=evals.map(r=>r.residual).filter(Number.isFinite);
  return {total:rows.length,eligible:eligible.length,idExcluded:rows.filter(r=>!r.id).length,formatExcluded:rows.filter(r=>r.id&&r.inputErrors.length).length,valid,excluded:rows.length-valid,...c,
    ppa:proportion(c.TP,c.TP+c.FN,confidence,method),npa:proportion(c.TN,c.TN+c.FP,confidence,method),opa:proportion(c.TP+c.TN,valid,confidence,method),
    detection:proportion(c.TP,c.TP+c.FN,confidence,method),refPositive:refPositive.length,
    productInvalid:refPositive.filter(r=>r.product==='invalid').length,productMissing:refPositive.filter(r=>r.product==='missing').length,
    evaluability:{k:c.TP+c.FN,n:refPositive.length,p:refPositive.length?(c.TP+c.FN)/refPositive.length:null},
    dateMissing:eligible.filter(r=>!r.date).length,xMissing:eligible.filter(r=>r.x===null).length,yMissing:eligible.filter(r=>r.y===null).length,
    invalid:eligible.filter(r=>r.ref==='invalid'||r.product==='invalid').length,missingResult:eligible.filter(r=>r.ref==='missing'||r.product==='missing').length,
    pi:{n:piValid.length,unavailable:pairs.length-piValid.length,upper:outliers.filter(r=>r.state==='상한 이탈').length,lower:outliers.filter(r=>r.state==='하한 이탈').length,
      outliers:outliers.length,rate:piValid.length?outliers.length/piValid.length:null,meanExcess:outliers.length?outliers.reduce((s,r)=>s+r.excess/outliers.length,0):null,
      residualMean:residuals.length?residuals.reduce((s,r)=>s+r/residuals.length,0):null},
    numeric:{...regression(pairs,confidence),xMean:pairs.length?pairs.reduce((s,p)=>s+p.x/pairs.length,0):null,yMean:pairs.length?pairs.reduce((s,p)=>s+p.y/pairs.length,0):null,
      xRange:pairs.length?[Math.min(...pairs.map(p=>p.x)),Math.max(...pairs.map(p=>p.x))]:null,yRange:pairs.length?[Math.min(...pairs.map(p=>p.y)),Math.max(...pairs.map(p=>p.y))]:null}
  };
}
export function groups(rows,kind,cuts,confidence,method,model=null){
  const eligible=rows.filter(r=>r.eligible),names=kind==='ct'?labels(cuts):cuts.length?dateLabels(cuts):[...new Set(eligible.map(r=>r.date).filter(Boolean))].sort();
  return names.map((label,i)=>{const selected=eligible.filter(r=>kind==='ct'?r.x!==null&&bucket(r.x,cuts)===i:r.date!==null&&(cuts.length?bucket(r.date,cuts)===i:r.date===label));return {label,rows:selected,summary:summarize(selected,confidence,method,model)};});
}
export function distribution(values){
  if(!values.length)return {n:0,median:null,q1:null,q3:null};
  const sorted=values.toSorted((a,b)=>a-b),q=p=>{const at=(sorted.length-1)*p,lo=Math.floor(at),w=at-lo;return sorted[lo]*(1-w)+sorted[Math.ceil(at)]*w;};
  return {n:values.length,median:q(.5),q1:q(.25),q3:q(.75)};
}
export function medianSummary(rows){
  const all=rows.filter(r=>r.eligible&&r.ref==='positive'&&r.x!==null),paired=all.filter(r=>r.pair);
  return {all:distribution(all.map(r=>r.x)),reference:distribution(paired.map(r=>r.x)),product:distribution(paired.map(r=>r.y))};
}
export function medianGroups(rows,cuts){
  return labels(cuts).map((label,i)=>({label,...medianSummary(rows.filter(r=>r.eligible&&r.x!==null&&bucket(r.x,cuts)===i))}));
}

export function medianDateGroups(rows,cuts){return groups(rows,'date',cuts,.95,'exact').map(g=>({label:g.label,...medianSummary(g.rows)}));}
