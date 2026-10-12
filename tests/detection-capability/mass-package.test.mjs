import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),fixed=require('../../tools/detection-capability/mass-package.js');
const loadBytes=name=>fs.readFile(new URL('../../tools/detection-capability/'+name,import.meta.url));
function runtime(version='7.3.66'){
 const mounts=[],calls=[];return {mounts,calls,FS:{mkdir:async p=>calls.push(p),mount:async(type,options,path)=>mounts.push({type,options,path})},evalRVoid:async s=>calls.push(s),evalRString:async()=>version,evalRBoolean:async()=>true};
}
const r=runtime(),environment=await fixed.prepare(r,{loadBytes});
assert.equal(environment.version,'7.3.66');assert.equal(environment.sha256,fixed.contract.sha256);
assert.equal(r.mounts.length,1);assert.equal(r.mounts[0].type,'WORKERFS');assert.equal(r.mounts[0].path,'/jsu-fixed-library/MASS');
const mounted=r.mounts[0].options.packages[0];assert(mounted.blob.byteLength>873258);assert(mounted.metadata.files.some(f=>f.filename==='/DESCRIPTION'));assert(r.calls.at(-1).includes('.libPaths'));
for(const target of [fixed.contract.binary,fixed.contract.metadata]){
 const broken=runtime();await assert.rejects(fixed.prepare(broken,{loadBytes:async n=>{const b=await loadBytes(n);if(n===target)b[0]^=1;return b;}}),/package_integrity_mismatch/);assert.equal(broken.mounts.length,0);assert.equal(broken.calls.length,0);
}
await assert.rejects(fixed.prepare(runtime('7.3.65'),{loadBytes}),/runtime_version_mismatch/);
const missing=runtime();await assert.rejects(fixed.prepare(missing,{loadBytes:async()=>{throw Error('package_unavailable');}}),/package_unavailable/);assert.equal(missing.calls.length,0);
const cancelled=runtime();let stop=false;await assert.rejects(fixed.prepare(cancelled,{loadBytes:async n=>{const b=await loadBytes(n);stop=true;return b;},check:()=>{if(stop)throw Error('aborted');}}),/aborted/);assert.equal(cancelled.calls.length,0);
console.log('PASS: real MASS binary/metadata integrity, verified mount, wrong package version, missing file and cancellation before mount.');
