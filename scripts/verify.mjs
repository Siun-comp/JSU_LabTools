import {readFile,readdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),dist=resolve(root,'dist');
const manifest=JSON.parse(await readFile(resolve(root,'public-manifest.json'),'utf8'));
const R=JSON.parse(await readFile(new URL('./release-versions.json',import.meta.url),'utf8')),T=R.tools,esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
assert.equal(manifest.version,R.portal.version,'release-versions portal version = manifest');assert.equal(manifest.files.length,R.portal.files,'release-versions file count = manifest');
async function files(base,prefix=''){const out=[];for(const e of await readdir(base,{withFileTypes:true})){const name=prefix+e.name;assert(!e.isSymbolicLink());if(e.isDirectory())out.push(...await files(resolve(base,e.name),name+'/'));else out.push(name);}return out;}
assert.deepEqual((await files(dist)).sort(),manifest.files.map(e=>e.target).sort(),'Complete artifact allowlist');
for(const e of manifest.files)assert((await readFile(resolve(root,e.source))).equals(await readFile(resolve(dist,e.target))),'Source/artifact bytes');
const plot='https://siun-comp.github.io/isoamplar-plot-analysis-t/';
for(const path of ['index.html','info/plot.html','info/oligo-mix.html','info/sequence.html','info/dilution.html','info/nucleic-acid.html','info/amplification-analysis.html','info/method-comparison.html','info/oligo-analysis.html','info/oligo-thermodynamics.html','info/sequence-mapper.html']){
 const html=await readFile(resolve(dist,path),'utf8');
 assert(!/<iframe\b/i.test(html),'No iframe');
 if(path!=='index.html')assert(!/<(script|input|textarea|form)\b/i.test(html),'Information pages have no analysis inputs');
 assert(!/(?:^|["' >])[A-Z]:[\\/]|file:|localhost|127\.0\.0\.1|design\/|\.codex|https?:\/\/[^"<\s]*\?/i.test(html),'No internal paths or data parameters');
 const remote=[...html.matchAll(/(?:href|src)="(https?:[^" ]+)"/g)].map(m=>m[1]);
 const nucleicSources=['https://biopython.org/docs/1.88/api/Bio.SeqUtils.html','https://raw.githubusercontent.com/biopython/biopython/biopython-188/Bio/Data/IUPACData.py','https://www.neb.com/en/tools-and-resources/usage-guidelines/nucleic-acid-data','https://www.promega.com/-/media/files/resources/technical-references/nucleotides-and-nucleic-acids.pdf','https://www.bipm.org/en/si-base-units/mole','https://documents.thermofisher.com/TFS-Assets/LSG/manuals/cms_041003.pdf','https://www.bionicsro.co.kr/contents/serviceGeneSynthesis','https://www.bionicsro.co.kr/support/supportFaq','https://www.idtdna.com/pages/Support/FAQs/do-custom-oligos-come-with-5-phosphorylation-','https://www.neb.com/en/-/media/nebus/files/brochures/molcloning_tech_guide.pdf','https://www.neb.com/en-de/tools-and-resources/feature-articles/mind-your-caps-and-poly-a-tails-strategies-for-synthesizing-in-vitro-transcribed-ivt-mrna','https://www.thermofisher.com/kr/ko/home/references/ambion-tech-support/rna-tools-and-calculators/dna-and-rna-molecular-weights-and-conversions.html','https://nebiocalculator.neb.com/#!/dsdnaamt','https://www.thermofisher.com/kr/ko/home/brands/thermo-scientific/molecular-biology/molecular-biology-learning-center/molecular-biology-resource-library/thermo-scientific-web-tools/dna-copy-number-calculator.html'];
 assert.deepEqual(remote,path==='info/nucleic-acid.html'?nucleicSources:['index.html','info/plot.html'].includes(path)?[plot]:[],'Only selected Plot or static scientific references');
 assert(html.includes('v'+manifest.version)&&html.includes(path==='index.html'?R.portal.homeDate:T[path.slice(5,-5)].infoDate),'Portal version/date');
 for(const m of html.matchAll(/(?:href|src)="([^" ]+)"/g)){if(m[1].startsWith('http')||m[1].startsWith('#'))continue;const href=m[1].split('#',1)[0];await readFile(resolve(dirname(resolve(dist,path)),href.endsWith('/')?href+'index.html':href));}
}
const home=await readFile(resolve(dist,'index.html'),'utf8');
const contact=await readFile(resolve(dist,'contact.html'),'utf8');
assert(home.includes('href="contact.html">개발자에게 문의</a>'));
const inquiryForm='https://docs.google.com/forms/d/e/1FAIpQLSc3ROW5oMva0XhmGQIuYeCS6ybRYHpjlfNGpH7tzamIMzfcAg/viewform';
assert.deepEqual([...contact.matchAll(/(?:href|src|action)="(https?:[^"]*)"/g)].map(m=>m[1]),[inquiryForm],'Only the reviewed inquiry form is external');
assert(contact.includes(`<a class="execute" href="${inquiryForm}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">`),'Inquiry form opens in a new tab without referrer');
assert(!/<(?:form|iframe|input|textarea|select)\b|mailto:/i.test(contact),'No in-page inquiry input or mail draft');
assert(contact.includes('<strong id="contact-address">siun.comp@gmail.com</strong>')&&contact.includes('id="contact-copy"'),'Mail address shown as text with copy');
assert(contact.includes('실험 데이터, 서열, 검체명, 원본 파일은 양식에 넣지 마세요.'),'Inquiry data warning');
const contactScript=await readFile(resolve(dist,'assets/contact.mjs'),'utf8');
assert(!/\bfetch\s*\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|innerHTML|document\.write|location\.(?:href|assign|replace)\s*[=(]/.test(contactScript)&&contactScript.includes('navigator.clipboard.writeText'),'Contact script only copies the address and names the linked tool');
assert(contact.includes('포털 v'+manifest.version));
const toolRows=[...home.matchAll(/<tr class="available">[\s\S]*?<\/tr>/g)].map(m=>m[0]);
const contactOptions=[...contact.matchAll(/<dt id="([a-z-]+)">[^<]+<\/dt><dd>(v[^<]+)<\/dd>/g)];
const infoTargets=manifest.files.filter(e=>e.target.startsWith('info/')&&e.target.endsWith('.html'));
assert.deepEqual(contactOptions.map(m=>`info/${m[1]}.html`).sort(),infoTargets.map(e=>e.target).sort());
for(const [,id,version] of contactOptions){
 const infoPath=`info/${id}.html`;
 const info=await readFile(resolve(dist,infoPath),'utf8');
 assert(info.includes(`href="../contact.html#${id}">개발자에게 문의</a>`));
 const row=toolRows.find(row=>row.includes(`href="${infoPath}"`));
 assert(row?.includes(version),`Contact version matches portal row: ${id}`);
}
const pending=[...home.matchAll(/<tr class="planned">([\s\S]*?)<\/tr>/g)];assert.equal(pending.length,0);
for(const row of pending){assert(!/<a\b|v\d+\.\d+/.test(row[1]));assert(row[1].includes('준비중'));}
assert(home.includes('도구 v'+T['amplification-analysis'].version)&&home.includes('사용 검토용 베타'),'Deferred tools preserved');
assert(home.includes('실행 가능 '+R.portal.available+'개')&&home.includes('준비중 0개'));
assert.equal((home.match(/class="tool-glyph"/g)||[]).length,R.portal.available);
for(const match of home.matchAll(/<a\b[^>]*class="execute"[^>]*>/g))for(const attr of ['target="_blank"','rel="noopener noreferrer"','referrerpolicy="no-referrer"'])assert(match[0].includes(attr),'Plot/Oligo safe new tab');
assert.equal((home.match(/<dialog\b/g)||[]).length,1);assert(home.includes('id="sequence-dialog"')&&home.includes('id="open-sequence"'));
assert(home.includes('id="sequence-output-mode"')&&!home.includes('id="sequence-mode"')&&!home.includes('id="sequence-convert"'));
assert(home.includes('id="sequence-length"'));
assert.equal((home.match(/<script\b/g)||[]).length,1);assert(home.includes('type="module" src="tools/sequence/app.mjs"'));
assert(home.includes('Excel 사용자 확인')&&!home.includes('Excel 확인 전'));
const mixInfo=await readFile(resolve(dist,'info/oligo-mix.html'),'utf8'),mixPage=await readFile(resolve(dist,'tools/oligo-mix/index.html'),'utf8');
assert(mixInfo.includes('v'+T['oligo-mix'].version)&&mixInfo.includes('7행·11열')&&mixInfo.includes('아직 확인하지 않았습니다.'),'Oligo Mix version/export/Excel status');
for(const id of ['select-all-rows','move-rows-up','move-rows-down','delete-rows','undo-delete-rows'])assert(mixPage.includes('id="'+id+'"'),'Oligo input controls '+id);
assert(mixPage.includes(`도구 v${T['oligo-mix'].version} / 알고리즘 v${T['oligo-mix'].algorithm}`)&&mixPage.includes('Reagent는 B:C 두 칸 병합'),'Oligo Mix release and clipboard help');
const app=await readFile(resolve(dist,'tools/sequence/app.mjs'),'utf8');
assert(!/\bfetch\s*\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|innerHTML|document\.write|console\.log|postMessage/.test(app),'Browser-only safe text and no data transfer/storage');
assert(app.includes('navigator.clipboard.writeText(value)')&&app.includes('showModal()'));
const info=await readFile(resolve(dist,'info/sequence.html'),'utf8');assert(info.includes(`v${T.sequence.version} / v${T.sequence.algorithm}`)&&info.includes('실사용 확인 전'));
const dilution=await readFile(resolve(dist,'tools/dilution-calculator/index.html'),'utf8');
for(const id of ['open-preparation','preparation-dialog','prep-form','prep-mode','prep-mw','prep-concentration','prep-known','prep-output-unit','prep-result','prep-copy'])assert(dilution.includes('id="'+id+'"'),'Reagent preparation control '+id);
assert(dilution.includes('보유 질량·MW·목표 몰농도로')&&dilution.includes('용매 첨가량 자체가 아닙니다.'),'Final solution volume distinguished');
assert(dilution.includes('id="composer-version"')&&dilution.includes('실사용 확인 전'));
assert(dilution.includes('id="conversion-dialog"')&&dilution.includes('id="molecular-weight"')&&dilution.includes('총량'));
assert(home.includes('tools/dilution-calculator/index.html')&&home.includes('핵산 농도·Copy 수'));
for(const path of ['tools/dilution-calculator/index.html','tools/dilution-calculator/app.mjs','tools/dilution-calculator/core.mjs','tools/dilution-calculator/clipboard.mjs']){
 const text=await readFile(resolve(dist,path),'utf8');
 assert(!/\bfetch\s*\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|innerHTML|document\.write|console\.log|postMessage|<iframe\b/.test(text),'Dilution local-only, safe DOM');
 if(path.endsWith('.html'))for(const m of text.matchAll(/(?:href|src)="([^" ]+)"/g)){if(m[1].startsWith('#'))continue;await readFile(resolve(dirname(resolve(dist,path)),m[1]));}
}
const nucInfo=await readFile(resolve(dist,'info/nucleic-acid.html'),'utf8');assert(nucInfo.includes(`도구 v${T['nucleic-acid'].version} / 알고리즘 v${T['nucleic-acid'].algorithm}`)&&nucInfo.includes('실사용 확인 전'));
assert(home.includes('tools/nucleic-acid-calculator/index.html')&&new RegExp(`<tr class="available">(?:(?!</tr>)[\\s\\S])*${esc(`도구 v${T['nucleic-acid'].version} · 알고리즘 v${T['nucleic-acid'].algorithm}`)}(?:(?!</tr>)[\\s\\S])*${esc('확인 '+T['nucleic-acid'].infoDate)}`).test(home));
for(const path of ['tools/nucleic-acid-calculator/index.html','tools/nucleic-acid-calculator/app.mjs','tools/nucleic-acid-calculator/core.mjs','tools/nucleic-acid-calculator/math.mjs','tools/nucleic-acid-calculator/clipboard.mjs','tools/nucleic-acid-calculator/vectors.mjs']){
 const text=await readFile(resolve(dist,path),'utf8');
 assert(!/\bfetch\s*\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|innerHTML|document\.write|console\.log|console\.debug|postMessage|<iframe\b/.test(text),'Nucleic local-only safe DOM');
 if(path.endsWith('.html'))for(const m of text.matchAll(/(?:href|src)="([^" ]+)"/g)){if(m[1].startsWith('#'))continue;await readFile(resolve(dirname(resolve(dist,path)),m[1]));}
 if(path.endsWith('core.mjs')||path.endsWith('app.mjs'))for(const m of text.matchAll(/from ['"]([^'"]+)['"]/g))await readFile(resolve(dirname(resolve(dist,path)),m[1]));
}
console.log('PASS: full '+manifest.files.length+'-file artifact, prior paths preserved, nucleic/dilution new tabs, Sequence dialog, Amplification Analysis beta entry, LoBDQ portal beta, source whitelist and accurate Excel status.');
import './verify-lobdq.mjs';
import './verify-reagent.mjs';

import './verify-method-comparison.mjs';

import './verify-oligo-dimer.mjs';

import './verify-oligo-thermodynamics.mjs';
import './verify-sequence-mapper.mjs';
