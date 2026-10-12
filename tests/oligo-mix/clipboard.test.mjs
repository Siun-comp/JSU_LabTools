import assert from 'node:assert/strict';
import {calculate} from '../../tools/oligo-mix/core.mjs';
import {excelClipboard,nextComponentName,safeText,TOOL_VERSION} from '../../tools/oligo-mix/clipboard.mjs';
const r=calculate({reaction:'25',mix:'5',count:'10',rows:[{name:'F1',target:'.2',stock:'10'},{name:'R1',target:'.1',stock:'10'},{name:'P1',target:'.1',stock:'10'}]});
const p=excelClipboard(r);
assert.equal(p.rows.length,7);assert(p.rows.every(row=>row.length===11));
assert.deepEqual(p.rows[0].slice(0,5),['Final Volume','','','25','µL']);
assert.equal(p.rows[1][3],'10');assert.equal(p.rows[1][5],'Final conc / amount');assert.equal(p.rows[1][7],'stock conc');
assert.deepEqual(p.rows[2],['','TE pH8.0','','40','µL','-','','-','','4','µL']);
assert.deepEqual(p.rows[3],['1','F1','','5','µL','0.2','µM','10','µM','0.5','µL']);
assert.equal(p.rows[4][1],'R1');assert.equal(p.rows[5][1],'P1');
assert.equal(p.rows[6][3],'50');assert.equal(p.rows[6][9],'5');
assert.equal(p.text.split('\r\n').length,7);assert(p.text.split('\r\n').every(row=>row.split('\t').length===11));
assert(p.html.includes("font-family:'맑은 고딕','Malgun Gothic',sans-serif;font-size:9pt;"));
assert(p.html.includes('background-color:#17365d;color:#ffffff;')&&p.html.includes('background-color:#fff2cc;color:#111111;'));
assert(p.html.includes('border:1px solid')&&p.html.includes('border-top:2px solid'));
assert(p.html.includes('colspan="6"')&&p.html.includes('colspan="4"'));
assert(p.html.includes('도구 '+TOOL_VERSION)&&p.html.includes('알고리즘 0.5.0'));
for(const prefix of ['=','+','-','@'])assert(safeText('  '+prefix+'Synthetic').startsWith("'"));
assert.equal(safeText('A\tB\nC'),'A B C');
const evil=excelClipboard(calculate({reaction:'25',mix:'5',count:'10',rows:[{name:'  =Synthetic<script>&"',target:'.2',stock:'10'}]}));
assert(!evil.html.includes('<script>'));assert(evil.html.includes('&lt;script&gt;')&&evil.text.includes("'=Synthetic"));
assert.deepEqual(nextComponentName('F',{F:1}),{name:'F2',count:2});
assert.deepEqual(nextComponentName('F',{F:1},['F2']),{name:'F3',count:3});
assert.deepEqual(nextComponentName('Plasmid',{}),{name:'Plasmid1',count:1});
assert.throws(()=>nextComponentName('unknown',{}));
// Expand each HTML row to its actual spreadsheet coordinates. A merge may cover only empty cells.
const htmlRows=[...p.html.matchAll(/<tr\b[^>]*>(.*?)<\/tr>/gs)];
assert.equal(htmlRows.length,p.rows.length);
for(const [y,match] of htmlRows.entries()){
 let x=0;
 for(const cell of match[1].matchAll(/<td\b([^>]*)>(.*?)<\/td>/gs)){
  const span=Number(/colspan="(\d+)"/.exec(cell[1])?.[1]??1);
  assert.equal(cell[2],p.rows[y][x]);
  assert(p.rows[y].slice(x+1,x+span).every(v=>v===''),'Merged cells cannot hide values');
  assert.match(cell[1],/background-color:#[0-9a-f]{6};color:#[0-9a-f]{6};/);
  if(x===1){assert.equal(span,2);assert.match(cell[1],/text-align:left/);}
  if(x===3){assert.match(cell[1],/mso-number-format:'General'/);assert.match(cell[1],/background-color:#fff2cc/);}
  x+=span;
 }
 assert.equal(x,11,'All rows must occupy exactly eleven columns');
}
assert.equal([...p.html.matchAll(/<col width=/g)].length,11);
console.log('PASS: dynamic 7x11 layout, two-column Reagent, TE/batch/per-reaction positions, explicit colors/borders, numeric values, Malgun Gothic9pt HTML, safe merge grid and formula protection.');

const precise=calculate({reaction:'1',mix:'1',count:'1',rows:[{name:'Precision',target:'0.123456789012345',stock:'1'}]});
const preciseCopy=excelClipboard(precise);assert.equal(preciseCopy.rows[3][9],'0.123456789012');assert.equal(preciseCopy.rows[3][5],'0.123456789012');assert.notEqual(precise.rows[0].perReaction,Number(preciseCopy.rows[3][9]),'Clipboard rounding does not replace the calculation value');
assert(preciseCopy.text.includes('0.123456789012'));assert(preciseCopy.html.includes('0.123456789012'));
console.log('PASS: explicit12 significant-digit clipboard values; calculation values retained.');
