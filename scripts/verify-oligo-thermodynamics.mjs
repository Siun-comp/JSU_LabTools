import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {CONTRACT,UI_VERSION} from '../tools/oligo-thermodynamics/analysis-core.mjs';
import {FIXED_PARAMS_SHA256} from '../tools/oligo-thermodynamics/fixed-nn-release.mjs';
const root=new URL('../',import.meta.url),manifest=JSON.parse(await readFile(new URL('public-manifest.json',root),'utf8')),release=JSON.parse(await readFile(new URL('amplification-release-contract.json',root),'utf8')).oligoThermodynamicsRelease;
const sha=b=>createHash('sha256').update(b).digest('hex'),prefix='tools/oligo-thermodynamics/',entries=manifest.files.filter(e=>e.target.startsWith(prefix));
assert.equal(entries.length,69);assert.equal(UI_VERSION,'0.2.0-beta.1');assert.equal(release.engineVersion,CONTRACT.engineVersion);assert.equal(release.schemaVersion,'0.4');
assert.equal(release.previousPublic.length,160);assert.equal(release.selected.length,10);assert.equal(release.addedTargets.length,27);
for(const e of entries){const b=await readFile(new URL(e.source,root));assert(b.equals(await readFile(new URL('dist/'+e.target,root))));if(!e.target.endsWith('.wasm'))assert(!/[A-Z]:[\\/]|\.codex|127\.0\.0\.1|localhost/.test(b.toString()),'No local build paths: '+e.target);}
const engine=JSON.parse(await readFile(new URL(prefix+'engine/manifest.json',root),'utf8'));
assert.equal(sha(await readFile(new URL(prefix+'engine/manifest.json',root))),CONTRACT.manifest);
assert.equal(engine.version,'0.1.0-dev.1');assert.equal(engine.license,'GPL-2.0-or-later');assert.equal(engine.files.length,9);
for(const e of engine.files){const b=await readFile(new URL(prefix+e.path,root));assert.equal(b.length,e.bytes);assert.equal(sha(b),e.sha256);assert(entries.some(p=>p.target===prefix+e.path),'Complete corresponding sources published');}
assert.equal(sha(await readFile(new URL(prefix+'duplex-nn.mjs',root))),CONTRACT.duplexSHA);assert.equal(sha(await readFile(new URL(prefix+'sequence.mjs',root))),CONTRACT.sequenceSHA);
assert.equal(sha(await readFile(new URL(prefix+'engine/hairpin.wasm',root))),CONTRACT.wasm);
assert((await readFile(new URL(prefix+'LICENSE.txt',root))).equals(await readFile(new URL(prefix+'engine/source/gpl-2.0.txt',root))));
const html=await readFile(new URL(prefix+'index.html',root),'utf8'),info=await readFile(new URL('portal/info/oligo-thermodynamics.html',root),'utf8'),audit=await readFile(new URL(prefix+'validation.html',root),'utf8');
assert(html.includes('통합 베타 · v0.2.0-beta.1'));assert(html.includes("worker-src 'self'"));assert(html.includes("connect-src 'self'"));assert(html.includes("'wasm-unsafe-eval'"));
for(const x of ['14.73','40.10','Mg=0 참고','속도','0.1.0-beta.1','GPL'])assert(audit.includes(x),'Limits/source documented: '+x);
assert(info.includes('포털 v1.8.0')&&info.includes('2026-10-30')&&info.includes('통합 베타'));
for(const e of entries.filter(e=>/\.(?:mjs|html)$/.test(e.target))){const s=await readFile(new URL(e.source,root),'utf8');assert(!/XMLHttpRequest|sendBeacon|localStorage|sessionStorage|https?:\/\/[^\s"']*\?/.test(s),'No persistence or sequence URL: '+e.target);}
const worker=await readFile(new URL(prefix+'worker.mjs',root),'utf8');assert(worker.includes("mg:0")&&worker.includes('duplexMgZeroReference'));
const home=await readFile(new URL('portal/index.html',root),'utf8');assert(home.includes('실행 가능 10개')&&home.includes(prefix+'index.html')&&home.includes('info/oligo-thermodynamics.html'));
const pair=JSON.parse(await readFile(new URL(prefix+'engine/pair/manifest.json',root),'utf8'));
assert.equal(pair.maxLoop,30);assert.equal(pair.abi,1);assert.equal(pair.license,'GPL-2.0-or-later');
const pairBytes=await readFile(new URL(prefix+'engine/pair/'+pair.asset.path,root));assert.equal(sha(pairBytes),pair.asset.sha256);assert.equal(pairBytes.length,pair.asset.bytes);
for(const [path,hash] of Object.entries(pair.sourceFiles))assert.equal(sha(await readFile(new URL(prefix+'engine/source/'+path,root))),hash);
assert.equal(sha(await readFile(new URL(prefix+'engine/pair/wrapper.c',root))),pair.wrapperSha256);
assert.equal(sha(await readFile(new URL(prefix+'engine/pair/build.py',root))),pair.buildSourceSha256);
assert.equal(sha(await readFile(new URL(prefix+'fixed-nn-params.json',root))),FIXED_PARAMS_SHA256);
const params=JSON.parse(await readFile(new URL(prefix+'fixed-nn-params.json',root),'utf8'));
assert.equal(Object.keys(params.nn).length,17);assert.equal(Object.keys(params.imm).length,40);assert.equal(Object.keys(params.excluded).length,8);
assert.equal(sha(await readFile(new URL(prefix+'fixed-source/MeltingTemp.py',root))),params.sourceSHA256);
for(const path of ['fixed-source/BIOPYTHON_LICENSE.rst','fixed-source/PARAMETERS_NOTICE.md','review-guide.html'])assert(entries.some(e=>e.target===prefix+path));
assert.equal((html.match(/role="tab"/g)||[]).length,6);assert(html.includes('review-guide.html'));
const guide=await readFile(new URL(prefix+'review-guide.html',root),'utf8');for(const text of ['예시1','예시2','예시3','예시4','예시5','예시6','2.77','5.03','AAGAACGTACGTACGTACGTACGTA','TTAGCTCTT'])assert(guide.includes(text));
console.log('PASS: integrated Oligo Thermodynamics0.2.0-beta.1 source69; six tabs, unchanged NN4/THAL engines, both corresponding sources, fixed parameter digest/rights/support limits and public review examples.');
