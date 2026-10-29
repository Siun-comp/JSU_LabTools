// SPDX-License-Identifier: GPL-2.0-or-later
import {conditionsFromStrings,FIELDS} from './conditions.mjs';
import {freeze} from './analysis-core.mjs';
import {PAIR_UI_CONTRACT} from './pair-workbench-core.mjs';
import {validateRawInput} from './pair-loader.mjs';
import {parseHairpin} from './structure.mjs';
import {parsePairStructure} from './pair-structure.mjs';
import {FIXED_CONTRACT,calculateFixed,fixedGeometry} from './fixed-nn.mjs';
export const RELATION_CONTRACT=Object.freeze({...PAIR_UI_CONTRACT,component:'relationship-workbench/1'});
export const RELATION_IDS=['A-hairpin','B-hairpin','AB-any'];
export const RELATION_NAMES={'A-hairpin':'A hairpin','B-hairpin':'B hairpin','AB-any':'A/B 정렬 · ANY'};
export const isRelationshipRecord=r=>Boolean(r?.row&&['relationship-record/1','fixed-alignment/1'].includes(r.schemaVersion));
export const isFixedRecord=r=>isRelationshipRecord(r)&&r.schemaVersion==='fixed-alignment/1';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const failed=(status,reason)=>({status,reason});
export function sourceState(s,label){
 if(!s||typeof s.name!=='string'||s.name.length>100000||typeof s.inputError!=='string'||typeof s.sequence!=='string'||s.sequence.length>10000||!Number.isInteger(s.parentLength)||s.parentLength<0||s.parentLength>10000||typeof s.coordinateDraft!=='boolean'||!['user-entered','generated-complement','edited-generated','imported-selection','edited-import'].includes(s.origin)||s.generatedFrom!==null&&(typeof s.generatedFrom!=='string'||!/^[ACGT]{1,10000}$/.test(s.generatedFrom)))throw Error(label+' 원본 출처 오류');
 if(s.inputError)return {...s,...failed('invalid-input',label+': '+s.inputError)};
 if(s.coordinateDraft)return {...s,...failed('invalid-input',label+' 양쪽 좌표를 확정하세요.')};
 if(!s.parentLength)return {...s,...failed('not-requested',label+' 원본을 입력하세요.')};
 const q=s.selection;if(!q||!Number.isInteger(q.start)||!Number.isInteger(q.end)||q.start<1||q.end>s.parentLength||q.end<q.start||q.length!==q.end-q.start+1||q.length!==s.sequence.length||!/^[ACGT]+$/.test(s.sequence))throw Error(label+' 원본/좌표/서열 불일치');
 return {...s,...(q.length<2||q.length>60?failed('unsupported',label+' 계산 조각은2~60nt입니다. 자동 절삭하지 않습니다.'):failed('ok',''))};
}
const validNumeric=s=>typeof s==='string'&&/^[+]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(s.trim())&&Number.isFinite(Number(s))&&Number(s)>0;
export function normalizeRow(row,common){
 if(!row||!/^relation-[1-9]\d*$/.test(row.id)||typeof row.name!=='string'||row.name.length>200||typeof row.role!=='string'||row.role.length>200||typeof row.override!=='boolean'||typeof row.includeTHAL!=='boolean'||![row.apiRaw,row.refRaw,row.aRaw,row.bRaw].every(s=>typeof s==='string'&&s.length<=10000))throw Error('관계 입력 계약 오류');
 const a=sourceState(row.sourceA,'A'),b=sourceState(row.sourceB,'B');let conditions=null,error='';
 try{const c=conditionsFromStrings({...common,...(row.override?{a:row.aRaw,b:row.bRaw}:{})});conditions=Object.fromEntries(FIELDS.map(k=>[k,c[k]]));}catch(e){error='관계별 실제 농도: '+e.message;}
 return {id:row.id,name:row.name,role:row.role,a,b,override:row.override,physicalDraft:{a:row.aRaw,b:row.bRaw},conditions,conditionsError:error,
  api:{raw:row.apiRaw,value:validNumeric(row.apiRaw)?Number(row.apiRaw):null},refRaw:row.refRaw,includeTHAL:row.includeTHAL};
}
export function makeRelationshipRequest(rows,common,{requestId,revision,setId,scope='selected',submode='relationship',memo=''}){
 const c=conditionsFromStrings(common);if(c.temperature<0||c.temperature>100)throw Error('반응 온도는0~100°C입니다.');
 if(!['selected','all'].includes(scope)||!['relationship','fixed'].includes(submode)||!Array.isArray(rows)||rows.length<1||rows.length>4||scope==='selected'&&rows.length!==1||submode==='fixed'&&(scope!=='selected'||rows.length!==1))throw Error('관계 작업 범위 오류');
 const conditions=Object.fromEntries(FIELDS.map(k=>[k,c[k]]));
 const q={schemaVersion:submode==='fixed'?'fixed-alignment/1':'relationship-workbench/1',requestId,revision,setId,scope,submode,memo,conditions,inputs:structuredClone(rows),rows:structuredClone(rows).map(r=>normalizeRow(r,conditions)),contract:{...RELATION_CONTRACT},fixedContract:{...FIXED_CONTRACT}};
 relationshipPlans(q);return freeze(q);
}
export function relationshipPlans(q){
 if(!q||!['relationship-workbench/1','fixed-alignment/1'].includes(q.schemaVersion)||!Number.isSafeInteger(q.requestId)||q.requestId<1||!Number.isSafeInteger(q.revision)||q.revision<0||typeof q.setId!=='string'||q.setId.length>100||typeof q.memo!=='string'||q.memo.length>2000||!same(q.contract,RELATION_CONTRACT)||!same(q.fixedContract,FIXED_CONTRACT))throw Error('관계 요청/엔진 계약 오류');
 const c=conditionsFromStrings(q.conditions);if(c.temperature<0||c.temperature>100||FIELDS.some(k=>typeof q.conditions[k]!=='number')||Object.keys(q.conditions).length!==8)throw Error('공통 조건 계약 오류');
 if(!['selected','all'].includes(q.scope)||!['relationship','fixed'].includes(q.submode)||q.schemaVersion!==(q.submode==='fixed'?'fixed-alignment/1':'relationship-workbench/1')||!Array.isArray(q.inputs)||q.inputs.length<1||q.inputs.length>4||q.scope==='selected'&&q.inputs.length!==1||q.submode==='fixed'&&(q.scope!=='selected'||q.inputs.length!==1)||new Set(q.inputs.map(r=>r.id)).size!==q.inputs.length||!same(q.rows,q.inputs.map(r=>normalizeRow(r,q.conditions))))throw Error('관계 ID/원본 snapshot 오류');
 return q.rows.map(row=>({row,native:plansForRow(row,q.submode)}));
}
function plansForRow(row,mode){
 const disabled=mode==='fixed'&&!row.includeTHAL,c=row.conditions,logInvalid=c&&c.na+c.k+c.nh4===0&&c.mg<=c.dntp;
 return RELATION_IDS.map((id,i)=>{
  let unavailable=disabled?failed('not-requested','THAL 참고 미요청'):row.conditionsError?failed('invalid-input',row.conditionsError):logInvalid?failed('unsupported','THAL 염 로그 정의역: 단가염0·Mg≤dNTP 미지원'):i===0?row.a:i===1?row.b:[row.a,row.b].find(s=>s.status!=='ok')||{status:'ok'};
  if(unavailable.status==='ok'&&i===2&&row.api.value===null)unavailable=failed('invalid-input','명시적 THAL API 농도를 유한한 양수로 입력하세요.');
  if(unavailable.status!=='ok')return {analysisId:id,status:unavailable.status,reason:unavailable.reason,request:null};
  const request={analysisId:id,mode:i<2?4:1,strandA:i===1?row.b.sequence:row.a.sequence,strandB:i===0?row.a.sequence:row.b.sequence,showStructure:true,
   conditions:{temperatureC:c.temperature,monovalentMm:c.na+c.k+c.nh4,magnesiumMm:c.mg,dntpMm:c.dntp,dnaConcentrationNm:i===0?c.a:i===1?c.b:row.api.value},
   input1Role:i===1?'selected-B':'selected-A',input2Role:i<2?'same-molecule-buffer':'selected-B',actualMixtureInterpretation:i<2?'single-molecule-concentration-independent':'not-established',
   physicalInput:{conditions:c,sourceA:row.a,sourceB:row.b,relationId:row.id,role:row.role},purpose:'independent-fragment-relationship-reference'};
  validateRawInput(request);return {analysisId:id,status:'ready',reason:'',request};
 });
}
export function relationshipWorkCount(q){return relationshipPlans(q).reduce((n,p)=>n+p.native.filter(e=>e.status==='ready').length+(q.submode==='fixed'&&p.row.conditions&&!p.row.conditionsError&&p.row.a.status==='ok'&&p.row.b.status==='ok'&&fixedGeometry(p.row.a.sequence,p.row.b.sequence).status==='ok'&&p.row.conditions.na/1000>0?2:0),0);}
function fixedForRow(row,parameters){
 if(row.a.status!=='ok'||row.b.status!=='ok'||!row.conditions){const reason=[row.a,row.b].find(s=>s.status!=='ok')?.reason||row.conditionsError;const geometry=fixedGeometry(row.a.sequence,row.b.sequence,row.a,row.b);return {geometry,pmGeometry:fixedGeometry(row.a.sequence,geometry.referenceB,row.a,null),contract:{...FIXED_CONTRACT},pm:failed('not-executed',reason),mm:failed('not-executed',reason),comparison:{dg:null,tm:null,reason}};}
 return calculateFixed(row.a.sequence,row.b.sequence,row.conditions,row.refRaw,parameters,row.a,row.b);
}
export async function executeRelationship(q,run,parameters,onProgress=()=>{}){
 const plans=relationshipPlans(q),records=[],total=relationshipWorkCount(q);let completed=0;
 for(const {row,native} of plans){const entries=[];
  for(const p of native){if(p.status!=='ready')entries.push({analysisId:p.analysisId,status:p.status,reason:p.reason});else{const calculation=run(p.request);entries.push({analysisId:p.analysisId,status:calculation.status,reason:'',calculation});onProgress(++completed,total);}}
  const r={schemaVersion:q.submode==='fixed'?'fixed-alignment/1':'relationship-record/1',request:q,row,entries};
  if(q.submode==='fixed'){r.fixed=fixedForRow(row,parameters);if(total>completed){onProgress(++completed,total);onProgress(++completed,total);}}
  records.push(r);
 }
 return validateRelationshipResult({schemaVersion:q.schemaVersion,request:q,records},q,parameters);
}
function verifyCalc(v,expected){
 if(!v||v.schemaVersion!=='thal-pair/1'||!same(v.request,expected)||v.model!==RELATION_CONTRACT.model||v.basis!==RELATION_CONTRACT.basis||v.decisionUtility!=='not-established'||v.mode!==expected.mode||!same(v.appliedConditions,expected.conditions)||!same(v.units,{tm:'°C',dg:'kcal/mol',dh:'kcal/mol',ds:'cal/(mol·K)'}))throw Error('관계 분석 입력/단위/엔진 오류');
 if(v.status==='no-structure'){if(v.thermodynamics!==undefined||v.structure!==undefined)throw Error('미검출에 허위 수치/구조');return;}
 const t=v.thermodynamics;if(v.status!=='ok'||!t||!['dg','dh','ds','tm'].every(k=>Number.isFinite(t[k]))||Math.abs(t.dg-t.dh+(expected.conditions.temperatureC+273.15)*t.ds/1000)>1e-8)throw Error('관계 에너지/온도 오류');
 if(typeof v.structure?.raw!=='string')throw Error('구조 원문 누락');const s=expected.mode===4?parseHairpin(v.structure.raw,expected.strandA):parsePairStructure(v.structure.raw,expected.strandA,expected.strandB,expected.mode);if(!same(s,v.structure))throw Error('관계 원문/좌표 불일치');
}
export function validateRelationshipResult(v,q,parameters){
 const plans=relationshipPlans(q);if(!v||v.schemaVersion!==q.schemaVersion||!same(v.request,q)||!Array.isArray(v.records)||v.records.length!==plans.length)throw Error('관계 응답/개수 오류');
 for(let j=0;j<plans.length;j++){const r=v.records[j],p=plans[j];if(r.schemaVersion!==(q.submode==='fixed'?'fixed-alignment/1':'relationship-record/1')||!same(r.request,q)||!same(r.row,p.row)||r.entries?.length!==3)throw Error('관계 응답 출처 오류');
  for(let i=0;i<3;i++){const e=r.entries[i],z=p.native[i];if(e.analysisId!==z.analysisId)throw Error('관계 항목 순서 오류');if(z.status==='ready'){verifyCalc(e.calculation,z.request);if(e.status!==e.calculation.status||e.reason!=='')throw Error('관계 상태 오류');}else if(e.status!==z.status||e.reason!==z.reason||e.calculation!==undefined)throw Error('관계 미실행 필드 오류');}
  if(q.submode==='fixed'){if(!same(r.fixed,fixedForRow(p.row,parameters)))throw Error('고정 정렬/항별 합산/조건/차이 불일치');}else if(r.fixed!==undefined)throw Error('미요청 fixed 결과');
 }return v;
}
export function decorateRelationship(r,{rawA,rawB,calculatedAt}){return {...r,rawA,rawB,calculatedAt,limitations:[
 '선택한 각 조각은 독립 가닥입니다. 선택 밖/연결된 전체 분자와 전체 반응망을 계산하지 않습니다.',
 'THAL은 입력 온도/이온의 원본 근사·반환 정렬입니다. 실제 A/B 혼합물 Tm·후보 순위·속도/형광의 정확도는 미확립입니다.',
 '고정 정렬은 지정 대응의 NN3/IMM·Na-only/Mg0 참고입니다. 기존 NN4/THAL/hairpin과 직접 차감하지 않습니다.',
 'pH/표지/효소·말단/다중 mismatch·closed분율/개방비용/속도/형광은 계산하지 않습니다.']};}
