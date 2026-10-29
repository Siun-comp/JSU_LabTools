// SPDX-License-Identifier: GPL-2.0-or-later
import {CONTRACT,makeRequest,validateRequest,freeze,metadata,compare,hasTm} from './analysis-core.mjs';
import {FIELDS} from './conditions.mjs';
import {reverseComplement} from './sequence.mjs';
export const SUITE_SCHEMA='analysis-suite/1';
export const UNITS=Object.freeze({tm:'degC',dg:'kcal/mol',dh:'kcal/mol',ds:'cal/(mol*K)'});
export function gridPoints(start,end,step){
 const strings=[start,end,step].map(x=>String(x??'').trim());
 if(strings.some(s=>!s||!Number.isFinite(Number(s))))throw new Error('온도 시작·끝·간격을 입력하세요.');
 const [a,b,d]=strings.map(Number),lo=a*2,hi=b*2,inc=d*2;
 if(!Number.isInteger(lo)||!Number.isInteger(hi)||a<0||b>100||a>b||![.5,1,2,5,10].includes(d))throw new Error('0~100°C·0.5°C 단위의 시작/끝과 지원 간격을 선택하세요.');
 if((hi-lo)%inc!==0)throw new Error('끝 온도는 시작 온도에서 간격으로 정확히 도달해야 합니다. 끝점을 자동 추가하지 않습니다.');
 const count=(hi-lo)/inc+1;if(count>21)throw new Error('온도 비교는 최대21점입니다. 간격 또는 범위를 수정하세요.');
 return Array.from({length:count},(_,i)=>(lo+i*inc)/2);
}
export function targetsFor(source,n){
 validateRequest(source);
 if(!Number.isInteger(n)||n<3||n>10||n>source.selection.length)throw new Error('말단 길이는3~10nt의 정수이며 전체 선택 길이 이하여야 합니다. 자동 절삭하지 않습니다.');
 const L=source.strandA.length,S=source.selection.start;
 return [['full',1,L],['five',1,n],['three',L-n+1,L]].map(([kind,aStart,aEnd])=>{
  const sequence=source.strandA.slice(aStart-1,aEnd),partner=reverseComplement(sequence),bStart=L-aEnd+1,bEnd=L-aStart+1;
  if(source.strandB.slice(bStart-1,bEnd)!==partner)throw new Error('A/B 말단 대응이 올바르지 않습니다.');
  return {kind,aStart,aEnd,bStart,bEnd,parentStart:S+aStart-1,parentEnd:S+aEnd-1,length:sequence.length,sequence,partner};
 });
}
export function makeSuiteRequest(input,mode,settings,id,revision){
 const source=makeRequest(input,id,revision),s=String(settings.n??'').trim(),n=s?Number(s):NaN;
 const request={schemaVersion:SUITE_SCHEMA,requestId:id,revision,mode,source,n,targets:targetsFor(source,n),
  temperatures:mode==='temperature'?gridPoints(settings.start,settings.end,settings.step):[source.conditions.temperature],
  includeHairpin:mode==='temperature'&&Boolean(settings.includeHairpin)};
 return freeze(validateSuiteRequest(request));
}
export function validateSuiteRequest(r){
 if(!r||r.schemaVersion!==SUITE_SCHEMA||!['terminal','temperature'].includes(r.mode)||!Number.isSafeInteger(r.requestId)||r.requestId<1||!Number.isSafeInteger(r.requestId*64+64)||!Number.isSafeInteger(r.revision)||r.revision<0)throw new Error('분석 묶음의 버전/번호/종류가 올바르지 않습니다.');
 validateRequest(r.source);
 if(r.source.requestId!==r.requestId||r.source.revision!==r.revision)throw new Error('원본과 분석 묶음 번호가 다릅니다.');
 if(JSON.stringify(r.targets)!==JSON.stringify(targetsFor(r.source,r.n)))throw new Error('말단 서열/파트너/좌표가 원본과 일치하지 않습니다.');
 if(typeof r.includeHairpin!=='boolean'||(r.mode==='terminal'&&r.includeHairpin))throw new Error('Hairpin 실행 범위가 올바르지 않습니다.');
 if(!Array.isArray(r.temperatures)||!r.temperatures.length||r.temperatures.length>21||r.temperatures.some(t=>typeof t!=='number'||!Number.isFinite(t)||t<0||t>100))throw new Error('온도 격자가 올바르지 않습니다.');
 if(r.mode==='terminal'){
  if(r.temperatures.length!==1||r.temperatures[0]!==r.source.conditions.temperature)throw new Error('말단 분석 온도가 입력과 다릅니다.');
 }else{
  const ts=r.temperatures,step=ts.length>1?ts[1]-ts[0]:.5;
  if(JSON.stringify(gridPoints(ts[0],ts.at(-1),step))!==JSON.stringify(ts))throw new Error('온도 격자의 누락/중복/순서를 확인하세요.');
 }
 return r;
}
export function childRequest(suite,pointIndex,targetIndex){
 const t=suite.targets[targetIndex],c={...suite.source.conditions,temperature:suite.temperatures[pointIndex]};
 return validateRequest({...suite.source,requestId:suite.requestId*64+pointIndex*3+targetIndex+1,
  selection:{start:t.parentStart,end:t.parentEnd,length:t.length},strandA:t.sequence,strandB:t.partner,conditions:c});
}
function validateValue(v,kind,c,sequence,requested=true){
 const fields=['tm','dg','dh','ds'];
 if(!v||!['ok','tm-only','unsupported','no-structure','error','not-requested'].includes(v.status))throw new Error('분석 상태가 올바르지 않습니다.');
 if(!requested){if(v.status!=='not-requested'||fields.some(k=>k in v)||v.structure)throw new Error('미요청 분석에 결과를 넣을 수 없습니다.');return;}
 if(v.status==='not-requested'||(kind==='duplex'&&v.status==='no-structure'))throw new Error('요청한 분석의 상태가 올바르지 않습니다.');
 if(v.status==='ok'){
  if(fields.some(k=>!Number.isFinite(v[k]))||Math.abs(v.dg-(v.dh-(c.temperature+273.15)*v.ds/1000))>(kind==='duplex'?1e-8:1e-6))throw new Error('에너지 온도/단위/유한수 검증에 실패했습니다.');
  if(kind==='duplex'&&(c.mg>0||v.model!==CONTRACT.duplex))throw new Error('Duplex 에너지의 조건/모델이 올바르지 않습니다.');
  if(kind==='hairpin'&&v.model!=='primer3-py 2.3.1 THAL')throw new Error('Hairpin 모델이 올바르지 않습니다.');
 }else if(v.status==='tm-only'){
  if(kind!=='duplex'||c.mg<=0||v.model!==CONTRACT.duplexMgTm||!Number.isFinite(v.tm)||fields.slice(1).some(k=>k in v))throw new Error('Tm 전용 필드/모델이 올바르지 않습니다.');
  const x=v.tmCorrection;
  if(!x||x.model!==CONTRACT.duplexMgTm||x.totalMgM!==c.mg*1e-3||x.dntpM!==c.dntp*1e-3||x.monoM!==(c.na+c.k+c.nh4)*1e-3||x.bindingConstantMInverse!==3e4||!Number.isFinite(x.freeMgM)||x.freeMgM<=0||x.freeMgM>x.totalMgM*(1+1e-12)||!Number.isFinite(x.correctionInverseK)||!['mixed','monovalent-dominant','magnesium-dominant'].includes(x.branch)||(x.ratio!==null&&!Number.isFinite(x.ratio)))throw new Error('Mg 적용값/단위가 올바르지 않습니다.');
 }else if(fields.some(k=>k in v)||typeof v.reason!=='string'&&['unsupported','error'].includes(v.status))throw new Error('미지원/오류/미검출 필드가 올바르지 않습니다.');
 if(kind==='duplex'&&hasTm(v)){
  const self=sequence===reverseComplement(sequence),effective=(self?c.a+c.b:Math.max(c.a,c.b)-Math.min(c.a,c.b)/2)*1e-9;
  if(v.self!==self||v.effectiveConcentrationM!==effective)throw new Error('Fragment 반응 정의/농도가 올바르지 않습니다.');
 }
 if(v.structure!==undefined&&typeof v.structure!=='string')throw new Error('구조 원문 형식이 올바르지 않습니다.');
}
export function validateSuiteResult(result,request){
 validateSuiteRequest(request);
 if(!result||result.schemaVersion!==SUITE_SCHEMA||JSON.stringify(result.request)!==JSON.stringify(request)||JSON.stringify(result.engine)!==JSON.stringify(CONTRACT)||JSON.stringify(result.units)!==JSON.stringify(UNITS)||!Array.isArray(result.points)||result.points.length!==request.temperatures.length)throw new Error('분석 묶음 응답/단위/점 수가 요청과 다릅니다.');
 for(let i=0;i<result.points.length;i++){
  const p=result.points[i];if(p.temperature!==request.temperatures[i]||!Array.isArray(p.entries)||p.entries.length!==3)throw new Error('온도/대상 응답이 누락·중복·재정렬되었습니다.');
  for(let j=0;j<3;j++){
   const e=p.entries[j],expected=childRequest(request,i,j),c=expected.conditions;
   if(e.kind!==request.targets[j].kind||JSON.stringify(e.record.request)!==JSON.stringify(expected))throw new Error('Fragment/좌표/조건 응답이 요청과 다릅니다.');
   const r=e.record;validateValue(r.duplex,'duplex',c,expected.strandA);
   validateValue(r.hairpinA,'hairpin',c,expected.strandA,request.includeHairpin&&j===0);
   validateValue(r.hairpinB,'hairpin',c,expected.strandB,request.includeHairpin&&j===0);
   const ref=r.duplexMgZeroReference;
   if(c.mg>0){
    if(!ref||ref.basis!=='Mg=0 reference'||typeof ref.note!=='string'||FIELDS.some(k=>ref.conditions?.[k]!==({...c,mg:0})[k]))throw new Error('Mg0 참고 조건이 입력과 다릅니다.');
    validateValue(ref.result,'duplex',ref.conditions,expected.strandA);
   }else if(ref!==null)throw new Error('Mg0에 중복 참고 결과가 있습니다.');
   if(!r.applied||r.applied.temperatureC!==c.temperature||r.applied.temperatureK!==c.temperature+273.15||r.applied.monoMm!==c.na+c.k+c.nh4||r.applied.mgTotalMm!==c.mg||r.applied.dntpTotalMm!==c.dntp||r.applied.hairpinAConcentrationNm!==c.a||r.applied.hairpinBConcentrationNm!==c.b||JSON.stringify(r.applied.duplexTmCorrection)!==JSON.stringify(r.duplex.tmCorrection??null)||!Array.isArray(r.limitations)||r.limitations.some(x=>typeof x!=='string'))throw new Error('적용값/한계 응답이 올바르지 않습니다.');
  }
 }
 return result;
}
export function suiteMetadata(result,input){
 const request={...result.request,source:metadata(result.request.source,input)};
 return {...result,request,points:result.points.map(p=>({...p,entries:p.entries.map(e=>({...e,record:{...e.record,request:metadata(e.record.request,input)}}))}))};
}
export function pointRecord(result,index=0){
 const point=result.points[index];if(!point)throw new Error('보관할 온도 행을 선택하세요.');
 return {...point.entries[0].record,suitePoint:{request:result.request,point,index},calculatedAt:result.calculatedAt,parentRaw:result.parentRaw};
}
export function compareFragments(candidate,base){
 if(!candidate||!base)return {dg:null,tm:null,notes:['대응하는 말단 결과가 미요청입니다.']};
 if(candidate.request.selection.length!==base.request.selection.length)return {dg:null,tm:null,notes:['말단 길이가 달라 변화량을 제공하지 않습니다.']};
 return compare(candidate,base);
}
