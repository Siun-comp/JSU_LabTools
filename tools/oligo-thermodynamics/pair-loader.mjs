// SPDX-License-Identifier: GPL-2.0-or-later
import {parsePairStructure} from './pair-structure.mjs';
import {parseHairpin} from './structure.mjs';
import {EXPECTED_MANIFEST_SHA256} from './engine/pair/release.mjs';
export const PAIR_CONTRACT = 'thal-pair/1';
const deepFreeze = value => {
  if (value && typeof value==='object') {Object.values(value).forEach(deepFreeze);Object.freeze(value);}
  return value;
};
export function validateRawInput(input) {
  if (!input || ![1,2,3,4].includes(input.mode)) throw new Error('Unsupported THAL mode');
  for (const key of ['strandA','strandB']) if (typeof input[key]!=='string' || !/^[ACGT]{2,60}$/.test(input[key])) throw new Error('Each input must be 2..60 unmodified DNA bases');
  if (input.mode===4 && input.strandA!==input.strandB) throw new Error('Hairpin requires the same independent molecule in both buffers');
  const c=input.conditions;
  if (!c || !['temperatureC','monovalentMm','magnesiumMm','dntpMm','dnaConcentrationNm'].every(key=>Number.isFinite(c[key]))) throw new Error('All reference condition fields must be finite numbers');
  if (c.temperatureC<0 || c.temperatureC>100 || c.monovalentMm<0 || c.magnesiumMm<0 || c.dntpMm<0 || c.dnaConcentrationNm<=0 || (c.monovalentMm===0 && c.magnesiumMm<=c.dntpMm)) throw new Error('Unsupported reference conditions');
  if (input.showStructure!==undefined && typeof input.showStructure!=='boolean') throw new Error('showStructure must be boolean');
  return input;
}

export async function createPairEngine(bytes) {
  const unsupported = ()=>8;
  const wasi={fd_close:unsupported,fd_fdstat_get:unsupported,fd_prestat_get:unsupported,fd_prestat_dir_name:unsupported,fd_seek:unsupported,
    fd_write:()=>{throw new Error('Unexpected THAL engine output');},proc_exit:code=>{throw new Error('THAL exit '+code);}};
  const {instance}=await WebAssembly.instantiate(bytes,{wasi_snapshot_preview1:wasi});
  const e=instance.exports;
  if (typeof e.abi_version!=='function' || e.abi_version()!==1 || e.input_capacity()!==128) throw new Error('Unsupported THAL adapter ABI');
  e._initialize();
  const decoder=new TextDecoder('utf-8',{fatal:true});
  const stringAt=(ptr,max)=>{
    const mem=new Uint8Array(e.memory.buffer);let end=ptr;
    while(end<Math.min(ptr+max,mem.length) && mem[end]) end++;
    if(end===Math.min(ptr+max,mem.length)) throw new Error('Unterminated engine output');
    return decoder.decode(mem.subarray(ptr,end));
  };
  const run=input=>{
    validateRawInput(input);
    const request=structuredClone(input);const c=request.conditions;const show=request.showStructure!==false;
    for (const [seq,ptr] of [[request.strandA,e.input_a_ptr()],[request.strandB,e.input_b_ptr()]])
      new Uint8Array(e.memory.buffer,ptr,seq.length+1).set(new TextEncoder().encode(seq+'\0'));
    const status=e.run_raw(request.mode,c.temperatureC,c.monovalentMm,c.magnesiumMm,c.dntpMm,c.dnaConcentrationNm,show?1:0);
    const message=stringAt(e.message_ptr(),255);
    if(status<0) throw new Error(message||'THAL calculation failed '+status);
    const record={schemaVersion:PAIR_CONTRACT,status:status===0?'no-structure':'ok',mode:request.mode,
      basis:'primer3-api-reference',decisionUtility:'not-established',
      model:'primer3-py 2.3.1 THAL / THL_GENERAL / maxLoop30',request,
      appliedConditions:{...c},units:{tm:'°C',dg:'kcal/mol',dh:'kcal/mol',ds:'cal/(mol·K)'},
      limitations:['명시한 Primer3 API 농도 기준이며 실제 A/B 평형으로 해석하지 않습니다.',
        '원본 재현과 실험 예측력은 다릅니다. 후보 순위·속도·형광·분율의 검증 완료가 아닙니다.']};
    if(status===0) return deepFreeze(record);
    const v=new Float64Array(e.memory.buffer,e.values_ptr(),7);
    if(![v[0],v[1],v[2],v[3]].every(Number.isFinite)) throw new Error('Nonfinite result');
    record.thermodynamics={tm:v[0],dg:v[1],dh:v[2],ds:v[3]};
    if(Math.abs(v[1]-(v[2]-(c.temperatureC+273.15)*v[3]/1000))>1e-8) throw new Error('G/H/S unit or temperature inconsistency');
    if(request.mode!==4) record.nativeAlignmentEnds={first:v[5],second:v[6],basis:'upstream-internal-strand-order'};
    if(show) {
      const raw=stringAt(e.drawing_ptr(),8192);
      record.structure=request.mode===4?parseHairpin(raw,request.strandA):parsePairStructure(raw,request.strandA,request.strandB,request.mode);
    }
    return deepFreeze(record);
  };
  Object.defineProperty(run,'memoryBytes',{get:()=>e.memory.buffer.byteLength});
  return run;
}

async function digest(bytes) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
}
export async function loadVerifiedPairEngine(baseUrl=new URL('.',import.meta.url),fetcher=fetch) {
  const url=new URL('./engine/pair/manifest.json',baseUrl);
  const response=await fetcher(url,{cache:'no-store'});
  if(!response.ok) throw new Error('Pair manifest HTTP '+response.status);
  const raw=await response.arrayBuffer();
  if(await digest(raw)!==EXPECTED_MANIFEST_SHA256) throw new Error('Pair manifest hash mismatch');
  const manifest=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));
  if(manifest.format!=='primer3-pair-adapter/1' || manifest.abi!==1 || manifest.basis!=='primer3-api-reference' || manifest.asset.path!=='thal-pair.wasm') throw new Error('Unsupported pair manifest');
  const asset=await fetcher(new URL(manifest.asset.path,url),{cache:'no-store'});
  if(!asset.ok) throw new Error('Pair WASM HTTP '+asset.status);
  const bytes=await asset.arrayBuffer();
  if(bytes.byteLength!==manifest.asset.bytes || await digest(bytes)!==manifest.asset.sha256) throw new Error('Pair WASM integrity mismatch');
  return {run:await createPairEngine(bytes),manifest:deepFreeze(manifest)};
}
