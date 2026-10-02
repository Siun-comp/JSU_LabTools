import {readFile,readdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),dist=resolve(root,'dist');
const manifest=JSON.parse(await readFile(resolve(root,'public-manifest.json'),'utf8'));
async function files(base,prefix=''){const out=[];for(const e of await readdir(base,{withFileTypes:true})){const name=prefix+e.name;assert(!e.isSymbolicLink(),'No symlinks');if(e.isDirectory())out.push(...await files(resolve(base,e.name),name+'/'));else out.push(name);}return out;}
assert.deepEqual((await files(dist)).sort(),manifest.files.map(e=>e.target).sort(),'Artifact allowlist');
for(const entry of manifest.files)assert((await readFile(resolve(root,entry.source))).equals(await readFile(resolve(dist,entry.target))),'Source/artifact bytes');
const expected='https://siun-comp.github.io/isoamplar-plot-analysis-t/';
for(const path of ['index.html','info/plot.html','info/oligo-mix.html']){
 const html=await readFile(resolve(dist,path),'utf8');
 assert(!/<(script|iframe|input|textarea|form)\b/i.test(html),'No analysis input or script');
 assert(!/(?:^|["' >])[A-Z]:[\\/]|file:|localhost|127\.0\.0\.1|design\/|\.codex|https?:\/\/[^"<\s]*\?/i.test(html),'No local/internal paths or outgoing parameters');
 const remote=[...html.matchAll(/(?:href|src)="(https?:[^"]+)"/g)].map(m=>m[1]);
 assert.deepEqual(remote,path==='info/oligo-mix.html'?[]:[expected],'Only selected external Plot link');
 const run=html.match(/<a\b[^>]*class="execute"[^>]+>/)[0];
 for(const attr of ['target="_blank"','rel="noopener noreferrer"','referrerpolicy="no-referrer"'])assert(run.includes(attr),'Safe new tab');
 assert(html.includes('v'+manifest.version)&&html.includes('2026-10-02'),'Portal version/date');
 if(path==='info/oligo-mix.html')assert(html.includes('<dt>도구 버전</dt><dd>v0.4.0')&&html.includes('<dt>계산 알고리즘</dt><dd>v0.4.0')&&html.includes('확인 전'),'Tool/algorithm versions and pending Excel');
 else assert(html.includes('v1.3.0'),'Existing Plot version');
 for(const m of html.matchAll(/(?:href|src)="([^"]+)"/g)){if(m[1].startsWith('http')||m[1].startsWith('#'))continue;await readFile(resolve(dirname(resolve(dist,path)),m[1]));}
}
const home=await readFile(resolve(dist,'index.html'),'utf8');
const rows=[...home.matchAll(/<tr class="planned">([\s\S]*?)<\/tr>/g)];
assert.equal(rows.length,4,'Four pending tools');
for(const row of rows){assert(!/<a\b|v\d+\.\d+/.test(row[1]),'No links/versions for planned tools');assert(row[1].includes('준비중'),'Actual pending status');}
assert(home.includes('P6 검토 대기'),'P6 deferred');
assert(home.includes('LoB · LoD · LoQ 분석')&&home.includes('복사·보완 계획'),'LoBDQ plan only; no execution link');
assert.equal((home.match(/class="tool-glyph"/g)||[]).length,6,'Six selected entries');
assert(home.includes('실행 가능 2개')&&home.includes('준비중 4개'),'Counts');
const localRun=home.match(/<a\b[^>]*href="tools\/oligo-mix\/index.html"[^>]+>/)[0];
for(const attr of ['target="_blank"','rel="noopener noreferrer"','referrerpolicy="no-referrer"'])assert(localRun.includes(attr),'Safe independent Oligo tab');
assert(home.includes('Excel 확인 전'),'Unverified Excel visible');
console.log('PASS: full artifact and source bytes, local links, preserved Plot, independent Oligo link/version/pending Excel, 4 pending tools, no experimental portal inputs/scripts.');
