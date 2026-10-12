import {readFile,readdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),base=resolve(root,'dist/tools/method-comparison');
const manifest=JSON.parse(await readFile(resolve(root,'public-manifest.json'),'utf8'));
const contract=JSON.parse(await readFile(resolve(root,'amplification-release-contract.json'),'utf8')).methodComparisonRedesignRelease;
const entries=manifest.files.filter(e=>e.target.startsWith('tools/method-comparison/'));
assert.equal(entries.length,34);assert.equal(manifest.version,'1.6.0');assert.equal(contract.toolVersion,'0.4.0');
const read=name=>readFile(resolve(base,name),'utf8');
const html=await read('index.html'),app=await read('app.mjs'),core=await read('core.mjs');
assert(html.includes('도구 v0.4.0')&&!/로컬 v|dev\./.test(html));assert(core.includes("VERSION='0.4.0'"));
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
const home=await readFile(resolve(root,'dist/index.html'),'utf8');assert(home.includes(contract.portalRow));
assert.equal((home.match(/<h2>검사법 비교 분석<\/h2>/g)||[]).length,1);
const info=await readFile(resolve(root,'dist/info/method-comparison.html'),'utf8');
for(const text of ['v0.4.0','2026-10-13','포털 v1.6.0','OLS가 기본','Deming','LoA','전체 입력 원문은 기본 미포함','help.html'])assert(info.includes(text));
assert(!/<(?:script|input|textarea|form|iframe)\b/.test(info));
assert(html.includes('data-help="start"')&&html.includes('help.html'));
const observations=await read('ba-observation.mjs');assert(observations.includes('difference<limits[0]')&&observations.includes('difference>limits[1]'));
assert((await read('comparison-view.mjs')).includes('ba-loa-outside'));assert((await read('unified-report.mjs')).includes('pointSeries'));
console.log('PASS: method-comparison0.4.0 source34, six purpose tabs, BA/Deming/help/classification, native report template and local processing, portal1.6.0.');
