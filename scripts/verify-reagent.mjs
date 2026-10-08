import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const load=p=>readFile(new URL('../dist/tools/dilution-calculator/'+p,import.meta.url),'utf8');
const [html,app,core,legacy,raw]=await Promise.all(['index.html','composer.mjs','composer-core.mjs','app.mjs','presets.json'].map(load));
const data=JSON.parse(raw),contract=JSON.parse(await readFile(new URL('../amplification-release-contract.json',import.meta.url),'utf8'));
assert.equal(data.recipes.length,20);assert.equal(new Set(data.recipes.map(p=>p.id)).size,20);
const expectedFold={'tae-50x-qiagen':'50','tae-15558042':'10','tbe-am986x':'10','ssc-reference':'20','rcutsmart-b6004':'10','isothermal-b0537':'10','ssiii-first':'5'};
for(const p of data.recipes){assert.equal(p.defaultFold,expectedFold[p.id]||'1');if(p.fixedFold)assert.equal(p.defaultFold,'1');for(const route of p.routes||[]){assert(route.label&&route.steps&&route.sources.length);for(const r of route.rows)assert.equal(r.mw,'');}}
assert(app.includes('setPreset(null);'));assert(!app.includes("setPreset(recipes.find(p=>p.id==='te-am9849'))"));
assert(app.includes("$('#composer-fold').value=p?.defaultFold||'1'"));
for(const p of data.recipes){
 assert(p.rows.length>=1&&p.sources.length>0,'Preparation preset has components and references');
 assert(['recipe','composition'].includes(p.presetType)&&p.steps);
 for(const r of p.rows){assert.equal(r.mw,'','MW remains user-supplied');assert.equal(r.stock,({'te-am9849:0':'1','te-am9849:1':'0.5','tae-50x-qiagen:2':'0.5','qiagen-ae:1':'0.5','low-te-4479554:0':'1','low-te-4479554:1':'0.5','qiagen-qbt:3':'10'})[p.id+':'+p.rows.indexOf(r)]||'','Only reviewed editable source or route Stocks have defaults');assert(Number.isFinite(Number(r.target))&&Number(r.target)>0);}
 for(const s of p.sources)assert.equal(new URL(s.url).protocol,'https:');
}
const neb=data.recipes.find(p=>p.sources.some(s=>s.url==='https://www.neb.com/en/products/b0537-isothermal-amplification-buffer'));
assert(neb);assert.equal(neb.rows.length,5);assert(neb.rows.some(r=>r.name==='MgSO4'&&r.target==='2'&&r.unit==='mM'));assert(neb.note.includes('v/v'));
assert(core.includes("TOOL_VERSION='1.2.0',COMPOSER_VERSION='0.2.0'"));
assert(!/dev\.\d+|로컬.*후보/.test(html+app+core));
assert.deepEqual([...app.matchAll(/fetch\(([^)]+)\)/g)].map(m=>m[1]),["'./presets.json'"],'Only fixed same-origin preset read');
assert(!/XMLHttpRequest|sendBeacon|localStorage|sessionStorage|document\.write|\beval\s*\(|postMessage/.test(app+core));
assert(app.includes("escape=s=>String(s??'')")&&app.includes('escape(safeCell(s))'),'Escape rendered and copied user text');
for(const id of ['composer-notes','makeup-name','makeup-result','open-dilution','open-conversion','open-preparation'])assert(html.includes('id="'+id+'"'));
assert(!/<textarea[^>]*\brequired/.test(html));assert.equal((html.match(/<dialog\b/g)||[]).length,3);
// The only legacy app changes are the independent dilution dialog bindings.
const original=legacy.replace(/const dilutionDialog=\$\('dilution-dialog'\);\r?\n\$\('open-dilution'\).*\r?\n\$\('close-dilution'\).*\r?\n\r?\n/,'');
const baseline=contract.bufferRelease.previousPublic.find(e=>e.target==='tools/dilution-calculator/app.mjs');
assert.equal(createHash('sha256').update(original).digest('hex'),baseline.sha256,'Legacy app preserved apart from dialog bindings');
console.log('PASS: curated20 presets, public version, user MW/editable source Stocks, fixed local preset read and escaped output; independent controls and preserved legacy app.');
