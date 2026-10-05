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
assert.equal(manifest.version,'1.2.0');assert.equal(manifest.candidate,undefined);
assert.equal(manifest.files.length,107);assert.equal(new Set(manifest.files.map(e=>e.target)).size,107);
assert.deepEqual((await files(dist)).sort(),manifest.files.map(e=>e.target).sort(),'Exact public allowlist');
for(const e of manifest.files){
 const source=resolve(root,e.source),target=resolve(dist,e.target);
 for(const [base,path] of [[root,source],[dist,target]]){const rel=relative(base,path);assert(rel&&!isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..'+sep),'Public path stays inside package');}
 assert((await readFile(source)).equals(await readFile(target)),'Source/build bytes: '+e.target);
 assert.equal(hash(await readFile(target)),contract.publicSelection.find(p=>p.target===e.target).sha256,'Frozen release bytes');
 // Existing public synthetic example workbooks stay in the immutable baseline.
 // Apply the private/source/experimental exclusion to newly added AA entries.
 if(!contract.baseline.files.some(p=>p.target===e.target))assert(!/(?:^|\/)(?:node_modules|\.git|src|validation|references|docs|tests)(?:\/|$)|\.map$|\.xlsx?$|\.pcrd$/i.test(e.target),'No new development/private/experimental files: '+e.target);
}
const targets=new Set(manifest.files.map(e=>e.target));
for(const e of contract.baseline.files)assert(targets.has(e.target),'Previous public path retained');
const home=await readFile(resolve(dist,'index.html'),'utf8');
assert(home.includes(contract.oldPlot),'Existing Plot row byte preserved');
assert(home.includes('실행 가능 7개')&&home.includes('준비중 0개'));
const aaRows=[...home.matchAll(/<tr class="available">[\s\S]*?<\/tr>/g)].filter(m=>m[0].includes('<h2>Amplification Analysis</h2>'));
assert.equal(aaRows.length,1);assert(aaRows[0][0].includes('도구 v0.1.0-beta.1')&&aaRows[0][0].includes('베타'));
assert.equal(contract.appVersion,'0.1.0-beta.1');assert.equal(contract.analysisSchema,15);assert.equal(contract.selectedDataSchema,9);assert.equal(contract.releasedOn,'2026-10-06');
let canonical=home.replace(aaRows[0][0],contract.oldAARow).replace('실행 가능 7개','실행 가능 6개').replace('준비중 0개','준비중 1개').replaceAll('포털 v1.2.0','포털 v1.1.3');
assert.equal(hash(canonical),contract.baseline.files.find(e=>e.target==='index.html').sha256,'Only selected home changes');
for(const e of contract.baseline.files.filter(e=>e.target!=='index.html')){
 const bytes=await readFile(resolve(dist,e.target));const original=/^info\/.*\.html$/.test(e.target)?Buffer.from(bytes.toString().replaceAll('포털 v1.2.0','포털 v1.1.3')):bytes;
 assert.equal(hash(original),e.sha256,'Existing tool bytes retained: '+e.target);
}
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
console.log('PASS: frozen107-file public release artifact; all79 previous paths preserved; exact beta.1 runtime27; selected portal changes and nested assets valid. Artifact verification.');
