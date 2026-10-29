// SPDX-License-Identifier: GPL-2.0-or-later
import {CONTRACT,limitations} from './analysis-core.mjs';
import {validateSuiteRequest,childRequest,SUITE_SCHEMA,UNITS} from './suite-core.mjs';
import {duplex} from './duplex-nn.mjs';
import {createHairpin} from './engine-loader.mjs';
export async function runSuite(request,wasm,{onProgress=()=>{},yieldPoint=()=>Promise.resolve()}={}){
 validateSuiteRequest(request);let hp=null;const points=[];
 const safe=(seq,c)=>{try{return duplex(seq,c);}catch(e){return {status:'error',reason:e.message};}};
 const hairpin=async(seq,c,concentration)=>{
  if(c.na+c.k+c.nh4===0&&c.mg<=c.dntp)return {status:'unsupported',reason:'현재 Primer3 hairpin은 단가염=0·Mg total≤dNTP total 조건을 지원하지 않습니다.'};
  try{if(!hp)hp=await createHairpin(wasm);return hp(seq,{...c,a:concentration},true);}
  catch(e){hp=null;return {status:'error',reason:'Hairpin 계산 실패: '+e.message};}
 };
 for(let i=0;i<request.temperatures.length;i++){
  const entries=[];
  for(let j=0;j<3;j++){
   const r=childRequest(request,i,j),c=r.conditions,d=safe(r.strandA,c),notRequested=()=>({status:'not-requested',reason:'이 분석에서는 요청하지 않았습니다.'});let reference=null;
   if(c.mg>0){const conditions={...c,mg:0};reference={basis:'Mg=0 reference',conditions,
    result:c.na+c.k+c.nh4<=0?{status:'unsupported',reason:'Mg=0 참고값에는 양의 단가염 농도가 필요합니다. 입력한 염을 임의로 바꾸지 않습니다.'}:safe(r.strandA,conditions),
    note:`입력 Mg ${c.mg} mM 효과를 제외한 참고값입니다. 나머지 입력은 같으며 dNTP 독립 효과는 반영하지 않습니다.`};}
   const a=request.includeHairpin&&j===0?await hairpin(r.strandA,c,c.a):notRequested(),b=request.includeHairpin&&j===0?await hairpin(r.strandB,c,c.b):notRequested();
   entries.push({kind:request.targets[j].kind,record:{request:r,duplex:d,duplexMgZeroReference:reference,hairpinA:a,hairpinB:b,
    applied:{temperatureC:c.temperature,temperatureK:c.temperature+273.15,monoMm:c.na+c.k+c.nh4,mgTotalMm:c.mg,dntpTotalMm:c.dntp,hairpinAConcentrationNm:c.a,hairpinBConcentrationNm:c.b,duplexTmCorrection:d.tmCorrection??null},
    limitations:[...limitations(r),...(j?['이 값은 분리한 짧은 fragment와 완전 역상보의 독립 결합입니다. 전체 말단 풀림·extension·속도가 아니며 짧은 Tm은 탐색적 예측입니다.']:[])]}});
  }
  points.push({temperature:request.temperatures[i],entries});onProgress(i+1,request.temperatures.length);await yieldPoint();
 }
 return {schemaVersion:SUITE_SCHEMA,request,engine:{...CONTRACT},units:{...UNITS},points};
}
