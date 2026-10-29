// SPDX-License-Identifier: GPL-2.0-or-later
// Published parameter values are separately licensed; see fixed-source/.
import {FIXED_PARAMS_SHA256,FIXED_VERSION} from './fixed-nn-release.mjs';
import {reverseComplement} from './sequence.mjs';
export const FIXED_CONTRACT=Object.freeze({schema:FIXED_VERSION,paramsSHA256:FIXED_PARAMS_SHA256,model:'DNA_NN3 + single-internal DNA_IMM1 subset / Na-only entropy / dCp=0',basis:'fixed-register-Na-only-reference',R:1.987});
const fail=(status,reason)=>({status,reason});
export function fixedGeometry(a,b,sourceA=null,sourceB=null){
 if(!/^[ACGT]+$/.test(a)||!/^[ACGT]+$/.test(b)||a.length!==b.length)return {...fail('unsupported','A/B는 같은 길이의 비변형 DNA여야 합니다. 자동 정렬·절삭하지 않습니다.'),a,b,referenceB:a?reverseComplement(a):'',positions:[],columns:[]};
 const n=a.length,columns=Array.from({length:n},(_,i)=>({a:i+1,b:n-i,baseA:a[i],baseB:b[n-i-1],watsonCrick:reverseComplement(a[i])===b[n-i-1],parentA:sourceA?.selection?sourceA.selection.start+i:null,parentB:sourceB?.selection?sourceB.selection.start+n-i-1:null}));
 const positions=columns.filter(p=>!p.watsonCrick).map(p=>p.a),g={status:'ok',reason:'',a,b,referenceB:reverseComplement(a),positions,columns};
 if(n<5||n>60)return {...g,...fail('unsupported','고정 NN 계산은5~60nt입니다. 자동 절삭하지 않습니다.')};
 if(a===reverseComplement(a)||a===b)return {...g,...fail('unsupported','자기상보 PM 또는 실제 A=B의 화학종/대칭 전환은 이번 고정 모델에서 미지원입니다.')};
 if(positions.length>1)return {...g,...fail('unsupported','고정 정렬은0 또는1개 내부 mismatch만 지원합니다.')};
 if(positions.some(p=>p<3||p>n-2))return {...g,...fail('unsupported','양 끝2위치의 mismatch는 미지원입니다. 3′ 효소 반응을 예측하지 않습니다.')};
 const p=positions[0];if(p&&['AC','CA'].includes(a[p-1]+b[n-p]))return {...g,...fail('unsupported','A.C/C.A는 원표의 pH 기준 연결이 미확립되어 수치 채택을 보류했습니다.')};
 return g;
}
export function validateFixedParameters(p){
 if(p?.schemaVersion!=='fixed-nn-parameters/1'||p.model!==FIXED_CONTRACT.model||p.policy?.R_cal_mol_K!==1.987||p.policy?.acCA!=='unsupported-pH-provenance')throw Error('고정 NN 파라미터 계약 오류');
 for(const table of [p.nn,p.imm])if(!table||!Object.values(table).every(v=>Array.isArray(v)&&v.length===2&&v.every(Number.isFinite)))throw Error('고정 NN 파라미터/단위 오류');
 if(Object.keys(p.nn).length!==17||Object.keys(p.imm).length!==40)throw Error('고정 NN 파라미터 개수 오류');
 return p;
}
export async function loadFixedParameters(baseUrl=new URL('.',import.meta.url),fetcher=fetch){
 const res=await fetcher(new URL('fixed-nn-params.json',baseUrl),{cache:'no-store'});if(!res.ok)throw Error('fixed parameters HTTP '+res.status);
 const bytes=await res.arrayBuffer(),hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
 if(hash!==FIXED_PARAMS_SHA256)throw Error('Fixed parameters integrity mismatch');return validateFixedParameters(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));
}
export function evaluateFixedNN(a,b,conditions,refRaw,parameters){
 const p=validateFixedParameters(parameters),g=fixedGeometry(a,b);
 if(g.status!=='ok')return {status:g.status,reason:g.reason};
 const na=conditions.na,temp=conditions.temperature;
 if(!Number.isFinite(na)||na<=0||!(na/1000>0))return fail('unsupported','Na-only 참고의 Na/M 로그 정의역이 성립하지 않습니다. 임의 Na를 넣지 않습니다.');
 if(!Number.isFinite(temp)||temp<0||temp>100)return fail('unsupported','반응 온도는0~100°C입니다.');
 const bottom=b.split('').reverse().join(''),trace=[];let dh=0,ds=0;
 const add=(kind,key,values,positions=null)=>{if(!values?.every(Number.isFinite))throw Error('누락된 NN 항: '+key);dh+=values[0];ds+=values[1];trace.push({kind,key,dh:values[0],ds:values[1],positions});};
 add('init','init',p.nn.init);const ends=[a[0],a.at(-1)];for(let i=0;i<2;i++){const key='AT'.includes(ends[i])?'init_A/T':'init_G/C';add('terminal-init',key,p.nn[key],[i===0?1:a.length]);}
 for(let i=0;i<a.length-1;i++){
  const key=a.slice(i,i+2)+'/'+bottom.slice(i,i+2),rev=key.split('').reverse().join('');let kind,used;
  if(Object.hasOwn(p.imm,key)){kind='internal-mismatch';used=key;}else if(Object.hasOwn(p.imm,rev)){kind='internal-mismatch';used=rev;}else if(Object.hasOwn(p.nn,key)){kind='nearest-neighbor';used=key;}else if(Object.hasOwn(p.nn,rev)){kind='nearest-neighbor';used=rev;}else return fail('unsupported','누락된 고정 NN motif: '+key+' · 평균/완전상보 항으로 대체하지 않습니다.');
  add(kind,used,p[kind==='internal-mismatch'?'imm':'nn'][used],[i+1,i+2]);
 }
 const salt=.368*(a.length-1)*Math.log(na/1000);add('Na-entropy','0.368(N-1)ln[Na/M]',[0,salt]);
 const dg=dh-(temp+273.15)*ds/1000;if(![dg,dh,ds].every(Number.isFinite))throw Error('고정 NN 유한성 오류');
 const values={dg,dh,ds},raw=String(refRaw??''),ref=Number(raw),valid=/^[+]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(raw.trim())&&ref>0&&Number.isFinite(ref),tm={...fail('unavailable','NN 동량 참고농도(각 가닥)를 유한한 양수로 입력하세요.')};
 if(valid){const k=ref*.5e-9,den=ds+1.987*Math.log(k),kelvin=dh*1000/den;if(Number.isFinite(k)&&k>0&&Number.isFinite(kelvin)&&kelvin>0){values.tm=kelvin-273.15;tm.status='ok';tm.reason='';}else tm.reason='NN Tm의 log/Kelvin 정의역이 성립하지 않습니다.';}
 return {status:'ok',reason:'',thermodynamics:values,tm,trace,applied:{temperatureC:temp,NaMm:na,KMm:0,NH4Mm:0,MgMm:0,dNTPMm:0,salt:'Na-only entropy/method5',referenceEachNm:valid?ref:null,referenceRaw:raw,effectiveM:valid&&ref*.5e-9>0?ref*.5e-9:null,actualMixtureInterpretation:'not-established',excludedRequested:{k:conditions.k,nh4:conditions.nh4,mg:conditions.mg,dntp:conditions.dntp}},units:{dg:'kcal/mol',dh:'kcal/mol',ds:'cal/(mol·K)',tm:'°C'},contract:{...FIXED_CONTRACT}};
}
export function calculateFixed(a,b,conditions,refRaw,parameters,sourceA=null,sourceB=null){
 const geometry=fixedGeometry(a,b,sourceA,sourceB),base={geometry,pmGeometry:fixedGeometry(a,geometry.referenceB,sourceA,null),contract:{...FIXED_CONTRACT}};
 if(geometry.status!=='ok')return {...base,pm:fail('not-executed',geometry.reason),mm:fail('not-executed',geometry.reason),comparison:{dg:null,tm:null,reason:geometry.reason}};
 const pm=evaluateFixedNN(a,geometry.referenceB,conditions,refRaw,parameters),mm=evaluateFixedNN(a,b,conditions,refRaw,parameters);
 const comparison={dg:null,tm:null,reason:''};if(pm.status==='ok'&&mm.status==='ok'){comparison.dg=mm.thermodynamics.dg-pm.thermodynamics.dg;if(pm.tm.status==='ok'&&mm.tm.status==='ok')comparison.tm=mm.thermodynamics.tm-pm.thermodynamics.tm;else comparison.reason='Tm/ΔTm의 참고농도 또는 정의역이 미확정입니다.';}else comparison.reason=pm.reason||mm.reason;
 return {...base,pm,mm,comparison};
}
