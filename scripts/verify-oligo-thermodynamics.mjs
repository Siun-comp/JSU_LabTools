import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {CONTRACT,UI_VERSION} from '../tools/oligo-thermodynamics/analysis-core.mjs';
const root=new URL('../',import.meta.url),manifest=JSON.parse(await readFile(new URL('public-manifest.json',root),'utf8')),release=JSON.parse(await readFile(new URL('amplification-release-contract.json',root),'utf8')).oligoThermodynamicsRelease;
const sha=b=>createHash('sha256').update(b).digest('hex'),prefix='tools/oligo-thermodynamics/',entries=manifest.files.filter(e=>e.target.startsWith(prefix));
assert.equal(entries.length,26);assert.equal(UI_VERSION,'0.1.0-beta.1');assert.equal(release.engineVersion,CONTRACT.engineVersion);assert.equal(release.schemaVersion,'0.4');
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
assert(html.includes('초기 베타 v0.1.0-beta.1'));assert(html.includes("worker-src 'self'"));assert(html.includes("connect-src 'self'"));assert(html.includes("'wasm-unsafe-eval'"));
for(const x of ['14.73','40.10','Mg=0 참고','속도','0.1.0-beta.1','GPL'])assert(audit.includes(x),'Limits/source documented: '+x);
assert(info.includes('포털 v1.7.0')&&info.includes('2026-10-22')&&info.includes('초기 베타'));
for(const e of entries.filter(e=>/\.(?:mjs|html)$/.test(e.target))){const s=await readFile(new URL(e.source,root),'utf8');assert(!/XMLHttpRequest|sendBeacon|localStorage|sessionStorage|https?:\/\/[^\s"']*\?/.test(s),'No persistence or sequence URL: '+e.target);}
const worker=await readFile(new URL(prefix+'worker.mjs',root),'utf8');assert(worker.includes("mg:0")&&worker.includes('duplexMgZeroReference'));
const home=await readFile(new URL('portal/index.html',root),'utf8');assert(home.includes('실행 가능 10개')&&home.includes(prefix+'index.html')&&home.includes('info/oligo-thermodynamics.html'));
console.log('PASS: independent Oligo Thermodynamics beta.1 source26, exact model/source/WASM hashes, GPL corresponding source, explicit Mg0 reference/known limits, portal1.7.0 addition.');
