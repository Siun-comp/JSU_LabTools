// SPDX-License-Identifier: GPL-2.0-or-later
import {conditionsFromStrings,FIELDS} from './conditions.mjs';
import {reverseComplement} from './sequence.mjs';
import {freeze} from './analysis-core.mjs';
import {PAIR_UI_CONTRACT} from './pair-workbench-core.mjs';
import {parseHairpin} from './structure.mjs';
import {parsePairStructure} from './pair-structure.mjs';
import {validateRawInput} from './pair-loader.mjs';
import {beaconAnnotations} from './beacon-structure.mjs';
export const BEACON_CONTRACT=Object.freeze({...PAIR_UI_CONTRACT,component:'beacon-workbench/1'});
export const BEACON_IDS=['beacon-hairpin','target-hairpin','recognition-target-any','beacon-target-any'];
export const BEACON_NAMES=Object.freeze({'beacon-hairpin':'전체 Beacon hairpin','target-hairpin':'선택 Target hairpin',
 'recognition-target-any':'stem 제외 인식 조각–Target','beacon-target-any':'전체 Beacon–Target 정렬'});
export const isBeacon=value=>value?.schemaVersion==='beacon-workbench/1';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const blocked=(status,reason)=>({status,reason});
function dna(raw,label){
 if(typeof raw!=='string'||raw.length>10000)throw new Error(label+' 입력은10000자까지 지원합니다.');
 const sequence=raw.replace(/\s/g,'').toUpperCase();
 return {...(!sequence?blocked('not-requested',label+' 입력 필요'):!/^[ACGT]+$/.test(sequence)?blocked('invalid-input',label+'는 비변형 A/C/G/T만 입력하세요.'):blocked('ok','')),sequence};
}
export function captureSource(input,name,min){
 const parsed=input.parsed,selection=input.range?{...input.range}:null;
 const source={name:String(name||parsed?.name||'이름 없음').trim(),parentLength:parsed?.ok?parsed.seq.length:0,
  sequence:parsed?.ok&&selection&&!input.coordinateDraft?parsed.seq.slice(selection.start-1,selection.end):'',selection,
  coordinateDraft:Boolean(input.coordinateDraft),inputError:parsed?.ok?'':String(parsed?.error||'서열 입력을 확인하세요.')};
 return source;
}
function sourceState(s,label,min){
 if(!s||typeof s.name!=='string'||s.name.length>100000||!Number.isInteger(s.parentLength)||s.parentLength<0||s.parentLength>10000||typeof s.sequence!=='string'||s.sequence.length>10000||typeof s.inputError!=='string'||typeof s.coordinateDraft!=='boolean')throw new Error(label+' 출처가 올바르지 않습니다.');
 const selection=s.selection;
 if(s.inputError)return {...s,...blocked('invalid-input',label+': '+s.inputError)};
 if(s.coordinateDraft)return {...s,...blocked('invalid-input',label+' 양쪽 선택 좌표를 확정하세요.')};
 if(s.parentLength===0)return {...s,...blocked('not-requested',label+' 원본을 입력하세요.')};
 if(!selection||!Number.isInteger(selection.start)||!Number.isInteger(selection.end)||selection.start<1||selection.end>s.parentLength||selection.end<selection.start||selection.length!==selection.end-selection.start+1||s.sequence.length!==selection.length||!/^[ACGT]+$/.test(s.sequence))throw new Error(label+' 원본/선택/서열이 일치하지 않습니다.');
 return {...s,...(s.sequence.length<min||s.sequence.length>60?blocked('unsupported',label+` 계산 구간은${min}~60nt입니다. 자동 절삭하지 않습니다.`):blocked('ok',''))};
}
function derive(inputs){
 if(!['siteStartRaw','siteEndRaw'].every(k=>typeof inputs[k]==='string'&&inputs[k].length<=10000))throw new Error('Target site 입력을 확인하세요.');
 const recognition=sourceState(inputs.recognition,'인식 영역 R',3),target=sourceState(inputs.target,'Target',2);
 const s5=dna(inputs.stem5Raw,'5′ stem'),draft=dna(inputs.stem3Raw,'3′ stem');
 if(!['linked','manual'].includes(inputs.stem3Mode))throw new Error('3′ stem 입력 방식을 확인하세요.');
 const s3=inputs.stem3Mode==='linked'?{...s5,sequence:s5.status==='ok'?reverseComplement(s5.sequence):''}:draft;
 const r=recognition.sequence,validR=/^[ACGT]{3,}$/.test(r)&&!recognition.coordinateDraft&&!recognition.inputError;
 const well=s5.status==='ok'&&s3.status==='ok'&&validR;
 const sequence=well?s5.sequence+r+s3.sequence:'',a=s5.sequence.length,b=s3.sequence.length,N=sequence.length;
 const canonical=well&&a===b&&s3.sequence===reverseComplement(s5.sequence);
 const assembly={...(well?blocked('ok',''):[s5,s3,recognition].find(s=>s.status!=='ok')||blocked('invalid-input','Beacon 조립을 확인하세요.')),
  sequence,a,b,length:N,regions:well?{S5:[1,a],R:[a+1,a+r.length],S3:[a+r.length+1,N]}:null,
  canonical,expectedPairs:canonical?Array.from({length:a},(_,i)=>({left:i+1,right:N-i})):[]};
 if(!['auto','explicit','unspecified'].includes(inputs.siteMode))throw new Error('Target site 방식을 확인하세요.');
 let site={mode:inputs.siteMode,status:'unspecified',start:null,end:null,complementary:null,reason:'의도 Target site 미지정'};
 if(inputs.siteMode==='auto'&&r&&target.sequence.length===r.length)site={...site,status:'defined',start:1,end:r.length,reason:'길이가 같은 선택 Target 전체 대응 가정'};
 if(inputs.siteMode==='explicit'){
  const u=Number(inputs.siteStartRaw),v=Number(inputs.siteEndRaw);
  if(!String(inputs.siteStartRaw).trim()||!String(inputs.siteEndRaw).trim()||!Number.isInteger(u)||!Number.isInteger(v)||u<1||v>target.sequence.length||v-u+1!==r.length||!r)site={...site,status:'invalid',reason:'의도 site는 선택 Target 안에서 R과 같은 길이여야 합니다.'};
  else site={...site,status:'defined',start:u,end:v,reason:'사용자 지정 site'};
 }
 if(site.status==='defined')site.complementary=target.sequence.slice(site.start-1,site.end)===reverseComplement(r);
 if(typeof inputs.apiRaw!=='string'||inputs.apiRaw.length>10000)throw new Error('API 입력을 확인하세요.');
 const apiValue=Number(inputs.apiRaw),apiValid=/^[+]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(inputs.apiRaw.trim())&&Number.isFinite(apiValue)&&apiValue>0;
 return {recognition,target:{...target,origin:inputs.targetOrigin,generatedFromRecognition:inputs.generatedFromRecognition,
  generatedStale:Boolean(inputs.generatedFromRecognition&&inputs.generatedFromRecognition!==r)},s5,s3,assembly,site,
  api:{raw:inputs.apiRaw,value:apiValid?apiValue:null,...(apiValid?blocked('ok',''):blocked('invalid-input','명시적 API 농도를0보다 큰 유한한 nM로 입력하세요.'))}};
}
export function makeBeaconRequest(input,settings,requestId,revision){
 const c=conditionsFromStrings(input.conditions);if(c.temperature<0||c.temperature>100)throw new Error('반응 온도는0~100°C입니다.');
 if(c.monoMm===0&&c.mg<=c.dntp)throw new Error('THAL 염 로그 정의역: 단가염0·Mg≤dNTP 조건을 지원하지 않습니다. 임의 Na를 넣지 않습니다.');
 const inputs={recognition:captureSource(input,input.parentName,3),target:captureSource(settings.target,settings.target.name,2),
  targetOrigin:settings.target.origin||'user-entered',generatedFromRecognition:settings.target.generatedFromRecognition||null,
  stem5Raw:settings.stem5Raw,stem3Raw:settings.stem3Raw,stem3Mode:settings.stem3Mode,apiRaw:settings.apiRaw,
  siteMode:settings.siteMode,siteStartRaw:settings.siteStartRaw,siteEndRaw:settings.siteEndRaw};
 const design=derive(inputs),request={schemaVersion:'beacon-workbench/1',requestId,revision,designType:'conventional',inputs,design,
  parent:{name:design.recognition.name,normalizedLength:design.recognition.parentLength},selection:design.recognition.selection,
  role:String(input.role||'').trim(),memo:String(input.memo||'').trim(),conditions:Object.fromEntries(FIELDS.map(k=>[k,c[k]])),contract:{...BEACON_CONTRACT}};
 beaconPlans(request);return freeze(request);
}
export function beaconPlans(r){
 if(!isBeacon(r)||!Number.isSafeInteger(r.requestId)||r.requestId<1||!Number.isSafeInteger(r.revision)||r.revision<0||r.designType!=='conventional'||!same(r.contract,BEACON_CONTRACT))throw new Error('Beacon 요청/엔진 계약이 다릅니다.');
 const c=conditionsFromStrings(r.conditions);if(FIELDS.some(k=>typeof r.conditions[k]!=='number')||Object.keys(r.conditions).length!==8||c.temperature<0||c.temperature>100||c.monoMm===0&&c.mg<=c.dntp)throw new Error('Beacon 온도/염 조건을 확인하세요.');
 if(!['user-entered','generated-from-recognition','edited-generated'].includes(r.inputs.targetOrigin)||r.inputs.generatedFromRecognition!==null&&(typeof r.inputs.generatedFromRecognition!=='string'||!/^[ACGT]{3,60}$/.test(r.inputs.generatedFromRecognition)))throw new Error('Target 생성 출처를 확인하세요.');
 if(typeof r.role!=='string'||r.role.length>200||typeof r.memo!=='string'||r.memo.length>2000||!same(derive(r.inputs),r.design)||!same(r.parent,{name:r.design.recognition.name,normalizedLength:r.design.recognition.parentLength})||!same(r.selection,r.design.recognition.selection))throw new Error('Beacon 조립/좌표/입력 snapshot이 다릅니다.');
 const d=r.design,B=d.assembly,T=d.target,R=d.recognition;
 const full=B.status!=='ok'?B:B.length>60?blocked('unsupported','전체 Beacon은60nt까지입니다. 조립 서열을 자르지 않습니다.'):blocked('ok','');
 const deps=parts=>parts.find(p=>p.status!=='ok')||blocked('ok','');
 const specs=[['beacon-hairpin',4,B.sequence,B.sequence,c.a,'Beacon hairpin',full],['target-hairpin',4,T.sequence,T.sequence,c.b,'Target hairpin',T],
  ['recognition-target-any',1,R.sequence,T.sequence,d.api.value,'independent R + Target',deps([R,T,d.api])],
  ['beacon-target-any',1,B.sequence,T.sequence,d.api.value,'Beacon + Target',deps([full,T,d.api])]];
 return specs.map(([analysisId,mode,strandA,strandB,conc,reaction,availability])=>{
  if(availability.status!=='ok')return {analysisId,status:availability.status,reason:availability.reason,request:null};
  const q={analysisId,mode,strandA,strandB,showStructure:true,reaction,purpose:'conventional-beacon-model-reference',
   conditions:{temperatureC:c.temperature,monovalentMm:c.monoMm,magnesiumMm:c.mg,dntpMm:c.dntp,dnaConcentrationNm:conc},
   actualMixtureInterpretation:mode===4?'single-molecule-concentration-independent':'not-established',
   input1Role:analysisId==='recognition-target-any'?'independent-recognition-fragment':analysisId==='target-hairpin'?'selected-target':'assembled-beacon',
   input2Role:mode===4?'same-molecule-buffer':'selected-target',
   physicalInput:{beaconSequence:B.sequence||null,recognitionSequence:R.sequence||null,targetSequence:T.sequence||null,conditions:r.conditions,
    sourceContext:{parentR:r.parent.name,rStart:r.selection?.start??null,rEnd:r.selection?.end??null,parentTarget:T.name,targetStart:T.selection?.start??null,targetEnd:T.selection?.end??null}}};
  validateRawInput(q);return {analysisId,status:'ready',reason:'',request:q};
 });
}
export const beaconCount=r=>beaconPlans(r).filter(p=>p.status==='ready').length;
function verifyCalculation(v,q){
 if(!v||v.schemaVersion!=='thal-pair/1'||v.mode!==q.mode||!same(v.request,q)||v.model!==BEACON_CONTRACT.model||v.basis!==BEACON_CONTRACT.basis||v.decisionUtility!=='not-established'||!same(v.appliedConditions,q.conditions)||!same(v.units,{tm:'°C',dg:'kcal/mol',dh:'kcal/mol',ds:'cal/(mol·K)'}))throw new Error('Beacon 분석의 입력·모드·조건·출처·단위가 다릅니다.');
 if(!['ok','no-structure'].includes(v.status))throw new Error('Beacon native 상태를 확인할 수 없습니다.');
 if(v.status==='no-structure'){if(v.thermodynamics!==undefined||v.structure!==undefined)throw new Error('미검출에 수치를 넣을 수 없습니다.');return;}
 const t=v.thermodynamics;if(!t||!['tm','dg','dh','ds'].every(k=>Number.isFinite(t[k]))||Math.abs(t.dg-(t.dh-(q.conditions.temperatureC+273.15)*t.ds/1000))>1e-8)throw new Error('Beacon 에너지/온도 관계가 다릅니다.');
 if(typeof v.structure?.raw!=='string')throw new Error('Beacon 구조 원문 누락');
 const parsed=q.mode===4?parseHairpin(v.structure.raw,q.strandA):parsePairStructure(v.structure.raw,q.strandA,q.strandB,q.mode);
 if(!same(parsed,v.structure))throw new Error('Beacon 원문/구조 좌표가 다릅니다.');
}
export async function executeBeacon(request,run,onProgress=()=>{}){
 const entries=[],plans=beaconPlans(request),total=plans.filter(p=>p.status==='ready').length;let done=0;
 for(const p of plans){if(p.status!=='ready')entries.push({analysisId:p.analysisId,status:p.status,reason:p.reason});else{
  const calculation=run(p.request);entries.push({analysisId:p.analysisId,status:calculation.status,reason:'',calculation});onProgress(++done,total);
 }}
 return validateBeaconResult({schemaVersion:'beacon-workbench/1',request,engine:{...BEACON_CONTRACT},entries,annotations:beaconAnnotations(request,entries)},request);
}
export function validateBeaconResult(v,request){
 if(!isBeacon(v)||!same(v.request,request)||!same(v.engine,BEACON_CONTRACT)||!Array.isArray(v.entries)||v.entries.length!==4)throw new Error('Beacon 응답/요청/엔진이 다릅니다.');
 const plans=beaconPlans(request);
 for(let i=0;i<4;i++){
  const e=v.entries[i],p=plans[i];if(e?.analysisId!==p.analysisId)throw new Error('Beacon 분석 순서/개수 오류');
  if(p.status==='ready'){verifyCalculation(e.calculation,p.request);if(e.status!==e.calculation.status||e.reason!=='')throw new Error('분석 상태가 다릅니다.');}
  else if(e.status!==p.status||e.reason!==p.reason||e.calculation!==undefined)throw new Error('미실행 분석에 수치/상태를 만들 수 없습니다.');
 }
 if(!same(v.annotations,beaconAnnotations(request,v.entries)))throw new Error('Beacon 구조/정렬 파생값이 원본과 다릅니다.');return v;
}
export function decorateBeacon(v,{parentRaw,targetRaw,calculatedAt}){return {...v,parentRaw,targetRaw,calculatedAt,
 limitations:['입력 온도/Mg의 고정 THAL 근사 모델값입니다. 실제 Mg 에너지·hairpin 후보 순위 정확도는 미확립입니다.',
  'stem 제외 인식 조각은 별도 선형 가닥 가정입니다. 실제 Beacon 결합이 stem과 무관하다는 뜻이 아닙니다.',
  '전체 Beacon–Target은 분자간 반환 정렬이며 남은 분자내 구조/경쟁 상태의 전체 평형 계산이 아닙니다.',
  '지정 구조 일치는 반환 pair의 대응입니다. closed 확률·개방 비용·순결합 ΔG·속도·형광을 계산하지 않습니다.',
  '선택 밖 부모R/Target folding·표지/quencher·RNA/변형염기/첨가제/효소 효과는 포함하지 않습니다.']};}
export function compareBeacon(candidate,base){
 const out={notes:[],analyses:Object.fromEntries(BEACON_IDS.map(id=>[id,{dg:null,tm:null,reason:''}]))};
 let reason='';if(!base)reason='기준 결과를 선택하세요.';else if(!isBeacon(candidate)||!isBeacon(base))reason='Beacon과 다른 작업/반응의 모델값은 자동 차감하지 않습니다.';
 else{const a=candidate.request,b=base.request,x=a.design,y=b.design;
  if(!same(a.contract,b.contract)||!same(a.conditions,b.conditions)||x.recognition.sequence!==y.recognition.sequence||x.target.sequence!==y.target.sequence||!same(x.site,y.site)||x.api.value!==y.api.value)reason='같은 R/Target/site·모델·온도/이온·실제/API 농도에서만 후보−기준을 제공합니다.';
 }
 if(reason){out.notes.push(reason);for(const v of Object.values(out.analyses))v.reason=reason;return out;}
 for(const id of BEACON_IDS){const a=candidate.entries.find(e=>e.analysisId===id),b=base.entries.find(e=>e.analysisId===id),d=out.analyses[id];
  if(a.status!=='ok'||b.status!=='ok')d.reason='미실행/미검출은0과 다르므로 차감하지 않습니다.';
  else if(id==='beacon-hairpin'&&[candidate,base].some(v=>v.annotations.stem.status!=='exact-intended'))d.reason='지정 stem과 정확히 일치한 두 구조끼리만 closed 참고 변화량을 제공합니다.';
  else if(id.endsWith('-any')){
   const k=id==='beacon-target-any'?'beaconTarget':'recognitionTarget';
   const classification=e=>[e.calculation.request.strandA===e.calculation.request.strandB,e.calculation.request.strandA===reverseComplement(e.calculation.request.strandA)&&e.calculation.request.strandB===reverseComplement(e.calculation.request.strandB)];
   if(candidate.annotations[k].status!=='intended-only'||base.annotations[k].status!=='intended-only')d.reason='의도 site의 완전 WC 정렬만 비교합니다. 다른 접촉/불일치/미지정은 원값만 제공합니다.';
   else if(classification(a)[0]||classification(b)[0]||!same(classification(a),classification(b)))d.reason='동일 서열 pooling/농도 분기가 달라 자동 비교하지 않습니다.';
  }
  if(!d.reason){d.dg=a.calculation.thermodynamics.dg-b.calculation.thermodynamics.dg;d.tm=a.calculation.thermodynamics.tm-b.calculation.thermodynamics.tm;}
 }
 out.notes.push('각 반응의 후보−기준 모델값입니다. 반응 간 차감·자동 순위·실제 성공/속도/형광 예측이 아닙니다.');return out;
}
