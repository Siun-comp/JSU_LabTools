import {readFile,readdir} from 'node:fs/promises';
import {resolve,dirname,relative,isAbsolute,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import assert from 'node:assert/strict';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),dist=resolve(root,'dist');
const manifest=JSON.parse(await readFile(resolve(root,'public-manifest.json'),'utf8'));
const R=JSON.parse(await readFile(new URL('./release-versions.json',import.meta.url),'utf8')),T=R.tools;
const contract=JSON.parse(await readFile(resolve(root,'amplification-release-contract.json'),'utf8'));
const hash=b=>createHash('sha256').update(b).digest('hex');
async function files(base,prefix=''){const out=[];for(const e of await readdir(base,{withFileTypes:true})){assert(!e.isSymbolicLink(),'Symlink rejected');const p=prefix+e.name;if(e.isDirectory())out.push(...await files(resolve(base,e.name),p+'/'));else out.push(p);}return out;}
const update=contract.nucleicRelease,buffer=contract.bufferRelease;
const method=contract.methodComparisonRelease;
const oligo=contract.oligoDimerRelease;
const methodPatch=contract.methodComparisonPatchRelease;
assert.equal(methodPatch.previousSHA,'c327726c97a43133c1fbe4c91540960b91ff21e0');assert.equal(methodPatch.portalVersion,'1.5.1');assert.equal(methodPatch.toolVersion,'0.3.1');assert.equal(methodPatch.previousPublic.length,142);
const gitRoot=existsSync(resolve(root,'.git'))?root:resolve(root,'release/p1/repository');
const mapperRelease=contract.sequenceMapperRelease;
assert.equal(mapperRelease.previousSHA,'b0d50ca7f942d58c1354586644500251a77c37ee');
assert.equal(mapperRelease.portalVersion,manifest.version);assert.equal(mapperRelease.previousPortalVersion,'1.8.3');assert.equal(mapperRelease.toolVersion,T['sequence-mapper'].version);
assert.equal(mapperRelease.previousPublic.length,234);assert.equal(mapperRelease.addedTargets.length,42);
assert.deepEqual(manifest.files,[
 ...mapperRelease.previousPublic.map(({source,target})=>({source,target})),
 ...mapperRelease.addedTargets.map(target=>({source:target.startsWith('info/')?'portal/'+target:target,target})),
],'Sequence Mapper release only appends its files and information page');
assert.deepEqual(mapperRelease.addedTargets.filter(t=>!t.startsWith('tools/sequence-mapper/')),['info/sequence-mapper.html']);
assert.deepEqual(mapperRelease.selected.map(e=>e.target).sort(),['index.html','contact.html','assets/contact.mjs',...mapperRelease.previousPublic.filter(e=>/^info\/.*\.html$/.test(e.target)).map(e=>e.target)].sort(),'Only portal list, contact page and version footers change');
const beforeMapper=new Map();
for(const entry of mapperRelease.previousPublic){
 const current=await readFile(resolve(dist,entry.target));
 const changed=mapperRelease.selected.find(e=>e.target===entry.target);
 if(changed)assert.equal(hash(current),changed.sha256,'Reviewed Sequence Mapper release change: '+entry.target);
 const previous=changed?execFileSync('git',['-C',gitRoot,'show',mapperRelease.previousSHA+':'+entry.source]):current;
 assert.equal(hash(previous),entry.sha256,'Portal bytes before Sequence Mapper: '+entry.target);
 beforeMapper.set(entry.target,previous);
}
for(const e of mapperRelease.selected.filter(e=>/^info\/.*\.html$/.test(e.target)))assert.equal(beforeMapper.get(e.target).toString().replace('포털 v1.8.3','포털 v1.8.4'),(await readFile(resolve(dist,e.target))).toString(),'Information pages change only the portal version: '+e.target);
const contactRelease=contract.contactRelease;
assert.equal(contactRelease.previousSHA,'4086b0880ea6f4c711187df544dc8f9576f3d0af');
assert.equal(contactRelease.portalVersion,mapperRelease.previousPortalVersion);
assert.equal(contactRelease.previousPublic.length,232);
assert.deepEqual(contactRelease.addedTargets,['contact.html','assets/contact.mjs']);
const previousPortalFiles=contactRelease.previousPublic.map(({source,target})=>({source,target}));
assert.deepEqual(mapperRelease.previousPublic.map(({source,target})=>({source,target})),[
 ...previousPortalFiles,
 ...contactRelease.addedTargets.map(target=>({source:'portal/'+target,target})),
]);
const contactChanges=new Map(contactRelease.selected.map(entry=>[entry.target,entry]));
assert.deepEqual([...contactChanges.keys()].sort(),[
 'index.html','assets/portal.css',...previousPortalFiles.filter(e=>e.target.startsWith('info/')).map(e=>e.target),
].sort());
const beforeContact=new Map();
for(const entry of contactRelease.previousPublic){
 const current=beforeMapper.get(entry.target);
 const changed=contactChanges.get(entry.target);
 if(changed)assert.equal(hash(current),changed.sha256,'Reviewed contact change: '+entry.target);
 const previous=changed?execFileSync('git',['-C',gitRoot,'show',contactRelease.previousSHA+':'+entry.source]):current;
 assert.equal(hash(previous),entry.sha256,'Prior portal bytes: '+entry.target);
 beforeContact.set(entry.target,previous);
}
const mergedPatch=contract.oligoMergedRelease;
assert.equal(mergedPatch.previousSHA,'b7aa6ce7f243d2c4f3e40427a0bf6180557567ec');assert.equal(mergedPatch.portalVersion,contactRelease.previousPortalVersion);assert.equal(mergedPatch.toolVersion,'0.2.3');assert.equal(mergedPatch.plotVersion,'2.3.0');
assert.deepEqual(previousPortalFiles,mergedPatch.previousPublic.map(({source,target})=>({source,target})));
assert.deepEqual(mergedPatch.selected.map(e=>e.target).sort(),[...previousPortalFiles.filter(e=>e.target==='index.html'||e.target.startsWith('info/')).map(e=>e.target),'tools/oligo-analysis/index.html','tools/oligo-analysis/core.mjs'].sort());
async function preMergedBytes(target){
 const entry=mergedPatch.previousPublic.find(e=>e.target===target);assert(entry);
 const bytes=beforeContact.get(target),selected=mergedPatch.selected.find(e=>e.target===target);
 if(selected)assert.equal(hash(bytes),selected.sha256,'Reviewed merged paste release '+target);
 const old=selected?execFileSync('git',['-C',gitRoot,'show',mergedPatch.previousSHA+':'+entry.source]):bytes;
 assert.equal(hash(old),entry.sha256,'Previous release bytes '+target);return old;
}
for(const e of mergedPatch.previousPublic)await preMergedBytes(e.target);
const excelPatch=contract.oligoExcelRelease;
assert.equal(excelPatch.previousSHA,'62dc3868cad1f7cec342b8cf3b4306e61aaf9b32');assert.equal(excelPatch.toolVersion,'0.2.2');
const priorTargets=new Set(excelPatch.previousPublic.map(e=>e.target));
const priorFiles=manifest.files.filter(e=>priorTargets.has(e.target));
assert.deepEqual(priorFiles,excelPatch.previousPublic.map(({source,target})=>({source,target})));
assert.deepEqual(previousPortalFiles.filter(e=>!priorTargets.has(e.target)).map(e=>e.target),['tools/oligo-analysis/xlsx.mjs']);
assert.deepEqual(excelPatch.selected.map(e=>e.target).sort(),['index.html','info/oligo-analysis.html',...['app.mjs','core.mjs','index.html','xlsx.mjs'].map(name=>'tools/oligo-analysis/'+name)].sort());
async function preExcelBytes(target){
 const entry=excelPatch.previousPublic.find(e=>e.target===target);assert(entry);
 const bytes=await preMergedBytes(target),changed=excelPatch.selected.find(e=>e.target===target);
 if(changed)assert.equal(hash(bytes),changed.sha256);
 const old=changed?execFileSync('git',['-C',gitRoot,'show',excelPatch.previousSHA+':'+entry.source]):bytes;
 assert.equal(hash(old),entry.sha256,'Prior public bytes: '+target);return old;
}
for(const e of excelPatch.previousPublic)await preExcelBytes(e.target);
const plotPatch=contract.plotMetadataRelease;
assert.equal(plotPatch.previousSHA,'8d6f67a946940f875859d94d75130f783f2a20a3');assert.equal(plotPatch.portalVersion,mergedPatch.previousPortalVersion);assert.equal(plotPatch.plotVersion,'2.2.0');assert.equal(plotPatch.previousPublic.length,231);
assert.deepEqual(priorFiles,plotPatch.previousPublic.map(({source,target})=>({source,target})),'Plot metadata update keeps all public paths');
assert.deepEqual(plotPatch.selected.map(e=>e.target).sort(),previousPortalFiles.filter(e=>e.target==='index.html'||/^info\/.*\.html$/.test(e.target)).map(e=>e.target).sort(),'Only portal metadata and version footers selected');
const prePlotCache=new Map();
async function prePlotBytes(target){if(prePlotCache.has(target))return prePlotCache.get(target);const entry=plotPatch.previousPublic.find(e=>e.target===target);assert(entry);const bytes=await preExcelBytes(target),selected=plotPatch.selected.find(e=>e.target===target);let old=bytes;if(selected){assert.equal(hash(bytes),selected.sha256,'Reviewed metadata bytes: '+target);old=execFileSync('git',['-C',gitRoot,'show',plotPatch.previousSHA+':'+entry.source]);}assert.equal(hash(old),entry.sha256,'Previous public bytes retained: '+target);prePlotCache.set(target,old);return old;}
for(const e of plotPatch.previousPublic)await prePlotBytes(e.target);
const upgrade=contract.thermodynamicsUpgradeRelease;
assert.equal(upgrade.previousSHA,'fe493ffc7a5ba5a367fb5533c569b260274586c3');assert.equal(upgrade.portalVersion,plotPatch.previousPortalVersion);assert.equal(upgrade.toolVersion,'0.2.0-beta.1');assert.equal(upgrade.previousPublic.length,188);
assert.deepEqual(priorFiles.filter(e=>!upgrade.previousPublic.some(p=>p.target===e.target)).map(e=>e.target).sort(),upgrade.addedTargets.toSorted(),'Only reviewed integrated-tool additions');
async function preUpgradeBytes(target){const entry=upgrade.previousPublic.find(e=>e.target===target);assert(entry,'Previous upgrade path retained');const bytes=await prePlotBytes(target),selected=upgrade.selected.find(e=>e.target===target);if(!selected){assert.equal(hash(bytes),entry.sha256,'Unselected upgrade bytes: '+target);return bytes;}assert.equal(hash(bytes),selected.sha256,'Selected upgrade bytes: '+target);const old=execFileSync('git',['-C',gitRoot,'show',upgrade.previousSHA+':'+entry.source]);assert.equal(hash(old),entry.sha256,'Previous upgrade bytes from Git');return old;}
for(const e of upgrade.previousPublic){assert(manifest.files.some(p=>p.source===e.source&&p.target===e.target));await preUpgradeBytes(e.target);}
const notFound=contract.notFoundRelease;
assert.equal(notFound.previousSHA,'3b3b144d8012ae49a3dd5624cfe0c6027e2f933f');assert.equal(notFound.portalVersion,upgrade.previousPortalVersion);assert.equal(notFound.pageVersion,'1.0.0');assert.equal(notFound.previousPublic.length,187);
assert.deepEqual(notFound.addedTargets,['404.html']);
assert.deepEqual(upgrade.previousPublic.map(({source,target})=>({source,target})).filter(e=>!notFound.previousPublic.some(p=>p.target===e.target)),[{source:'portal/404.html',target:'404.html'}],'Only the reviewed 404 page is added');
for(const e of notFound.previousPublic){assert(manifest.files.some(p=>p.source===e.source&&p.target===e.target),'Prior entry retained: '+e.target);const bytes=await preUpgradeBytes(e.target);assert.equal(bytes.length,e.bytes);assert.equal(hash(bytes),e.sha256,'All 187 existing assets preserved: '+e.target);}
const notFoundHtml=await readFile(resolve(dist,'404.html'),'utf8');
assert(notFoundHtml.includes('페이지를 찾을 수 없습니다')&&notFoundHtml.includes('404 · NOT FOUND'));
assert(notFoundHtml.includes('name="robots" content="noindex"')&&notFoundHtml.includes('name="viewport"'));
assert(!/<(?:script|form|input|iframe|link|img)\b/i.test(notFoundHtml),'404 stays self-contained at every missing URL depth');
assert.deepEqual([...notFoundHtml.matchAll(/href="([^"]+)"/g)].map(m=>m[1]),['https://jsu-labtools.pages.dev/'],'404 always returns to the new portal');
const thermodynamics=contract.oligoThermodynamicsRelease;
assert.equal(thermodynamics.previousSHA,'67ffba9199fa8aad2ed1aa31149e85813deb7b23');assert.equal(thermodynamics.portalVersion,upgrade.previousPortalVersion);assert.equal(thermodynamics.toolVersion,'0.1.0-beta.1');assert.equal(thermodynamics.previousPublic.length,160);assert.equal(thermodynamics.addedTargets.length,27);
async function preThermodynamicsBytes(target){const entry=thermodynamics.previousPublic.find(e=>e.target===target);assert(entry,'Previous thermodynamics release path retained');const bytes=await preUpgradeBytes(target),selected=thermodynamics.selected.find(e=>e.target===target);if(!selected){assert.equal(hash(bytes),entry.sha256,'Unselected thermodynamics release bytes: '+target);return bytes;}assert.equal(hash(bytes),selected.sha256,'Selected thermodynamics release bytes: '+target);const old=execFileSync('git',['-C',gitRoot,'show',thermodynamics.previousSHA+':'+entry.source]);assert.equal(hash(old),entry.sha256,'Previous thermodynamics release bytes from Git');return old;}
for(const e of thermodynamics.previousPublic)await preThermodynamicsBytes(e.target);
assert.deepEqual(notFound.previousPublic.filter(e=>!thermodynamics.previousPublic.some(p=>p.target===e.target)).map(e=>e.target).sort(),thermodynamics.addedTargets.toSorted(),'Only new independent thermodynamics public entries');
const sequenceRelease=contract.sequenceNumberingRelease;
assert.equal(sequenceRelease.previousSHA,'756fbf0a291310fb00ee0b530c5f270dde903760');assert.equal(sequenceRelease.portalVersion,thermodynamics.previousPortalVersion);assert.equal(sequenceRelease.toolVersion,'1.0.2');assert.equal(sequenceRelease.algorithmVersion,'0.2.3');assert.equal(sequenceRelease.previousPublic.length,160);assert.deepEqual(sequenceRelease.addedTargets,[]);
assert.deepEqual(sequenceRelease.selected.map(e=>e.target).sort(),['index.html',...thermodynamics.previousPublic.filter(e=>e.target.startsWith('info/')).map(e=>e.target),'tools/sequence/app.mjs','tools/sequence/core.mjs'].sort());
async function preSequenceBytes(target){const entry=sequenceRelease.previousPublic.find(e=>e.target===target);assert(entry,'Previous Sequence release path retained');const bytes=await preThermodynamicsBytes(target),selected=sequenceRelease.selected.find(e=>e.target===target);if(!selected){assert.equal(hash(bytes),entry.sha256,'Unselected Sequence release bytes: '+target);return bytes;}assert.equal(hash(bytes),selected.sha256,'Selected Sequence release bytes: '+target);const old=execFileSync('git',['-C',gitRoot,'show',sequenceRelease.previousSHA+':'+entry.source]);assert.equal(hash(old),entry.sha256,'Previous Sequence release bytes from Git');return old;}
for(const e of sequenceRelease.previousPublic)await preSequenceBytes(e.target);
assert.deepEqual(thermodynamics.previousPublic.map(e=>e.target).sort(),sequenceRelease.previousPublic.map(e=>e.target).sort(),'Previous Sequence paths preserved exactly');
const practicalRelease=contract.methodComparisonPracticalRelease;
assert.equal(practicalRelease.previousSHA,'0aa80f34206b66754ceb0321d0a3a15966b6b9a9');assert.equal(practicalRelease.portalVersion,'1.6.2');assert.equal(practicalRelease.toolVersion,'0.4.1');assert.equal(practicalRelease.previousPublic.length,159);assert.deepEqual(practicalRelease.addedTargets,['tools/method-comparison/practical-data.mjs']);
async function prePracticalBytes(target){const entry=practicalRelease.previousPublic.find(e=>e.target===target);assert(entry,'Previous practical release path retained');const bytes=await preSequenceBytes(target),selected=practicalRelease.selected.find(e=>e.target===target);if(!selected){assert.equal(hash(bytes),entry.sha256,'Unselected practical release bytes: '+target);return bytes;}assert.equal(hash(bytes),selected.sha256,'Selected practical release bytes: '+target);const old=execFileSync('git',['-C',gitRoot,'show',practicalRelease.previousSHA+':'+entry.source]);assert.equal(hash(old),entry.sha256,'Previous practical release bytes from Git');return old;}
for(const e of practicalRelease.previousPublic)await prePracticalBytes(e.target);
assert.deepEqual(thermodynamics.previousPublic.filter(e=>!practicalRelease.previousPublic.some(p=>p.target===e.target)).map(e=>e.target).sort(),practicalRelease.addedTargets.toSorted(),'Only reviewed practical addition in its release');
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

assert.equal(manifest.version,R.portal.version);assert.equal(manifest.candidate,undefined);
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
assert.equal(manifest.files.length,R.portal.files);assert.equal(new Set(manifest.files.map(e=>e.target)).size,R.portal.files);
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
assert((await prePlotBytes('index.html')).toString().includes(upgrade.currentPlotRow),'Historical Plot2.0 row preserved');
assert((await preMergedBytes('index.html')).toString().includes(plotPatch.currentPlotRow),'Historical Plot2.2 row');
assert(home.includes(mergedPatch.plotRow)&&home.includes(`화면 v${T.plot.version} · 문서 v${T.plot.version}`),'Reviewed Plot2.3 row');
const plotInfo=(await preMergedBytes('info/plot.html')).toString();
const currentPlotInfo=await readFile(resolve(dist,'info/plot.html'),'utf8');
for(const marker of ['v'+T.plot.version,T.plot.infoDate,'평문 TXT','schema 10','schema 9','암호화 로그는 지원하지 않습니다'])assert(currentPlotInfo.includes(marker));
for(const marker of ['v2.2.0','2026-11-01','디코딩된 장비 CSV','.chamber-preset.json','미리 본 뒤 명시적으로 적용','검체명·형광값·Threshold는 포함하지 않습니다','별도의 재적용 확인','다시 시험하지 않았습니다'])assert(plotInfo.includes(marker),'Plot metadata scope: '+marker);
assert(home.includes('실행 가능 '+R.portal.available+'개')&&home.includes('준비중 0개'));
const aaRows=[...home.matchAll(/<tr class="available">[\s\S]*?<\/tr>/g)].filter(m=>m[0].includes('<h2>Amplification Analysis</h2>'));
assert.equal(aaRows.length,1);assert(aaRows[0][0].includes('도구 v'+T['amplification-analysis'].version)&&aaRows[0][0].includes('베타'));
assert.equal(contract.appVersion,'0.1.0-beta.1');assert.equal(contract.analysisSchema,15);assert.equal(contract.selectedDataSchema,9);assert.equal(contract.releasedOn,'2026-10-06');
const nucRows=[...home.matchAll(/<tr class="available">[\s\S]*?<\/tr>/g)].filter(m=>m[0].includes('tools/nucleic-acid-calculator/'));
assert.equal(nucRows.length,1);assert(nucRows[0][0].includes(`도구 v${T['nucleic-acid'].version} · 알고리즘 v${T['nucleic-acid'].algorithm}`)&&nucRows[0][0].includes('확인 '+T['nucleic-acid'].infoDate));
const reagentRows=[...home.matchAll(/<tr class="available">[\s\S]*?<\/tr>/g)].filter(m=>m[0].includes('tools/dilution-calculator/'));
assert.equal(reagentRows.length,1);assert(reagentRows[0][0].includes('시약·버퍼 조제')&&reagentRows[0][0].includes(`도구 v${T.dilution.version} · 조제 v${T.dilution.composer}`)&&reagentRows[0][0].includes(T.dilution.infoDate));
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
for(const marker of [`VERSION='${T['nucleic-acid'].algorithm}'`,"'neb-web'","'thermo-web'","615.94","602200000000000000000000n"])assert(nucCore.includes(marker),'Selected nucleic web reference: '+marker);
const info=await readFile(resolve(dist,'info/amplification-analysis.html'),'utf8');
for(const text of ['베타','Excel 붙여넣기 사용자 확인','3행 형광','1, 2, 3','실제 사용 중','임시 결과','작업 재열기 후 다시 분석','시약 이름 차이','외삽'])assert(info.includes(text),'Support statement: '+text);
assert(!/<(?:script|input|textarea|form|iframe)\b/i.test(info),'Information page is read-only');
assert(!/localhost|127\.0\.0\.1|(?:^|["' >])[A-Z]:[\\/]|validation\//i.test(info+home),'No internal file paths');
for(const path of (await files(dist)).filter(p=>p.endsWith('.html')&&!p.startsWith('tools/detection-capability/'))){
 const html=await readFile(resolve(dist,path),'utf8');
 for(const m of html.matchAll(/(?:href|src)="([^" ]+)"/g)){
   if(/^(?:https?:|#|data:|blob:)/.test(m[1]))continue;
   if(path==='contact.html'&&m[1]==='mailto:siun.comp@gmail.com')continue;
   const href=m[1].split('#',1)[0];
   const asset=resolve(dirname(resolve(dist,path)),href.endsWith('/')?href+'index.html':href);
   const rel=relative(dist,asset);assert(rel&&!isAbsolute(rel)&&!rel.startsWith('..'+sep),'Local asset scope');await readFile(asset);
 }
}
const appBase=resolve(dist,'tools/amplification-analysis');
for(const e of contract.appFiles)assert.equal(hash(await readFile(resolve(appBase,e.path))),e.sha256,'Frozen beta runtime');
const appIndex=await readFile(resolve(appBase,'index.html'),'utf8');
const main=appIndex.match(/src="([^"]+\.js)"/)[1];
const mainText=await readFile(resolve(appBase,main),'utf8');
assert(mainText.includes(T['amplification-analysis'].version)&&!mainText.includes('0.1.0-dev.23'),'Built product version matches candidate');
assert(mainText.includes('증폭 곡선 분석 · 베타'),'Beta display');
const webManifest=JSON.parse(await readFile(resolve(appBase,'manifest.webmanifest'),'utf8'));
assert.equal(webManifest.name,'Amplification Analysis');assert.equal(webManifest.scope,'.');assert.equal(webManifest.start_url,'.');
for(const icon of webManifest.icons)await readFile(resolve(appBase,icon.src));
console.log('PASS: reviewed '+R.portal.files+'-file portal '+R.portal.version+' artifact, developer contact, and historical release preservation.');
