// SPDX-License-Identifier: GPL-2.0-or-later
import {CONTRACT,validateRequest,limitations,hasTm} from './analysis-core.mjs';
import {duplex} from './duplex-nn.mjs';
import {createHairpin} from './engine-loader.mjs';
const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
async function verified(path,expected){
 const response=await fetch(new URL(path,import.meta.url),{cache:'no-store'});
 if(!response.ok)throw new Error('계산 파일을 불러오지 못했습니다: '+path);
 const bytes=await response.arrayBuffer();if(await hash(bytes)!==expected)throw new Error('계산 파일 해시가 일치하지 않습니다: '+path);return bytes;
}
let resources;
async function load(){
 if(!resources)resources=Promise.all([verified('engine/manifest.json',CONTRACT.manifest),verified('engine/hairpin.wasm',CONTRACT.wasm),verified('duplex-nn.mjs',CONTRACT.duplexSHA),verified('sequence.mjs',CONTRACT.sequenceSHA)]).then(([json,wasm])=>{
  const manifest=JSON.parse(new TextDecoder().decode(json));if(manifest.version!==CONTRACT.engineVersion||manifest.upstream!=='primer3-py 2.3.1 PyPI sdist')throw new Error('엔진 manifest 버전이 다릅니다.');return wasm;
 });
 return resources;
}
self.onmessage=async ({data:r})=>{
 try{
  validateRequest(r);const wasm=await load(),c=r.conditions;
  let hp=await createHairpin(wasm);
  const safeDuplex=()=>{try{return duplex(r.strandA,c);}catch(e){return {status:'error',reason:e.message};}};
  const run=async(seq,conc)=>{
   if(c.na+c.k+c.nh4===0&&c.mg<=c.dntp)return {status:'unsupported',reason:'현재 Primer3 hairpin은 단가염=0·Mg total≤dNTP total 조건을 지원하지 않습니다. Duplex Tm의 Mg 결합 근사와 별도입니다.'};
   try{if(!hp)hp=await createHairpin(wasm);return hp(seq,{...c,a:conc},true);}
   catch(e){hp=null;return {status:'error',reason:'Hairpin 계산 실패: '+e.message};}
  };
  const d=safeDuplex(),a=await run(r.strandA,c.a),b=await run(r.strandB,c.b);
  let reference=null;
  if(c.mg>0){
   const conditions={...c,mg:0};let result;
   if(c.na+c.k+c.nh4<=0)result={status:'unsupported',reason:'Mg=0 참고값에는 양의 단가염 농도가 필요합니다. 입력한 단가염을 임의로 바꾸지 않습니다.'};
   else try{result=duplex(r.strandA,conditions);}catch(e){result={status:'error',reason:e.message};}
   reference={basis:'Mg=0 reference',conditions,result,note:`입력 Mg ${c.mg} mM의 효과를 제외한 참고값입니다. 나머지 입력은 같으며 dNTP 독립 효과는 반영하지 않습니다.`};
  }
  self.postMessage({type:'result',requestId:r.requestId,revision:r.revision,result:{request:r,engine:{...CONTRACT},duplex:d,duplexMgZeroReference:reference,hairpinA:a,hairpinB:b,
   applied:{temperatureC:c.temperature,temperatureK:c.temperature+273.15,monoMm:c.na+c.k+c.nh4,mgTotalMm:c.mg,dntpTotalMm:c.dntp,hairpinAConcentrationNm:c.a,hairpinBConcentrationNm:c.b,duplexConcentrationConvention:hasTm(d)?(d.self?'same-species total A+B':'limiting-strand half-bound max(A,B)-min(A,B)/2'):null,duplexTmCorrection:d.tmCorrection??null},limitations:limitations(r)}});
 }catch(e){self.postMessage({type:'error',requestId:r?.requestId,revision:r?.revision,message:e.message||'계산 엔진을 실행하지 못했습니다.'});}
};
