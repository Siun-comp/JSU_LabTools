import {readFile,readdir} from 'node:fs/promises';
import {resolve,dirname,relative,isAbsolute,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import assert from 'node:assert/strict';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),dist=resolve(root,'dist');
const manifest=JSON.parse(await readFile(resolve(root,'public-manifest.json'),'utf8'));
const contract=JSON.parse(await readFile(resolve(root,'amplification-release-contract.json'),'utf8'));
const hash=b=>createHash('sha256').update(b).digest('hex');
async function files(base,prefix=''){const out=[];for(const e of await readdir(base,{withFileTypes:true})){assert(!e.isSymbolicLink(),'Symlink rejected');const p=prefix+e.name;if(e.isDirectory())out.push(...await files(resolve(base,e.name),p+'/'));else out.push(p);}return out;}
const update=contract.nucleicRelease,buffer=contract.bufferRelease;
const method=contract.methodComparisonRelease;
const oligo=contract.oligoDimerRelease;
const methodPatch=contract.methodComparisonPatchRelease;
assert.equal(methodPatch.previousSHA,'c327726c97a43133c1fbe4c91540960b91ff21e0');assert.equal(methodPatch.portalVersion,'1.5.1');assert.equal(methodPatch.toolVersion,'0.3.1');assert.equal(methodPatch.previousPublic.length,142);
const gitRoot=existsSync(resolve(root,'.git'))?root:resolve(root,'release/p1/repository');
const sequenceRelease=contract.sequenceNumberingRelease;
assert.equal(sequenceRelease.previousSHA,'756fbf0a291310fb00ee0b530c5f270dde903760');assert.equal(sequenceRelease.portalVersion,manifest.version);assert.equal(sequenceRelease.toolVersion,'1.0.2');assert.equal(sequenceRelease.algorithmVersion,'0.2.3');assert.equal(sequenceRelease.previousPublic.length,160);assert.deepEqual(sequenceRelease.addedTargets,[]);
assert.deepEqual(sequenceRelease.selected.map(e=>e.target).sort(),['index.html',...manifest.files.filter(e=>e.target.startsWith('info/')).map(e=>e.target),'tools/sequence/app.mjs','tools/sequence/core.mjs'].sort());
async function preSequenceBytes(target){const entry=sequenceRelease.previousPublic.find(e=>e.target===target);assert(entry,'Previous Sequence release path retained');const bytes=await readFile(resolve(dist,target)),selected=sequenceRelease.selected.find(e=>e.target===target);if(!selected){assert.equal(hash(bytes),entry.sha256,'Unselected Sequence release bytes: '+target);return bytes;}assert.equal(hash(bytes),selected.sha256,'Selected Sequence release bytes: '+target);const old=execFileSync('git',['-C',gitRoot,'show',sequenceRelease.previousSHA+':'+entry.source]);assert.equal(hash(old),entry.sha256,'Previous Sequence release bytes from Git');return old;}
for(const e of sequenceRelease.previousPublic)await preSequenceBytes(e.target);
assert.deepEqual(manifest.files.map(e=>e.target).sort(),sequenceRelease.previousPublic.map(e=>e.target).sort(),'No public path added or removed');
const practicalRelease=contract.methodComparisonPracticalRelease;
assert.equal(practicalRelease.previousSHA,'0aa80f34206b66754ceb0321d0a3a15966b6b9a9');assert.equal(practicalRelease.portalVersion,'1.6.2');assert.equal(practicalRelease.toolVersion,'0.4.1');assert.equal(practicalRelease.previousPublic.length,159);assert.deepEqual(practicalRelease.addedTargets,['tools/method-comparison/practical-data.mjs']);
async function prePracticalBytes(target){const entry=practicalRelease.previousPublic.find(e=>e.target===target);assert(entry,'Previous practical release path retained');const bytes=await preSequenceBytes(target),selected=practicalRelease.selected.find(e=>e.target===target);if(!selected){assert.equal(hash(bytes),entry.sha256,'Unselected practical release bytes: '+target);return bytes;}assert.equal(hash(bytes),selected.sha256,'Selected practical release bytes: '+target);const old=execFileSync('git',['-C',gitRoot,'show',practicalRelease.previousSHA+':'+entry.source]);assert.equal(hash(old),entry.sha256,'Previous practical release bytes from Git');return old;}
for(const e of practicalRelease.previousPublic)await prePracticalBytes(e.target);
assert.deepEqual(manifest.files.filter(e=>!practicalRelease.previousPublic.some(p=>p.target===e.target)).map(e=>e.target).sort(),practicalRelease.addedTargets.toSorted(),'Only reviewed practical addition');
const packageRelease=contract.detectionCapabilityPackageRelease;
assert.equal(packageRelease.previousSHA,'e87309dfedabdd6c79d462eb61cae64f25740f42');assert.equal(packageRelease.portalVersion,'1.6.1');assert.equal(packageRelease.toolVersion,'0.9.1-beta.5');assert.equal(packageRelease.previousPublic.length,153);assert.equal(packageRelease.addedTargets.length,6);
async function prePackageBytes(target){const entry=packageRelease.previousPublic.find(e=>e.target===target);assert(entry,'Previous package release path retained');const bytes=await prePracticalBytes(target),selected=packageRelease.selected.find(e=>e.target===target);if(!selected){assert.equal(hash(bytes),entry.sha256,'Unselected package release bytes: '+target);return bytes;}assert.equal(hash(bytes),selected.sha256,'Selected package release bytes: '+target);const old=execFileSync('git',['-C',gitRoot,'show',packageRelease.previousSHA+':'+entry.source]);assert.equal(hash(old),entry.sha256,'Previous package release bytes from Git');return old;}
for(const e of packageRelease.previousPublic)await prePackageBytes(e.target);
assert.deepEqual(practicalRelease.previousPublic.filter(e=>!packageRelease.previousPublic.some(p=>p.target===e.target)).map(e=>e.target).sort(),packageRelease.addedTargets.toSorted(),'Only reviewed package additions');
const redesign=contract.methodComparisonRedesignRelease;
assert.equal(redesign.previousSHA,'b70688cb2a8564f10b7fbe67a9d7874670c0b303');assert.equal(redesign.portalVersion,'1.6.0');assert.equal(redesign.toolVersion,'0.4.0');assert.equal(redesign.previousPublic.length,142);assert.equal(redesign.addedTargets.length,11);
async function preRedesignBytes(target){const entry=redesign.previousPublic.find(e=>e.target===target);assert(entry,'Previous method-comparison path retained');const bytes=await prePackageBytes(target),selected=redesign.selected.find(e=>e.target===target);if(!selected){assert.equal(hash(bytes),entry.sha256,'Unselected redesign bytes: '+target);return bytes;}assert.equal(hash(bytes),selected.sha256,'Selected redesign bytes: '+target);const old=execFileSync('git',['-C',gitRoot,'show',redesign.previousSHA+':'+entry.source]);assert.equal(hash(old),entry.sha256,'Previous release bytes from Git');return old;}
for(const e of redesign.previousPublic)await preRedesignBytes(e.target);
assert.deepEqual(packageRelease.previousPublic.filter(e=>!redesign.previousPublic.some(p=>p.target===e.target)).map(e=>e.target).sort(),redesign.addedTargets.toSorted(),'Only reviewed additions');
const mixPatch=contract.oligoMixRelease;
assert.equal(mixPatch.previousSHA,'8b4a775c709a95f8f01dcc87a01ef538d729bc31');assert.equal(mixPatch.portalVersion,'1.5.4');assert.equal(mixPatch.toolVersion,'1.1.0');assert.equal(mixPatch.algorithmVersion,'0.5.0');assert.equal(mixPatch.previousPublic.length,142);
async function preMixPatchBytes(target){const entry=mixPatch.previousPublic.find(e=>e.target===target);assert(entry,'Prior Oligo Mix path retained');const bytes=await preRedesignBytes(target),selected=mixPatch.selected.find(e=>e.target===target);if(!selected){assert.equal(hash(bytes),entry.sha256,'Unselected Oligo Mix bytes: '+target);return bytes;}assert.equal(hash(bytes),selected.sha256,'Selected Oligo Mix bytes: '+target);const old=execFileSync('git',['-C',gitRoot,'show',mixPatch.previousSHA+':'+entry.source]);assert.equal(hash(old),entry.sha256,'Previous release bytes from Git');return old;}
for(const e of mixPatch.previousPublic)await preMixPatchBytes(e.target);
const layoutPatch=contract.detectionCapabilityPatchRelease;
assert.equal(layoutPatch.previousSHA,'0475d17527233fc060aa090875583bb67e5b3c61');assert.equal(layoutPatch.portalVersion,'1.5.3');assert.equal(layoutPatch.toolVersion,'0.9.1-beta.4');assert.equal(layoutPatch.previousPublic.length,142);
async function preLayoutPatchBytes(target){const entry=layoutPatch.previousPublic.find(e=>e.target===target);assert(entry,'Prior LoBDQ patch path retained');const bytes=await preMixPatchBytes(target),selected=layoutPatch.selected.find(e=>e.target===target);if(!selected){assert.equal(hash(bytes),entry.sha256,'Unselected LoBDQ patch bytes: '+target);return bytes;}assert.equal(hash(bytes),selected.sha256,'Selected LoBDQ patch bytes: '+target);const old=execFileSync('git',['-C',gitRoot,'show',layoutPatch.previousSHA+':'+entry.source]);assert.equal(hash(old),entry.sha256,'Previous LoBDQ release bytes from Git');return old;}
for(const e of layoutPatch.previousPublic)await preLayoutPatchBytes(e.target);
const oligoPatch=contract.oligoDimerPatchRelease;
assert.equal(oligoPatch.previousSHA,'2871d41e902aee1c1c3873587683eb36cf3fe09e');assert.equal(oligoPatch.portalVersion,'1.5.2');assert.equal(oligoPatch.toolVersion,'0.2.1');assert.equal(oligoPatch.previousPublic.length,142);
async function preOligoPatchBytes(target){const entry=oligoPatch.previousPublic.find(e=>e.target===target);assert(entry,'Prior Oligo patch target retained');const bytes=await preLayoutPatchBytes(target),selected=oligoPatch.selected.find(e=>e.target===target);if(!selected){assert.equal(hash(bytes),entry.sha256,'Unselected Oligo patch bytes: '+target);return bytes;}assert.equal(hash(bytes),selected.sha256,'Selected Oligo patch bytes: '+target);const old=execFileSync('git',['-C',gitRoot,'show',oligoPatch.previousSHA+':'+entry.source]);assert.equal(hash(old),entry.sha256,'Previous release bytes from Git');return old;}
for(const e of oligoPatch.previousPublic)await preOligoPatchBytes(e.target);
async function preMethodPatchBytes(target){const entry=methodPatch.previousPublic.find(e=>e.target===target);assert(entry,'Prior target retained');const bytes=await preOligoPatchBytes(target);const selected=methodPatch.selected.find(e=>e.target===target);if(!selected){assert.equal(hash(bytes),entry.sha256,'Unselected public bytes preserved: '+target);return bytes;}assert.equal(hash(bytes),selected.sha256,'Selected patch bytes: '+target);const old=execFileSync('git',['-C',gitRoot,'show',methodPatch.previousSHA+':'+entry.source]);assert.equal(hash(old),entry.sha256,'Historical bytes verified against previous release');return old;}
for(const e of methodPatch.previousPublic)await preMethodPatchBytes(e.target);
assert.equal(oligo.previousSHA,'7149d51aa75509415d8dc55a6373b22ae5f217d6');assert.equal(oligo.portalVersion,'1.5.0');assert.equal(oligo.toolVersion,'0.2.0');assert.equal(oligo.previousPublic.length,135);
const preOligoHome=html=>html.replace(oligo.portalRow,'').replace('실행 가능 9개','실행 가능 8개').replaceAll('포털 v1.5.0','포털 v1.4.0');
async function preOligoBytes(target){const bytes=await preMethodPatchBytes(target);return target==='index.html'?Buffer.from(preOligoHome(bytes.toString())):/^info\/.*\.html$/.test(target)?Buffer.from(bytes.toString().replaceAll('포털 v1.5.0','포털 v1.4.0')):bytes;}
for(const entry of oligo.previousPublic)assert.equal(hash(await preOligoBytes(entry.target)),entry.sha256,'Previous public content retained before Oligo: '+entry.target);

assert.equal(method.previousSHA,'6676a974052082676efbe953e9570517462f6bbd');assert.equal(method.portalVersion,'1.4.0');assert.equal(method.toolVersion,'0.3.0');assert.equal(method.previousPublic.length,111);
const previousHome=html=>preOligoHome(html).replace(method.portalRow,'').replace('실행 가능 8개','실행 가능 7개').replaceAll('포털 v1.4.0','포털 v1.3.0');
async function historicBytes(target){const bytes=await preOligoBytes(target);return target==='index.html'?Buffer.from(previousHome(bytes.toString())):/^info\/.*\.html$/.test(target)?Buffer.from(bytes.toString().replaceAll('포털 v1.4.0','포털 v1.3.0')):bytes;}
for(const entry of method.previousPublic)assert.equal(hash(await historicBytes(entry.target)),entry.sha256,'Previous public content retained: '+entry.target);

assert.equal(manifest.version,'1.6.3');assert.equal(manifest.candidate,undefined);
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
assert.equal(manifest.files.length,160);assert.equal(new Set(manifest.files.map(e=>e.target)).size,160);
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
assert(home.includes('실행 가능 9개')&&home.includes('준비중 0개'));
const aaRows=[...home.matchAll(/<tr class="available">[\s\S]*?<\/tr>/g)].filter(m=>m[0].includes('<h2>Amplification Analysis</h2>'));
assert.equal(aaRows.length,1);assert(aaRows[0][0].includes('도구 v0.1.0-beta.1')&&aaRows[0][0].includes('베타'));
assert.equal(contract.appVersion,'0.1.0-beta.1');assert.equal(contract.analysisSchema,15);assert.equal(contract.selectedDataSchema,9);assert.equal(contract.releasedOn,'2026-10-06');
const nucRows=[...home.matchAll(/<tr class="available">[\s\S]*?<\/tr>/g)].filter(m=>m[0].includes('tools/nucleic-acid-calculator/'));
assert.equal(nucRows.length,1);assert(nucRows[0][0].includes('도구 v1.1.0 · 알고리즘 v0.3.0')&&nucRows[0][0].includes('확인 2026-10-06'));
const reagentRows=[...home.matchAll(/<tr class="available">[\s\S]*?<\/tr>/g)].filter(m=>m[0].includes('tools/dilution-calculator/'));
assert.equal(reagentRows.length,1);assert(reagentRows[0][0].includes('시약·버퍼 조제')&&reagentRows[0][0].includes('도구 v1.2.0 · 조제 v0.2.0')&&reagentRows[0][0].includes('2026-10-08'));
const priorHome=previousHome((await preMethodPatchBytes('index.html')).toString()).replace(reagentRows[0][0],buffer.oldRow).replaceAll('포털 v1.3.0','포털 v1.2.1');
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
console.log('PASS: reviewed160-file portal1.6.3 artifact; all107 prior paths preserved; selected reagent update; nucleic release preserved; exact unchanged beta.1 runtime27 and nested assets valid.');
