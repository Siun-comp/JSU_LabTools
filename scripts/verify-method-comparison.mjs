import {readFile,readdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),base=resolve(root,'dist/tools/method-comparison');
const manifest=JSON.parse(await readFile(resolve(root,'public-manifest.json'),'utf8'));
const contract=(text=>{const c=JSON.parse(text);return {...c.methodComparisonRelease,...c.methodComparisonPatchRelease};})(await readFile(resolve(root,'amplification-release-contract.json'),'utf8'));
const entries=manifest.files.filter(e=>e.target.startsWith('tools/method-comparison/'));
assert.equal(entries.length,23);assert.equal(manifest.version,'1.5.2');assert.equal(contract.toolVersion,'0.3.1');
const read=name=>readFile(resolve(base,name),'utf8');
const html=await read('index.html'),app=await read('app.mjs'),core=await read('core.mjs');
assert(html.includes('도구 v0.3.1')&&!html.includes('로컬 개발판'));assert(core.includes("VERSION='0.3.1'"));
for(const id of ['file','input','analyze','ct-filter','date-filter','copy','export','median','rows'])assert(html.includes(`id="${id}"`));
for(let i=1;i<=6;i++)assert(html.includes(`id="date-boundary-${i}" type="date"`));
for(const e of entries){
 const bytes=await readFile(resolve(root,e.source));assert(bytes.equals(await readFile(resolve(root,'dist',e.target))));
 if(/\.(html|mjs|css)$/.test(e.target))assert(!/0\.3\.0-dev\.3|localhost|127\.0\.0\.1|[A-Z]:[\\/]|validation\//.test(bytes.toString()),'No internal paths: '+e.target);
}
for(const name of (await readdir(base)).filter(n=>n.endsWith('.mjs'))){
 const text=await read(name);assert(!/XMLHttpRequest|sendBeacon|localStorage|sessionStorage|postMessage|eval\s*\(|new Function/.test(text),'No input transmission/storage/execution');
 for(const m of text.matchAll(/(?:from\s*|import\s*)['"](\.\/[^'"]+)['"]/g))await readFile(resolve(base,m[1]));
}
assert(!/fetch\s*\(/.test(app));assert(app.includes('inputAudit(snapshot.rows)'));assert(app.includes('evaluability.p'));assert(!app.includes('s.productUnknown')&&!app.includes('s.unknownResult'));
const report=await read('report-export.mjs');assert(report.includes("fetch(new URL('./report-template.xlsx',import.meta.url))"));
assert(report.includes('Malgun Gothic')&&report.includes('dateLabels(snapshot.dates)'));
assert(app.includes('ClipboardItem')||await read('graph-copy.mjs').then(t=>t.includes('ClipboardItem')));
assert((await read('import.mjs')).includes('extractInput(records)'));assert(!(await read('import.mjs')).includes('sourceRow<7'));
const template=await readFile(resolve(root,'dist',contract.reportTemplateTarget));assert.equal(createHash('sha256').update(template).digest('hex'),contract.reportTemplateSHA256);
const home=await readFile(resolve(root,'dist/index.html'),'utf8');assert(home.includes(contract.portalRow));
assert.equal((home.match(/<h2>검사법 비교 분석<\/h2>/g)||[]).length,1);
const info=await readFile(resolve(root,'dist/info/method-comparison.html'),'utf8');assert(info.includes('v0.3.1')&&info.includes('2026-10-10')&&info.includes('포털 v1.5.2'));
assert(!/<(?:script|input|textarea|form|iframe)\b/.test(info));
console.log('PASS: method-comparison0.3.1 source23, six date controls, header recognition, frozen native report template, local processing and portal entry.');
