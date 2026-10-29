// SPDX-License-Identifier: GPL-2.0-or-later
import {makeRequest,freeze} from './analysis-core.mjs';
import {reverseComplement} from './sequence.mjs';
import {makePairSuite} from './pair-core.mjs';
import {makePCRReferenceRequests,summarizePCRReference} from './pcr-reference.mjs';
import {parsePairStructure} from './pair-structure.mjs';
import {parseHairpin} from './structure.mjs';
import {EXPECTED_MANIFEST_SHA256} from './engine/pair/release.mjs';
export const PAIR_UI_CONTRACT=Object.freeze({model:'primer3-py 2.3.1 THAL / THL_GENERAL / maxLoop30',
 engineVersion:'0.1.0-dev.1',abi:1,manifest:EXPECTED_MANIFEST_SHA256,
 wasm:'11b97cf94040c6f3a40515c1eb3d6f02b30d4263c3f8b824a124063b99cd6aec',basis:'primer3-api-reference'});
export const PAIR_NAMES=Object.freeze({'A-hairpin':'A hairpin','B-hairpin':'B hairpin','A-homodimer':'A/A homodimer',
 'B-homodimer':'B/B homodimer','AB-heterodimer':'A/B 결합 · ANY','A3-end':'A 3′ · B와 결합','B3-end':'B 3′ · A와 결합',
 'AA-3prime-reference':'A/A END','BB-3prime-reference':'B/B END','AB-A3-reference':'A 3′ END','AB-B3-reference':'B 3′ END'});
export const isPair=value=>value?.schemaVersion==='pair-workbench/1';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const numeric=s=>typeof s==='number'?Number.isFinite(s):typeof s==='string'&&/^[+]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(s.trim());
export function pairPartner(a,settings){
 if(settings.partnerMode==='complement')return reverseComplement(a);
 if(settings.partnerMode!=='manual')throw new Error('B 입력 방식을 확인하세요.');
 const b=String(settings.partnerRaw??'').replace(/\s/g,'').toUpperCase();
 if(!/^[ACGT]{2,60}$/.test(b))throw new Error('B는 A/C/G/T 2~60 nt를 5′→3′로 입력하세요. 자동 절삭하지 않습니다.');
 return b;
}
export function makeWorkbenchRequest(input,settings,requestId,revision){
 const source=makeRequest(input,requestId,revision),partner=pairPartner(source.strandA,settings);
 if(!numeric(settings.engineReferenceNm)||Number(settings.engineReferenceNm)<=0)throw new Error('Primer3 API 농도를 0보다 큰 유한한 nM 값으로 입력하세요. 실제 A/B와 별도입니다.');
 if(typeof settings.includeEnds!=='boolean'||typeof settings.includePCR!=='boolean')throw new Error('선택 분석의 요청을 확인하세요.');
 const name=String(settings.partnerName??'').trim();if(name.length>200)throw new Error('B 이름은 200자까지 입력할 수 있습니다.');
 const r={schemaVersion:'pair-workbench/1',requestId,revision,parent:source.parent,selection:source.selection,
  strandA:source.strandA,strandB:partner,role:source.role,memo:source.memo,conditions:source.conditions,
  partner:{mode:settings.partnerMode,name},options:{engineReferenceNm:Number(settings.engineReferenceNm),includeEnds:settings.includeEnds,includePCR:settings.includePCR},contract:{...PAIR_UI_CONTRACT}};
 workbenchPlans(r);return freeze(r);
}
export function workbenchPlans(r){
 if(!isPair(r)||!Number.isSafeInteger(r.requestId)||r.requestId<1||!Number.isSafeInteger(r.revision)||r.revision<0||!same(r.contract,PAIR_UI_CONTRACT))throw new Error('두 가닥 요청 버전/엔진이 일치하지 않습니다.');
 if(typeof r.strandA!=='string'||!/^[ACGT]{2,60}$/.test(r.strandA)||typeof r.strandB!=='string'||!/^[ACGT]{2,60}$/.test(r.strandB))throw new Error('각 가닥은 A/C/G/T 2~60 nt여야 합니다.');
 const s=r.selection,p=r.parent;
 if(!s||!p||!Number.isInteger(p.normalizedLength)||p.normalizedLength>10000||typeof p.name!=='string'||p.name.length>100000||!Number.isInteger(s.start)||!Number.isInteger(s.end)||s.start<1||s.end>p.normalizedLength||s.end-s.start+1!==r.strandA.length||s.length!==r.strandA.length)throw new Error('A 선택과 원본 좌표가 다릅니다.');
 if(!r.partner||!['complement','manual'].includes(r.partner.mode)||typeof r.partner.name!=='string'||r.partner.name.length>200||r.partner.mode==='complement'&&r.strandB!==reverseComplement(r.strandA))throw new Error('B 입력 방식/서열이 일치하지 않습니다.');
 if(typeof r.role!=='string'||r.role.length>200||typeof r.memo!=='string'||r.memo.length>2000||typeof r.options?.includeEnds!=='boolean'||typeof r.options?.includePCR!=='boolean')throw new Error('이름/메모/옵션을 확인하세요.');
 const c=r.conditions;if(!c||Object.keys(c).length!==8||!['temperature','na','k','nh4','mg','dntp','a','b'].every(k=>Number.isFinite(c[k]))||c.temperature<0||c.temperature>100)throw new Error('두 가닥 반응 조건이 올바르지 않습니다.');
 if(c.na+c.k+c.nh4===0&&c.mg<=c.dntp)throw new Error('THAL 염 보정은 단가염이0이고 Mg total이 dNTP total 이하인 조건을 지원하지 않습니다. 로그 정의역 문제이며 임의 Na를 넣지 않습니다.');
 const sourceContext={parentName:p.name,parentLength:p.normalizedLength,start:s.start,end:s.end,role:r.role,partnerName:r.partner.name,partnerMode:r.partner.mode};
 const actual=makePairSuite({strandA:r.strandA,strandB:r.strandB,physicalConditions:c,engineReferenceNm:r.options.engineReferenceNm,sourceContext,includeEnds:r.options.includeEnds}).requests;
 const reference=r.options.includePCR?makePCRReferenceRequests({strandA:r.strandA,strandB:r.strandB,physicalConditions:c,sourceContext}):[];
 return {actual,reference};
}
export const workbenchCount=r=>(r.options.includeEnds?7:5)+(r.options.includePCR?4:0);
export function validateWorkbenchResult(value,request){
 if(!isPair(value)||!same(value.request,request)||!same(value.engine,PAIR_UI_CONTRACT))throw new Error('두 가닥 응답의 요청/엔진 출처가 다릅니다.');
 const plans=workbenchPlans(request);
 for(const [key,requests] of [['entries',plans.actual],['referenceEntries',plans.reference]]){
  const entries=value[key];if(!Array.isArray(entries)||entries.length!==requests.length)throw new Error('분석 결과가 누락되었습니다.');
  for(let i=0;i<requests.length;i++){
   const q=requests[i],e=entries[i],r=e?.calculation;
   if(e?.analysisId!==q.analysisId||e?.reaction!==q.reaction||!r||r.schemaVersion!=='thal-pair/1'||!same(r.request,q)||r.mode!==q.mode||r.model!==PAIR_UI_CONTRACT.model||r.basis!==PAIR_UI_CONTRACT.basis||r.decisionUtility!=='not-established'||!same(r.appliedConditions,q.conditions))throw new Error('분석별 서열·모드·조건·근거가 요청과 다릅니다.');
   if(!same(r.units,{tm:'°C',dg:'kcal/mol',dh:'kcal/mol',ds:'cal/(mol·K)'}))throw new Error('두 가닥 응답 단위가 일치하지 않습니다.');
   if(!['ok','no-structure'].includes(r.status))throw new Error('알 수 없는 분석 상태입니다.');
   if(r.status==='ok'){
    const t=r.thermodynamics;if(!t||!['tm','dg','dh','ds'].every(k=>Number.isFinite(t[k]))||Math.abs(t.dg-(t.dh-(q.conditions.temperatureC+273.15)*t.ds/1000))>1e-8)throw new Error('두 가닥 에너지의 온도/수치 관계가 다릅니다.');
    if(typeof r.structure?.raw!=='string')throw new Error('구조 원문이 누락되었습니다.');
    const parsed=q.mode===4?parseHairpin(r.structure.raw,q.strandA):parsePairStructure(r.structure.raw,q.strandA,q.strandB,q.mode);
    if(!same(parsed,r.structure))throw new Error('반환 원문과 구조 좌표가 다릅니다.');
   }else if(r.thermodynamics!==undefined||r.structure!==undefined)throw new Error('구조 미검출에 수치를 만들 수 없습니다.');
  }
 }
 const summary=plans.reference.length?summarizePCRReference(value.referenceEntries):null;
 if(!same(value.pcrReference,summary))throw new Error('PCR 참고 집계가 네 END 결과와 다릅니다.');
 return value;
}
export async function executeWorkbench(request,run,onProgress=()=>{}){
 const plans=workbenchPlans(request),entries=[],referenceEntries=[];let completed=0;
 for(const [requests,target] of [[plans.actual,entries],[plans.reference,referenceEntries]])for(const q of requests){
  target.push({analysisId:q.analysisId,reaction:q.reaction,calculation:run(q)});onProgress(++completed,workbenchCount(request));
 }
 return validateWorkbenchResult({schemaVersion:'pair-workbench/1',request,engine:{...PAIR_UI_CONTRACT},entries,referenceEntries,
  pcrReference:referenceEntries.length?summarizePCRReference(referenceEntries):null},request);
}
export function decorateWorkbench(value,{parentRaw,calculatedAt}){
 const mapped=id=>{const r=value.entries.find(e=>e.analysisId===id).calculation;return {status:r.status,model:r.model,self:value.request.strandA===value.request.strandB,...r.thermodynamics,...(r.structure?{structure:r.structure.raw}:{})};};
 return {...value,parentRaw,calculatedAt,duplex:mapped('AB-heterodimer'),hairpinA:mapped('A-hairpin'),hairpinB:mapped('B-hairpin'),
  limitations:['명시한 Primer3 API 농도의 THAL 모델값이며 실제 A/B 혼합물 평형·결합률·속도·형광 예측이 아닙니다.',
   '입력 Mg/dNTP는 THAL 염 근사에 반영됩니다. 실제 Mg 조건의 에너지 오차는 충분히 검증되지 않았습니다.',
   '반환 정렬은 고정 mismatch·유일 구조·ensemble이 아닙니다. 선택 밖 원본 folding은 계산하지 않습니다.',
   'Hairpin의 기존 실측 차이와 후보 순위 한계는 유지됩니다. 서로 다른 반응의 에너지를 빼서 순결합 에너지로 만들지 않습니다.']};
}
export function compareWorkbench(candidate,base){
 const d={dg:null,tm:null,notes:[]};if(!base){d.notes.push('기준 결과를 선택하세요.');return d;}
 if(!isPair(candidate)||!isPair(base)){d.notes.push('NN4/말단/온도와 THAL 두 가닥 모델을 자동 차감하지 않습니다.');return d;}
 const a=candidate.request,b=base.request;
 const classification=r=>[r.partner.mode,r.strandA===r.strandB,r.strandA===reverseComplement(r.strandA)&&r.strandB===reverseComplement(r.strandB)];
 if(a.strandA===a.strandB||b.strandA===b.strandB){d.notes.push('동일 서열 A/B의 화학종 pooling 해석이 미확립이므로 자동 비교하지 않습니다.');return d;}
 if(!same(a.contract,b.contract)||!same(a.conditions,b.conditions)||a.options.engineReferenceNm!==b.options.engineReferenceNm||!same(classification(a),classification(b))){d.notes.push('같은 반응·모델·온도/이온·입력/API 농도에서만 A/B ANY의 변화량을 제공합니다.');return d;}
 if(candidate.duplex.status!=='ok'||base.duplex.status!=='ok'){d.notes.push('구조 미검출과 에너지0은 다르므로 차감하지 않습니다.');return d;}
 d.dg=candidate.duplex.dg-base.duplex.dg;d.tm=candidate.duplex.tm-base.duplex.tm;
 d.notes.push('A/B ANY 모델값의 후보−기준입니다. 작은 차이의 우열·실제 혼합물/속도는 검증되지 않았습니다.');return d;
}
