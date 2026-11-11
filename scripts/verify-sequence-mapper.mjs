import {readFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),dist=resolve(root,'dist'),prefix='tools/sequence-mapper/';
const manifest=JSON.parse(await readFile(resolve(root,'public-manifest.json'),'utf8'));
const R=JSON.parse(await readFile(new URL('./release-versions.json',import.meta.url),'utf8')),M=R.tools['sequence-mapper'];
const sha=b=>createHash('sha256').update(b).digest('hex'),read=p=>readFile(resolve(dist,p),'utf8');
// Exactly the reviewed 43 tool files (41 until 0.1.0-beta.2; core/zip.mjs and view/primer-cells.mjs added in beta.3), published byte for byte from their sources.
const entries=manifest.files.filter(e=>e.target.startsWith(prefix));
assert.equal(entries.length,43);
for(const name of ['index.html','app.mjs','tool.css','icon.svg','brand.svg','LICENSE.txt','NOTICE.md','engine/engine.mjs','engine/mm2.wasm','engine/source/build.sh','engine/source/wrapper.c','engine/source/MINIMAP2-LICENSE.txt','engine/source/SIMDE-LICENSE.txt','workers/map-worker.mjs','workers/load-worker.mjs','workers/analysis-worker.mjs','workers/selection-worker.mjs'])assert(entries.some(e=>e.target===prefix+name),'Published: '+name);
for(const e of entries){
 assert.equal(e.source,e.target);
 const bytes=await readFile(resolve(root,e.source));assert(bytes.equals(await readFile(resolve(dist,e.target))));
 if(!e.target.endsWith('.wasm'))assert(!/[A-Z]:[\\/]|localhost|127\.0\.0\.1|validation\/|\.codex|0\.1\.0-dev\./.test(bytes.toString()),'No local paths or development versions: '+e.target);
}
// Version and beta label come from release-versions.json.
const html=await read(prefix+'index.html'),app=await read(prefix+'app.mjs');
assert(app.includes(`export const TOOL_VERSION='${M.version}';`));
assert(html.includes('<p>베타 · <span id="tool-version"></span></p>')&&!html.includes('개발판'));
assert(html.includes("connect-src 'self'")||html.includes("default-src 'self'"),'Same-origin content security policy');
assert(!/<iframe\b|https?:\/\//i.test(html),'Tool page loads nothing from other sites');
// The test access object exists only with ?e2e=1.
assert.equal((app.match(/window\.__sequenceMapper\b/g)||[]).length,1);
assert(app.includes("if(new URLSearchParams(location.search).has('e2e'))window.__sequenceMapper="),'Test access only on the e2e address');
// Sequences stay in the browser: the only network read is the fixed engine file.
for(const e of entries.filter(e=>e.target.endsWith('.mjs'))){
 const text=await read(e.target);
 assert(!/XMLHttpRequest|sendBeacon|localStorage|sessionStorage|indexedDB|WebSocket|EventSource|eval\s*\(|new Function/.test(text),'No transmission, storage or code execution: '+e.target);
 const fetches=[...text.matchAll(/fetch\(([^,)]+)/g)].map(m=>m[1]);
 assert.deepEqual(fetches,e.target===prefix+'app.mjs'?["'engine/mm2.wasm'"]:[],'Only the fixed engine read: '+e.target);
 for(const m of text.matchAll(/(?:from\s*|import\s*\(\s*|new URL\(\s*)['"](\.{1,2}\/[^'"]+)['"]/g))await readFile(resolve(dirname(resolve(dist,e.target)),m[1]));
}
// Engine bytes match the build record in NOTICE.md.
const notice=await read(prefix+'NOTICE.md');
assert(notice.includes(`minimap2 | ${M.engine} | MIT`)&&notice.includes('GPL-2.0-or-later'));
assert(notice.includes('`mm2.wasm` SHA-256 `'+sha(await readFile(resolve(dist,prefix+'engine/mm2.wasm')))+'`'),'Engine hash recorded');
// Portal row and information page.
const home=await read('index.html');
const row=[...home.matchAll(/<tr class="available">[\s\S]*?<\/tr>/g)].map(m=>m[0]).find(r=>r.includes('<h2>Sequence Mapper</h2>'));
assert(row&&row.includes(`도구 v${M.version}`)&&row.includes('확인 '+M.infoDate)&&row.includes('베타')&&row.includes('href="info/sequence-mapper.html"'));
for(const attr of ['href="tools/sequence-mapper/index.html"','target="_blank"','rel="noopener noreferrer"','referrerpolicy="no-referrer"'])assert(row.includes(attr),'Safe new tab: '+attr);
const info=await read('info/sequence-mapper.html');
for(const text of ['v'+M.version,M.infoDate,'포털 v'+R.portal.version,'minimap2 '+M.engine,'증폭 성공이나 검출 성능을 뜻하지 않습니다','합성 서열','외부 전송·자동 저장 없음','href="../contact.html#sequence-mapper"'])assert(info.includes(text),'Information page: '+text);
assert(!/<(?:script|input|textarea|form|iframe)\b/.test(info));
console.log(`PASS: Sequence Mapper ${M.version} source43, beta label, e2e-only test access, engine-only network read and recorded hash, portal row and information page.`);
