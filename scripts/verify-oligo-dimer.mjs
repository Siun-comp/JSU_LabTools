import {readFile,readdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),base=resolve(root,'dist/tools/oligo-analysis');
const manifest=JSON.parse(await readFile(resolve(root,'public-manifest.json'),'utf8'));
const contract=(text=>{const c=JSON.parse(text);return {...c.oligoDimerRelease,...c.oligoDimerPatchRelease};})(await readFile(resolve(root,'amplification-release-contract.json'),'utf8'));
const entries=manifest.files.filter(e=>e.target.startsWith('tools/oligo-analysis/'));
assert.equal(entries.length,6);assert.equal(manifest.version,'1.5.2');assert.equal(contract.toolVersion,'0.2.1');
const read=name=>readFile(resolve(base,name),'utf8'),html=await read('index.html'),core=await read('core.mjs'),app=await read('app.mjs');
for(const text of ['Oligo-dimer analysis','도구 v0.2.1','optimal sensitivity 3'])assert(html.includes(text));
assert(!html.includes('로컬 후보')&&!html.includes('공개 배포 전'));assert(core.includes("VERSION='0.2.1'"));
for(const id of ['sequences','analyze','preflight','start','include-self','include-hetero','include-poly','cutoff','terminal','poly-cutoff','copy-all','copy-pair','copy-all-notice','copy-pair-notice','save','cancel'])assert(html.includes(`id="${id}"`));
assert(html.includes("connect-src 'none'")&&html.includes("worker-src 'self'")&&html.includes("style-src-attr 'unsafe-inline'"));
assert.equal(createHash('sha256').update(await readFile(resolve(base,'dimer.mjs'))).digest('hex'),contract.engineSHA256);
for(const e of entries){const bytes=await readFile(resolve(root,e.source));assert(bytes.equals(await readFile(resolve(root,'dist',e.target))));assert(!/localhost|127\.0\.0\.1|validation\/|[A-Z]:[\\/]/.test(bytes.toString()));}
for(const name of (await readdir(base)).filter(n=>n.endsWith('.mjs'))){const text=await read(name);assert(!/fetch\s*\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|eval\s*\(|new Function/.test(text),'Browser local processing');for(const m of text.matchAll(/from ['"](.\/[^'"]+)['"]/g))await readFile(resolve(base,m[1]));}
assert(app.includes("new Worker")&&app.includes('ClipboardItem'));
assert(!html.match(/<input id="include-poly"[^>]*>/)[0].includes('checked'));assert(!html.match(/<input id="poly-cutoff"[^>]*>/)[0].includes('value='));for(const text of ['poly-category','IDT 관측값 대조 모델','IDT 공식 수치 기준이 아닙니다','탐색적 3분자'])assert(html.includes(text));
assert(core.includes("mono?'Courier New':'Malgun Gothic'")&&core.includes('height:16pt'));
const home=await readFile(resolve(root,'dist/index.html'),'utf8'),info=await readFile(resolve(root,'dist/info/oligo-analysis.html'),'utf8');
assert(home.includes(contract.portalRow));assert.equal((home.match(/<h2>Oligo-dimer analysis<\/h2>/g)||[]).length,1);
for(const text of ['Oligo-dimer analysis','v0.2.1','포털 v1.5.2','2026-10-10','실제 복합체 ΔG가 아닙니다','TmExtreme'])assert(info.includes(text));
assert(!/<(?:script|input|textarea|form|iframe)\b/.test(info));
console.log('PASS: Oligo-dimer analysis0.2.1 source6, frozen engine, local Worker/clipboard, explicit bounds and portal1.5.2 entry.');
