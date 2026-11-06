import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import * as c from '../../tools/oligo-analysis/core.mjs';
import {xlsxReport} from '../../tools/oligo-analysis/xlsx.mjs';
const Zip=createRequire(import.meta.url)('../../tools/method-comparison/vendor/jszip.min.js');

const records=c.parseInput('Primer CAT\tGCGCGCAAAGCGCGC\r\n=Reverse & partner\tGCGCGC\r\nUnrelated\tAAAAAAAAA').records;
assert.deepEqual(records.map(({name,sequence})=>[name,sequence]),[['Primer CAT','GCGCGCAAAGCGCGC'],['=Reverse & partner','GCGCGC'],['Unrelated','AAAAAAAAA']]);
const padded=c.parseInput('\t\r\n  Primer CAT  \tGC G CAA \t\r\n \t \r\nReverse  primer\t \t\tTT GC GC\t \t\r\n\t').records;
assert.deepEqual(padded.map(({name,sequence,line})=>[name,sequence,line]),[['Primer CAT','GCGCAA',2],['Reverse  primer','TTGCGC',4]]);
for(const raw of ['\tGCGC','Name\t','Name\tGCGC\t\tExtra'])assert.throws(()=>c.parseInput('\t\n'+raw),/2행.*서열 값 하나/);
assert.throws(()=>c.parseInput('Name\t\tOther'),/1행.*DNA/);
assert.equal(c.parseInput('>Forward primer\nGCGC').records[0].name,'Forward primer');
assert.equal(c.parseInput('Legacy GCGC').records[0].sequence,'GCGC');
const result=c.runAnalysis(records,'idt',{poly:true});
const pairs=c.filteredPairs(result.pairs,{cutoff:-9000000,terminal:true});
const self=pairs.find(p=>p.kind==='self'&&p.first==='Primer CAT'),hetero=pairs.find(p=>p.kind==='hetero'&&p.first==='Primer CAT'),poly=pairs.find(p=>p.kind==='poly'&&p.structures[0].molecules.some(m=>m.name==='=Reverse & partner'));
for(const p of [self,hetero,poly]){
 const opts={...result,selected:true,excluded:['Excluded record']};
 const plain=c.textReport(records,[p],'idt',opts),html=c.excelReport(records,[p],'idt',opts);
 for(const s of [plain,html]){assert.doesNotMatch(s,/Unrelated|Excluded record|미선택|분석 대상/);assert.match(s,/해당 조합 입력/);}
 if(p===self)assert.doesNotMatch(plain,/Reverse/);
 if(p===poly)assert.match(plain,/Polydimer 탐색 범주/);
 else assert.doesNotMatch(plain,/Polydimer 탐색 범주/);
}
assert.match(c.textReport(records,[self],'idt',result),/Unrelated/);
const blob=await xlsxReport(records,pairs,'idt',{...result,filters:{cutoff:-9000000,terminal:true}},Zip);
assert.equal(blob.type,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
const pkg=await Zip.loadAsync(await blob.arrayBuffer(),{checkCRC32:true});
const sheet=await pkg.file('xl/worksheets/sheet1.xml').async('string'),styles=await pkg.file('xl/styles.xml').async('string');
for(const label of ['입력:','Self-dimer','Hetero-dimer','Polydimer 후보'])assert(sheet.includes(`s="2" t="inlineStr"><is><t xml:space="preserve">${label}</t>`));
assert.match(sheet,/s="3" t="inlineStr".*Hetero-dimer: Primer CAT/);
assert.match(sheet,/s="4" t="inlineStr"/);
assert.match(sheet,/=Reverse &amp; partner/);
assert.doesNotMatch(sheet,/<f[\s>]|mergeCell/);
assert.match(styles,/<sz val="9"\/>.*Courier New/);
const cells=[...sheet.matchAll(/<row r="(\d+)" ht="(\d+)"[^>]*><c r="A\d+" s="(\d+)"[^>]*><is><t xml:space="preserve">([^<]*)<\/t>/g)];
for(const block of c.reportBlocks(records,pairs,'idt',result).filter(b=>b.kind==='diagram')){
 const start=cells.findIndex((_,i)=>block.lines.every((line,j)=>cells[i+j]?.[4]===line.replace(/</g,'&lt;').replace(/>/g,'&gt;')));
 assert(start>=0);assert(cells.slice(start,start+3).every((row,j)=>row[2]==='16'&&row[3]==='1'&&+row[1]===+cells[start][1]+j));
}
if(process.env.JSU_OLIGO_EXCEL_FIXTURE){
 const {writeFile}=await import('node:fs/promises');
 await writeFile(process.env.JSU_OLIGO_EXCEL_FIXTURE,new Uint8Array(await blob.arrayBuffer()));
}
console.log('PASS: Excel TSV names/errors, selected Self/Hetero/Poly copies, native XLSX sections, literal cells and exact 3-row diagrams.');
