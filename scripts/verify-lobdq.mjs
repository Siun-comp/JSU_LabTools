import {readFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),dist=resolve(root,'dist');
const manifest=JSON.parse(await readFile(resolve(root,'public-manifest.json'),'utf8'));
const local=JSON.parse(await readFile(resolve(dist,'tools/detection-capability/build-manifest.json'),'utf8'));
assert.equal(manifest.files.length,111);
assert.equal(local.version,'0.9.1-beta.3');
assert.equal(local.files.length,47);
assert.equal(local.baselineProgramVersion,'0.9.0-beta.6');
for(const f of local.files){const bytes=await readFile(resolve(dist,'tools/detection-capability',f.name));assert.equal(bytes.length,f.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),f.sha256,'LoBDQ immutable asset '+f.name);}
for(const name of ['index.html','info/detection-capability.html','tools/detection-capability/index.html','tools/detection-capability/THIRD_PARTY_NOTICES.html']){
 const path=resolve(dist,name),text=await readFile(path,'utf8');
 assert(!/<iframe\b/i.test(text));
 for(const m of text.matchAll(/(?:src|href)="([^" ]+)"/g)){
  if(/^https?:|^#/.test(m[1]))continue;
  const target=m[1].split('#')[0]; await readFile(resolve(dirname(path),target.endsWith('/')?target+'index.html':target));
 }
}
const guide=await readFile(resolve(dist,'info/detection-capability.html'),'utf8');
assert(!/<(script|input|form|textarea)\b/i.test(guide),'Guide receives no experiment input');
assert(!/[\u3040-\u30ff\u4e00-\u9fff]/.test(guide),'Korean guide');
assert.deepEqual([...guide.matchAll(/href="(https?:[^" ]+)"/g)].map(m=>m[1]),[
 'https://docs.r-wasm.org/webr/latest/serving.html',
 'https://stat.ethz.ch/R-manual/R-devel/library/stats/html/glm.html',
 'https://stat.ethz.ch/R-manual/R-devel/library/MASS/html/dose.p.html'
]);
for(const term of ['JavaScript','webR v0.6.0','기준 농도','다시 계산','회사 보고서','사용 검토용','양측 95%'])assert(guide.includes(term));
const home=await readFile(resolve(dist,'index.html'),'utf8');
const row=[...home.matchAll(/<tr class="available">[\s\S]*?<\/tr>/g)].find(m=>m[0].includes('LoB · LoD · LoQ 분석'))?.[0];
assert(row&&row.includes('사용 검토용 베타')&&row.includes('info/detection-capability.html'));
for(const attr of ['target="_blank"','rel="noopener noreferrer"','referrerpolicy="no-referrer"'])assert(row.includes(attr));
const entry=await readFile(resolve(dist,'tools/detection-capability/index.html'),'utf8');
for(const marker of ['lod-gof-contract.js','LoD 검출률 확인','LoQ · Westgard TE','현재 지원 5%'])assert(entry.includes(marker));
assert.equal(local.gofDiagnostics.version,'1.0.0');
const source=await readFile(resolve(dist,'tools/detection-capability/lod-browser-source.js'),'utf8');
const program=JSON.parse(source.match(/Object\.freeze\((\{[\s\S]*\})\);/)[1]);
assert.equal(createHash('sha256').update(program.program).digest('hex'),program.sha256,'Diagnostic wrapped R program fingerprint');
assert.equal(local.gofDiagnostics.sourceSHA256,program.sha256);
const runtime=await readFile(resolve(dist,'tools/detection-capability/browser-r-runtime.js'),'utf8');
assert(runtime.includes('https://webr.r-wasm.org/v0.6.0/')&&runtime.includes('ChannelType.PostMessage'));
console.log('PASS: unchanged LoBDQ asset hashes, Korean guide/links, fixed runtime and beta new-tab connection.');
