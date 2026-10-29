// SPDX-License-Identifier: GPL-2.0-or-later
import {CONTRACT} from './analysis-core.mjs';
import {validateSuiteRequest} from './suite-core.mjs';
import {runSuite} from './suite-engine.mjs';
const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
async function verified(path,expected){const response=await fetch(new URL(path,import.meta.url),{cache:'no-store'});if(!response.ok)throw new Error('계산 파일을 불러오지 못했습니다: '+path);const bytes=await response.arrayBuffer();if(await hash(bytes)!==expected)throw new Error('계산 파일 해시가 일치하지 않습니다: '+path);return bytes;}
self.onmessage=async({data:request})=>{
 try{
  validateSuiteRequest(request);
  const [json,wasm]=await Promise.all([verified('engine/manifest.json',CONTRACT.manifest),verified('engine/hairpin.wasm',CONTRACT.wasm),verified('duplex-nn.mjs',CONTRACT.duplexSHA),verified('sequence.mjs',CONTRACT.sequenceSHA)]);
  const manifest=JSON.parse(new TextDecoder().decode(json));if(manifest.version!==CONTRACT.engineVersion||manifest.upstream!=='primer3-py 2.3.1 PyPI sdist')throw new Error('엔진 manifest 버전이 다릅니다.');
  const result=await runSuite(request,wasm,{onProgress:(completed,total)=>self.postMessage({type:'progress',requestId:request.requestId,revision:request.revision,completed,total}),yieldPoint:()=>new Promise(resolve=>setTimeout(resolve,0))});
  self.postMessage({type:'result',requestId:request.requestId,revision:request.revision,result});
 }catch(e){self.postMessage({type:'error',requestId:request?.requestId,revision:request?.revision,message:e.message||'분석 묶음 계산 실패'});}
};
