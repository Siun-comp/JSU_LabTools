// SPDX-License-Identifier: GPL-2.0-or-later
import {conditionsFromStrings,FIELDS} from './conditions.mjs';
import {reverseComplement} from './sequence.mjs';
export const UI_VERSION='0.1.0-beta.1';
export const CONTRACT=Object.freeze({
 engineVersion:'0.1.0-dev.1',hairpin:'primer3-py 2.3.1 THAL / THL_GENERAL / maxLoop30',
 duplex:'DNA_NN4 / SantaLucia entropy salt / ΔCp=0',
 duplexMgTm:'DNA_NN4 / Owczarzy2008 inverse-Tm / Mg-dNTP Ka=3e4 M^-1',
 duplexReference:'Mg=0 reference / same remaining inputs / excluded input Mg effect',
 manifest:'44c1f17023bdc3c2cd86b2ebcfd474d376a887b188122c0c0b16c57ba4cad7cd',
 wasm:'41ff0809bde1179cf5810efc31200a766ec410a8b2e5be5ad510580e773a02d8',
 duplexSHA:'bad83bc851462a98a42da7c50207bf8899fb7121992389cf046db24b7255e884',
 sequenceSHA:'ee219c8cfcb51aec92b1665dbb80e5fae36bfb78ad46190350decedff5cb9b98'
});
export function freeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){for(const v of Object.values(value))freeze(v);Object.freeze(value);}return value;}
export function validateRequest(r){
 if(!r||r.schemaVersion!=='0.4'||!Number.isSafeInteger(r.requestId)||r.requestId<1||!Number.isSafeInteger(r.revision)||r.revision<0)throw new Error('요청 버전/번호가 올바르지 않습니다.');
 if(JSON.stringify(r.contract)!==JSON.stringify(CONTRACT))throw new Error('요청과 엔진의 버전/해시가 다릅니다.');
 const a=r.strandA,b=r.strandB,s=r.selection,p=r.parent;
 if(typeof a!=='string'||!/^[ACGT]{2,60}$/.test(a)||b!==reverseComplement(a))throw new Error('계산은 A/C/G/T 2~60 nt와 완전 상보 B를 지원합니다.');
 if(!s||!p||!Number.isInteger(p.normalizedLength)||p.normalizedLength<1||p.normalizedLength>10000||typeof p.name!=='string'||p.name.length>100000||!Number.isInteger(s.start)||!Number.isInteger(s.end)||s.start<1||s.end>p.normalizedLength||s.length!==a.length||s.end-s.start+1!==a.length)throw new Error('원본과 선택 좌표의 관계가 올바르지 않습니다.');
 if(typeof r.role!=='string'||r.role.length>200||typeof r.memo!=='string'||r.memo.length>2000)throw new Error('이름/역할/메모 범위를 확인하세요.');
 const c=conditionsFromStrings(r.conditions??{});
 if(c.temperature<0||c.temperature>100)throw new Error('현재 계산 입력 온도는 0~100°C입니다. 실측 정확도 검증 범위를 뜻하지 않습니다.');
 if(FIELDS.some(k=>typeof r.conditions[k]!=='number'))throw new Error('확정한 수치 조건이 필요합니다.');
 return r;
}
export function makeRequest(input,requestId,revision){
 if(!input.parsed.ok||!input.parsed.seq||!input.range||input.coordinateDraft)throw new Error('유효한 서열과 확정한 선택 좌표가 필요합니다.');
 const {start,end,length}=input.range;
 if(length<2||length>60)throw new Error('계산은 A/C/G/T 2~60 nt와 완전 상보 B를 지원합니다.');
 const a=input.parsed.seq.slice(start-1,end),c=conditionsFromStrings(input.conditions);
 return freeze(validateRequest({schemaVersion:'0.4',requestId,revision,parent:{name:input.parentName.trim()||input.parsed.name||'이름 없음',normalizedLength:input.parsed.seq.length},selection:{start,end,length},strandA:a,strandB:reverseComplement(a),role:input.role.trim(),memo:input.memo.trim(),conditions:Object.fromEntries(FIELDS.map(k=>[k,c[k]])),contract:{...CONTRACT}}));
}
export function inputKey(i){return JSON.stringify([i.raw,i.range?.start,i.range?.end,Boolean(i.coordinateDraft),FIELDS.map(k=>i.conditions[k])]);}
export function metadata(r,i){return {...r,parent:{...r.parent,name:i.parentName.trim()||i.parsed.name||'이름 없음'},role:i.role.trim(),memo:i.memo.trim()};}
export function limitations(r){
 const c=r.conditions,notes=['표준 비변형 DNA의 모델 예측값입니다. 실제 반응 속도·효율·형광을 예측하지 않습니다.','Hairpin은 Primer3 THAL 선택 구조이며 ensemble 접근성/전체 분자 folding이 아닙니다. 구조 미검출은 모든 접힘이 없다는 뜻이 아닙니다.','Duplex는 별도 DNA_NN4 고정 정렬 모델이며 ΔG°(T)는 1 M 표준상태·ΔCp=0 근사입니다.','원본의 선택 밖 서열·수정/표지·첨가제·효소 효과는 계산에 포함하지 않습니다.'];
 if(c.k+c.nh4>0)notes.push('K⁺/NH₄⁺는 단가 이온 합산 근사이며 해당 이온별 실측 성능을 검증하지 않았습니다.');
 if(c.mg>0)notes.push('입력 Mg 조건의 duplex는 보정 Tm만 제공합니다. 별도의 Mg=0 참고 ΔG/ΔH/ΔS/Tm은 입력 Mg 효과를 제외한 값입니다. Mg 조건의 ΔΔG로 사용하지 않습니다. Hairpin은 별도 Primer3 Mg/dNTP 염 근사입니다.');
 if(c.mg===0&&c.dntp>0)notes.push('Mg=0에서 dNTP의 독립적인 효과는 모델에 포함하지 않습니다.');
 if(c.temperature<20||c.temperature>75)notes.push('현재 온도는 초기 구현 대조의 대표 온도20~75°C 밖입니다. 계산 입력 범위와 실측 평가 범위는 다릅니다.');
 notes.push('실측 예측 성능은 제한된 자료의 평가입니다. Hairpin12건/약75 mM의 Tm MAE14.73°C 등 알려진 차이를 계산 근거에서 확인하세요.');
 return notes;
}
export function compare(candidate,base){
 const result={dg:null,tm:null,notes:[]};
 if(!base){result.notes.push('기준 결과를 선택하세요.');return result;}
 const a=candidate.request,b=base.request,ca=a.conditions,cb=b.conditions;
 if(!hasTm(candidate.duplex)||!hasTm(base.duplex)){result.notes.push('유효한 duplex Tm 결과끼리만 변화량을 계산합니다.');return result;}
 const ions=['na','k','nh4','mg','dntp'].every(k=>ca[k]===cb[k]);
 const model=JSON.stringify(a.contract)===JSON.stringify(b.contract)&&candidate.duplex.model===base.duplex.model;
 const sameReaction=candidate.duplex.self===base.duplex.self;
 if(!ions||!model||!sameReaction){result.notes.push('이온·모델·자기상보 반응 정의가 달라 공통 조건의 변화량을 계산하지 않습니다.');return result;}
 result.tm=candidate.duplex.tm-base.duplex.tm;
 if(candidate.duplex.status!=='ok'||base.duplex.status!=='ok')result.notes.push('Tm 전용 결과에는 ΔG°가 없어 ΔΔG를 제공하지 않습니다.');
 else if(ca.temperature===cb.temperature)result.dg=candidate.duplex.dg-base.duplex.dg;
 else result.notes.push('반응 온도가 달라 결합 우열용 ΔΔG를 계산하지 않습니다.');
 if(ca.a!==cb.a||ca.b!==cb.b)result.notes.push('가닥 농도 다름: ΔTm에는 농도 차이가 반영됩니다.'+(candidate.duplex.status==='ok'&&base.duplex.status==='ok'?' ΔG°는 표준상태 값입니다.':''));
 return result;
}
export function hasTm(v){return ['ok','tm-only'].includes(v?.status);}
export function validateResult(result,request){
 if(!result||JSON.stringify(result.request)!==JSON.stringify(request)||JSON.stringify(result.engine)!==JSON.stringify(CONTRACT))throw new Error('응답이 요청/엔진 버전과 일치하지 않습니다.');
 for(const key of ['duplex','hairpinA','hairpinB']){
  const v=result[key];if(!v||!['ok','tm-only','unsupported','no-structure','error'].includes(v.status))throw new Error('알 수 없는 분석 상태입니다.');
  if(v.status==='tm-only'){
   if(key!=='duplex'||request.conditions.mg<=0||v.model!==CONTRACT.duplexMgTm||!Number.isFinite(v.tm)||['dg','dh','ds'].some(k=>k in v))throw new Error('Tm 전용 응답의 지원 항목/모델이 올바르지 않습니다.');
   const c=v.tmCorrection;
   if(!c||!['monovalent-dominant','mixed','magnesium-dominant'].includes(c.branch)||!Number.isFinite(c.freeMgM)||c.freeMgM<=0||!Number.isFinite(c.correctionInverseK))throw new Error('Mg Tm 보정 적용값이 올바르지 않습니다.');
   const input=request.conditions;
   if(c.model!==CONTRACT.duplexMgTm||c.bindingConstantMInverse!==3e4||c.totalMgM!==input.mg*1e-3||c.dntpM!==input.dntp*1e-3||c.monoM!==(input.na+input.k+input.nh4)*1e-3||c.freeMgM>c.totalMgM*(1+1e-12)||(c.ratio!==null&&!Number.isFinite(c.ratio)))throw new Error('Mg Tm 보정의 단위/요청 조건이 일치하지 않습니다.');
  }else if(v.status==='ok'){if(key==='duplex'&&request.conditions.mg>0)throw new Error('Mg duplex에 미지원 에너지를 제공할 수 없습니다.');if(['tm','dg','dh','ds'].some(k=>!Number.isFinite(v[k])))throw new Error('응답에 유한하지 않은 수치가 있습니다.');}
  else if(['tm','dg','dh','ds'].some(k=>k in v))throw new Error('미지원/미검출 결과에 수치를 넣을 수 없습니다.');
 }
 const ref=result.duplexMgZeroReference;
 if(request.conditions.mg>0){
  const expected={...request.conditions,mg:0};
  if(!ref||ref.basis!=='Mg=0 reference'||typeof ref.note!=='string'||FIELDS.some(k=>ref.conditions?.[k]!==expected[k]))throw new Error('Mg=0 참고값의 구분/계산 조건이 올바르지 않습니다.');
  const v=ref.result;
  if(!v||!['ok','unsupported','error'].includes(v.status))throw new Error('Mg=0 참고 결과 상태가 올바르지 않습니다.');
  if(v.status==='ok'){
   if(v.model!==CONTRACT.duplex||expected.na+expected.k+expected.nh4<=0||['tm','dg','dh','ds'].some(k=>!Number.isFinite(v[k])))throw new Error('Mg=0 참고값의 모델/수치가 올바르지 않습니다.');
   if(Math.abs(v.dg-(v.dh-(expected.temperature+273.15)*v.ds/1000))>1e-8)throw new Error('Mg=0 참고 에너지의 온도/단위가 일치하지 않습니다.');
  }else if(['tm','dg','dh','ds'].some(k=>k in v))throw new Error('계산 불가 참고값에 수치를 넣을 수 없습니다.');
 }else if(ref!==null&&ref!==undefined)throw new Error('Mg=0 입력에 중복 참고 결과를 넣을 수 없습니다.');
 return result;
}
