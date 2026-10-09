import {readFile,readdir} from 'node:fs/promises';
import {resolve,dirname,relative,isAbsolute,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),dist=resolve(root,'dist');
const manifest=JSON.parse(await readFile(resolve(root,'public-manifest.json'),'utf8'));
const contract=JSON.parse(await readFile(resolve(root,'amplification-release-contract.json'),'utf8'));
const hash=b=>createHash('sha256').update(b).digest('hex');
async function files(base,prefix=''){const out=[];for(const e of await readdir(base,{withFileTypes:true})){assert(!e.isSymbolicLink(),'Symlink rejected');const p=prefix+e.name;if(e.isDirectory())out.push(...await files(resolve(base,e.name),p+'/'));else out.push(p);}return out;}
const update=contract.nucleicRelease,buffer=contract.bufferRelease;
const method=contract.methodComparisonRelease;
assert.equal(method.previousSHA,'6676a974052082676efbe953e9570517462f6bbd');assert.equal(method.portalVersion,manifest.version);assert.equal(method.toolVersion,'0.3.0');assert.equal(method.previousPublic.length,111);
const previousHome=html=>html.replace(method.portalRow,'').replace('실행 가능 8개','실행 가능 7개').replaceAll('포털 v1.4.0','포털 v1.3.0');
async function historicBytes(target){const bytes=await readFile(resolve(dist,target));return target==='index.html'?Buffer.from(previousHome(bytes.toString())):/^info\/.*\.html$/.test(target)?Buffer.from(bytes.toString().replaceAll('포털 v1.4.0','포털 v1.3.0')):bytes;}
for(const entry of method.previousPublic)assert.equal(hash(await historicBytes(entry.target)),entry.sha256,'Previous public content retained: '+entry.target);

assert.equal(manifest.version,'1.4.0');assert.equal(manifest.candidate,undefined);
assert.equal(update.portalVersion,'1.2.1');assert.equal(buffer.portalVersion,'1.3.0');
assert.equal(buffer.previousPortalVersion,'1.2.1');assert.equal(buffer.previousSHA,'d5b8ca0778a1e536867415156f081c9f2ebadacc');
assert.equal(buffer.toolVersion,'1.1.0');assert.equal(buffer.algorithmVersion,'0.2.0');assert.equal(buffer.releasedOn,'2026-10-07');
assert.deepEqual(buffer.selectedTargets,['info/dilution.html','tools/dilution-calculator/index.html','tools/dilution-calculator/app.mjs']);
assert.deepEqual(buffer.addedTargets,['composer-core.mjs','composer.mjs','composer.css','presets.json'].map(p=>'tools/dilution-calculator/'+p));
assert.equal(buffer.previousPublic.length,107);assert.equal(new Set(buffer.previousPublic.map(e=>e.target)).size,107);assert.equal(update.previousPortalVersion,'1.2.0');
assert.equal(update.previousSHA,'4cabcd75918f58464de6398d268182ca753eba7b');
assert.equal(update.toolVersion,'1.1.0');assert.equal(update.algorithmVersion,'0.3.0');assert.equal(update.releasedOn,'2026-10-06');
assert.deepEqual(update.selectedTargets,['info/nucleic-acid.html',...['index.html','core.mjs','app.mjs','clipboard.mjs'].map(p=>'tools/nucleic-acid-calculator/'+p)]);
assert.equal(update.previousPublic.length,107);assert.equal(new Set(update.previousPublic.map(e=>e.target)).size,107);
assert.equal(manifest.files.length,135);assert.equal(new Set(manifest.files.map(e=>e.target)).size,135);
assert.deepEqual((await files(dist)).sort(),manifest.files.map(e=>e.target).sort(),'Exact public allowlist');
for(const e of manifest.files){
 const source=resolve(root,e.source),target=resolve(dist,e.target);
 for(const [base,path] of [[root,source],[dist,target]]){const rel=relative(base,path);assert(rel&&!isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..'+sep),'Public path stays inside package');}
 assert((await readFile(source)).equals(await readFile(target)),'Source/build bytes: '+e.target);
 assert.equal(hash(await readFile(target)),contract.publicSelection.find(p=>p.target===e.target).sha256,'Frozen release bytes');
 const selected=contract.publicSelection.find(p=>p.target===e.target);assert.equal(selected.source,e.source);assert.equal(selected.bytes,(await readFile(target)).length);
 // Existing public synthetic example workbooks stay in the immutable baseline.
 // Apply the private/source/experimental exclusion to newly added AA entries.
 if(!contract.baseline.files.some(p=>p.target===e.target)&&e.target!==method.reportTemplateTarget)assert(!/(?:^|\/)(?:node_modules|\.git|src|validation|references|docs|tests)(?:\/|$)|\.map$|\.xlsx?$|\.pcrd$/i.test(e.target),'No new development/private/experimental files: '+e.target);
}
assert.equal(hash(await readFile(resolve(dist,method.reportTemplateTarget))),method.reportTemplateSHA256,'Only reviewed blank native report template is public');
const targets=new Set(manifest.files.map(e=>e.target));
const enhancement=contract.bufferEnhancementRelease;assert.equal(enhancement.previousSHA,'54074e6c37fbbe905128e531f9a502d1310db7da');assert.equal(enhancement.toolVersion,'1.2.0');assert.equal(enhancement.algorithmVersion,'0.2.0');assert.equal(enhancement.previousPublic.length,111);
assert.deepEqual(enhancement.selectedTargets,['index.html','info/dilution.html',...['index.html','composer-core.mjs','composer.mjs','composer.css','presets.json'].map(p=>'tools/dilution-calculator/'+p)]);
for(const e of enhancement.previousPublic){assert(targets.has(e.target),'AP161 path retained');if(!enhancement.selectedTargets.includes(e.target))assert.equal(hash(await historicBytes(e.target)),e.sha256,'AP161 nonselected bytes retained: '+e.target);}

const patch=contract.bufferPatchRelease;assert.equal(patch.previousSHA,'d9a9fe6b0371d97274ba2ade4b8ffe32c7e73468');assert.equal(patch.toolVersion,'1.1.1');assert.equal(patch.algorithmVersion,'0.2.0');assert.equal(patch.releasedOn,'2026-10-08');assert.equal(patch.previousPublic.length,111);
assert.deepEqual(patch.selectedTargets,['index.html','info/dilution.html',...['index.html','composer-core.mjs','composer.mjs','composer.css','presets.json'].map(p=>'tools/dilution-calculator/'+p)]);
for(const e of patch.previousPublic){assert(targets.has(e.target),'AP158 path retained');if(!patch.selectedTargets.includes(e.target))assert.equal(hash(await historicBytes(e.target)),e.sha256,'AP158 nonselected bytes retained: '+e.target);}
for(const e of contract.baseline.files)assert(targets.has(e.target),'Previous public path retained');
for(const e of update.previousPublic)assert(targets.has(e.target),'AP144 public path retained');
const home=await readFile(resolve(dist,'index.html'),'utf8');
assert(home.includes(contract.oldPlot),'Existing Plot row byte preserved');
assert(home.includes('실행 가능 8개')&&home.includes('준비중 0개'));
const aaRows=[...home.matchAll(/<tr class="available">[\s\S]*?<\/tr>/g)].filter(m=>m[0].includes('<h2>Amplification Analysis</h2>'));
assert.equal(aaRows.length,1);assert(aaRows[0][0].includes('도구 v0.1.0-beta.1')&&aaRows[0][0].includes('베타'));
assert.equal(contract.appVersion,'0.1.0-beta.1');assert.equal(contract.analysisSchema,15);assert.equal(contract.selectedDataSchema,9);assert.equal(contract.releasedOn,'2026-10-06');
const nucRows=[...home.matchAll(/<tr class="available">[\s\S]*?<\/tr>/g)].filter(m=>m[0].includes('tools/nucleic-acid-calculator/'));
assert.equal(nucRows.length,1);assert(nucRows[0][0].includes('도구 v1.1.0 · 알고리즘 v0.3.0')&&nucRows[0][0].includes('확인 2026-10-06'));
const reagentRows=[...home.matchAll(/<tr class="available">[\s\S]*?<\/tr>/g)].filter(m=>m[0].includes('tools/dilution-calculator/'));
assert.equal(reagentRows.length,1);assert(reagentRows[0][0].includes('시약·버퍼 조제')&&reagentRows[0][0].includes('도구 v1.2.0 · 조제 v0.2.0')&&reagentRows[0][0].includes('2026-10-08'));
const priorHome=previousHome(home).replace(reagentRows[0][0],buffer.oldRow).replaceAll('포털 v1.3.0','포털 v1.2.1');
assert.equal(hash(priorHome),buffer.previousPublic.find(e=>e.target==='index.html').sha256,'Only selected reagent row and portal version changed');
for(const e of buffer.previousPublic){
 assert(targets.has(e.target),'AP148 public path retained');
 if(e.target==='index.html'||buffer.selectedTargets.includes(e.target))continue;
 const bytes=await historicBytes(e.target);const original=/^info\/.*\.html$/.test(e.target)?Buffer.from(bytes.toString().replaceAll('포털 v1.3.0','포털 v1.2.1')):bytes;
 assert.equal(hash(original),e.sha256,'AP148 tool bytes preserved: '+e.target);
}
const canonical=priorHome.replace(nucRows[0][0],update.oldRow).replaceAll('포털 v1.2.1','포털 v1.2.0');
assert.equal(hash(canonical),update.previousPublic.find(e=>e.target==='index.html').sha256,'Only selected nucleic row and portal version changed');
for(const e of update.previousPublic.filter(e=>e.target!=='index.html'&&!update.selectedTargets.includes(e.target)&&!buffer.selectedTargets.includes(e.target))){
 const bytes=await historicBytes(e.target);const original=/^info\/.*\.html$/.test(e.target)?Buffer.from(bytes.toString().replaceAll('포털 v1.3.0','포털 v1.2.1').replaceAll('포털 v1.2.1','포털 v1.2.0')):bytes;
 assert.equal(hash(original),e.sha256,'Existing tool bytes retained: '+e.target);
}
const nucCore=await readFile(resolve(dist,'tools/nucleic-acid-calculator/core.mjs'),'utf8');
for(const marker of ["VERSION='0.3.0'","'neb-web'","'thermo-web'","615.94","602200000000000000000000n"])assert(nucCore.includes(marker),'Selected nucleic web reference: '+marker);
const info=await readFile(resolve(dist,'info/amplification-analysis.html'),'utf8');
for(const text of ['베타','Excel 붙여넣기 사용자 확인','3행 형광','1, 2, 3','실제 사용 중','임시 결과','작업 재열기 후 다시 분석','시약 이름 차이','외삽'])assert(info.includes(text),'Support statement: '+text);
assert(!/<(?:script|input|textarea|form|iframe)\b/i.test(info),'Information page is read-only');
assert(!/localhost|127\.0\.0\.1|(?:^|["' >])[A-Z]:[\\/]|validation\//i.test(info+home),'No internal file paths');
for(const path of (await files(dist)).filter(p=>p.endsWith('.html')&&!p.startsWith('tools/detection-capability/'))){
 const html=await readFile(resolve(dist,path),'utf8');
 for(const m of html.matchAll(/(?:href|src)="([^" ]+)"/g)){
   if(/^(?:https?:|#|data:|blob:)/.test(m[1]))continue;
   const asset=resolve(dirname(resolve(dist,path)),m[1].endsWith('/')?m[1]+'index.html':m[1]);
   const rel=relative(dist,asset);assert(rel&&!isAbsolute(rel)&&!rel.startsWith('..'+sep),'Local asset scope');await readFile(asset);
 }
}
const appBase=resolve(dist,'tools/amplification-analysis');
for(const e of contract.appFiles)assert.equal(hash(await readFile(resolve(appBase,e.path))),e.sha256,'Frozen beta runtime');
const appIndex=await readFile(resolve(appBase,'index.html'),'utf8');
const main=appIndex.match(/src="([^"]+\.js)"/)[1];
const mainText=await readFile(resolve(appBase,main),'utf8');
assert(mainText.includes('0.1.0-beta.1')&&!mainText.includes('0.1.0-dev.23'),'Built product version matches candidate');
assert(mainText.includes('증폭 곡선 분석 · 베타'),'Beta display');
const webManifest=JSON.parse(await readFile(resolve(appBase,'manifest.webmanifest'),'utf8'));
assert.equal(webManifest.name,'Amplification Analysis');assert.equal(webManifest.scope,'.');assert.equal(webManifest.start_url,'.');
for(const icon of webManifest.icons)await readFile(resolve(appBase,icon.src));
console.log('PASS: frozen135-file portal1.4.0 artifact; all107 prior paths preserved; selected reagent update; nucleic release preserved; exact unchanged beta.1 runtime27 and nested assets valid.');
