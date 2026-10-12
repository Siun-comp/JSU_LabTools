/* Fixed official R-wasm MASS binary. Shared browser/CI loader; no latest fallback. */
'use strict';
(function(root){
 const base=typeof document==='undefined'?null:document.currentScript?.src;
 const contract=Object.freeze({version:'7.3.66',packageVersion:'7.3-66',rVersion:'4.6.0',
  binary:'runtime/MASS_7.3-66.tgz',metadata:'runtime/MASS_7.3-66.metadata.json',
  sha256:'2abe66de8f442fdc0cd221bdb0e774ea17f56ff963dc0275bcfcd2add27ee3b5',
  metadataSHA256:'c5def108f94855ad32e799c8f868e51363267f0266a215db663fea2f72032116',
  source:'https://repo.r-wasm.org/bin/emscripten/contrib/4.6/MASS_7.3-66.tgz'});
 function failure(code){throw Error(code);}
 async function prepare(r,{signal,check=()=>{},onProgress=()=>{},loadBytes}={}){
  check();if(!root.crypto?.subtle||typeof root.DecompressionStream!=='function')failure('package_browser_unsupported');
  const load=loadBytes||async function(name){
   if(!base)failure('package_unavailable');
   const response=await fetch(new URL(name,base),{signal,credentials:'omit',referrerPolicy:'no-referrer'});
   if(!response.ok)failure('package_unavailable');return new Uint8Array(await response.arrayBuffer());
  };
  onProgress('검증한 LoD 계산 패키지 준비 중…');
  const [binary,index]=await Promise.all([load(contract.binary),load(contract.metadata)]);check();
  const digest=async bytes=>Array.from(new Uint8Array(await root.crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
  if(await digest(binary)!==contract.sha256||await digest(index)!==contract.metadataSHA256)failure('package_integrity_mismatch');check();
  const metadata=JSON.parse(new TextDecoder().decode(index));
  const bytes=await new Response(new Blob([binary]).stream().pipeThrough(new root.DecompressionStream('gzip'))).arrayBuffer();check();
  if(!Array.isArray(metadata.files)||!metadata.files.length||!metadata.files.every(f=>typeof f.filename==='string'&&f.filename.startsWith('/')&&!f.filename.split('/').includes('..')&&Number.isSafeInteger(f.start)&&Number.isSafeInteger(f.end)&&f.start>=0&&f.start<=f.end&&f.end<=bytes.byteLength))failure('package_integrity_mismatch');
  await r.FS.mkdir('/jsu-fixed-library');check();await r.FS.mkdir('/jsu-fixed-library/MASS');check();
  await r.FS.mount('WORKERFS',{packages:[{blob:bytes,metadata}]},'/jsu-fixed-library/MASS');check();
  await r.evalRVoid('.libPaths(c("/jsu-fixed-library",.libPaths()))');check();
  const version=await r.evalRString('as.character(packageVersion("MASS"))');check();
  if(version!==contract.version)failure('runtime_version_mismatch');
  if(!await r.evalRBoolean('requireNamespace("MASS",quietly=TRUE)'))failure('package_unavailable');check();
  return Object.freeze({version,sha256:contract.sha256,source:contract.source});
 }
 const api=Object.freeze({contract,prepare});
 if(typeof module==='object'&&module.exports)module.exports=api;else root.FixedMASS=api;
})(globalThis);
