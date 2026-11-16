import {readFile,readdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),base=resolve(root,'dist/tools/method-comparison');
const manifest=JSON.parse(await readFile(resolve(root,'public-manifest.json'),'utf8'));
const R=JSON.parse(await readFile(new URL('./release-versions.json',import.meta.url),'utf8')),M=R.tools['method-comparison'];
const contracts=JSON.parse(await readFile(resolve(root,'amplification-release-contract.json'),'utf8')),contract=contracts.methodComparisonPracticalRelease,current=contracts.analyseItRelease;
const entries=manifest.files.filter(e=>e.target.startsWith('tools/method-comparison/'));
// 0.4.1 (practical release, 35 files) stays a fixed historical record; 0.5.0 adds Passing–Bablok, R cross-check runtime and licenses (48 files).
assert.equal(entries.length,48);assert.equal(manifest.version,R.portal.version);assert.equal(contract.toolVersion,'0.4.1');assert.equal(current.methodComparison.version,M.version);assert.equal(current.methodComparison.previousVersion,contract.toolVersion);
for(const name of ['passing-bablok.mjs','r-check.mjs','licenses/GPL-2.txt','licenses/GPL-3.txt',...['Rcpp_1.1.2','robslopes_1.1.4','mcr_1.3.3.1'].flatMap(p=>['runtime/'+p+'.tgz','runtime/'+p+'.metadata.json','runtime/'+p+'.source.tar.gz'])])assert(entries.some(e=>e.target==='tools/method-comparison/'+name),'0.5.0 file: '+name);
const read=name=>readFile(resolve(base,name),'utf8');
const html=await read('index.html'),app=await read('app.mjs'),core=await read('core.mjs');
assert(html.includes('도구 v'+M.version)&&!/로컬 v|dev\./.test(html));assert(core.includes(`VERSION='${M.version}'`));
for(const id of ['file','input','analyze','ct-filter','date-filter','copy','export','median','rows','independent','same-scale','comparison-unit','ba-tolerance','ba-lower','ba-upper'])assert(html.includes(`id="${id}"`));
for(let i=1;i<=6;i++)assert(html.includes(`id="date-boundary-${i}" type="date"`));
assert.equal((html.match(/data-tab=/g)||[]).length,6);assert(!html.includes('data-tab="deming"'));
for(const e of entries){
 const bytes=await readFile(resolve(root,e.source));assert(bytes.equals(await readFile(resolve(root,'dist',e.target))));
 if(/\.(html|mjs|css)$/.test(e.target))assert(!/\d\.\d\.\d-dev\.|localhost|127\.0\.0\.1|[A-Z]:[\\/]|validation\//.test(bytes.toString()),'No development paths or versions: '+e.target);
}
for(const name of (await readdir(base)).filter(n=>n.endsWith('.mjs'))){
 const text=await read(name);assert(!/XMLHttpRequest|sendBeacon|localStorage|sessionStorage|postMessage|eval\s*\(|new Function/.test(text),'No input transmission/storage/execution');
 for(const m of text.matchAll(/(?:from\s*|import\s*)['"](\.\/[^'"]+)['"]/g))await readFile(resolve(base,m[1]));
}
assert(!/fetch\s*\(/.test(app));assert(app.includes('inputAudit(snapshot.rows)')&&app.includes('evaluability.p'));
assert(!app.includes('s.productUnknown')&&!app.includes('s.unknownResult'));
const report=await read('report-export.mjs');assert(report.includes("fetch(new URL('./report-template.xlsx',import.meta.url))"));
assert(report.includes('Malgun Gothic')&&report.includes('dateLabels(snapshot.dates)'));
assert(app.includes('ClipboardItem'));assert((await read('import.mjs')).includes('extractInput(records)'));
assert(!(await read('import.mjs')).includes('sourceRow<7'));
const template=await readFile(resolve(root,'dist',contract.reportTemplateTarget));assert.equal(createHash('sha256').update(template).digest('hex'),contract.reportTemplateSHA256);
const home=await readFile(resolve(root,'dist/index.html'),'utf8');assert(home.includes(current.methodComparisonRow));
assert.equal((home.match(/<h2>검사법 비교 분석<\/h2>/g)||[]).length,1);
const info=await readFile(resolve(root,'dist/info/method-comparison.html'),'utf8');
for(const text of ['v'+M.version,M.infoDate,'포털 v'+R.portal.version,'OLS가 기본','Deming','Passing–Bablok','R로 다시 계산해 대조','LoA','전체 입력 원문은 기본 미포함','help.html'])assert(info.includes(text));
assert(!/<(?:script|input|textarea|form|iframe)\b/.test(info));
assert(html.includes('data-help="start"')&&html.includes('help.html')&&html.includes('<option value="pb">')&&html.includes('id="example-kind"'));
// R cross-check: fixed package files with pinned hashes, loaded only from this folder; webR from the official site.
const rcheck=await read('r-check.mjs');for(const p of ['Rcpp','robslopes','mcr'])assert(rcheck.includes("name:'"+p+"'"));assert(rcheck.includes("https://webr.r-wasm.org/v0.6.0/"));
for(const m of rcheck.matchAll(/name:'([^']+)',version:'([^']+)',sha256:'([0-9a-f]{64})',metadataSHA256:'([0-9a-f]{64})'/g)){assert.equal(createHash('sha256').update(await readFile(resolve(base,'runtime',m[1]+'_'+m[2]+'.tgz'))).digest('hex'),m[3]);assert.equal(createHash('sha256').update(await readFile(resolve(base,'runtime',m[1]+'_'+m[2]+'.metadata.json'))).digest('hex'),m[4]);}
assert((await read('notices.html')).includes('GPL'));
const observations=await read('ba-observation.mjs');assert(observations.includes('difference<limits[0]')&&observations.includes('difference>limits[1]'));
assert((await read('comparison-view.mjs')).includes('ba-loa-outside'));assert((await read('unified-report.mjs')).includes('pointSeries'));
const practical=await read('practical-data.mjs');assert(practical.includes('demingSpecimen')&&practical.includes('baBands')&&practical.includes('selectSpecimens'));
assert(app.includes('data-group-kind')&&app.includes('output-preview'));
assert(report.includes('dispBlanksAs')&&report.includes('gap')&&report.includes('tickLblPos')&&report.includes('low'));
const old=contract.previousPublic;
for(const name of ['comparison.mjs','math.mjs','headers.mjs','import.mjs','ba-observation.mjs','report-template.xlsx','vendor/jszip.min.js'])assert.equal(createHash('sha256').update(await readFile(resolve(base,name))).digest('hex'),old.find(e=>e.target==='tools/method-comparison/'+name).sha256,'Preserved numerical/input/template bytes: '+name);
console.log(`PASS: method-comparison${M.version} source48 (Passing–Bablok, pinned R cross-check runtime), six purpose tabs, BA/Deming/help/classification, native report template and local processing, portal${R.portal.version}.`);
