import assert from 'node:assert/strict';
import {analyze,transform,outputText,position,lengthSummary,MAX_INPUT,MAX_RECORDS} from '../../tools/sequence/core.mjs';
const dna=['ATGC','AUGC','TACG','UACG','CGTA','CGUA','GCAT','GCAU'];
const rna=['AUGC','ATGC','UACG','TACG','CGUA','CGTA','GCAU','GCAT'];
for(const [mode,input,expected] of [['DNA','ATGC',dna],['RNA','AUGC',rna]])for(let i=0;i<8;i++){
 const result=analyze(input,{outputMode:i&1?(mode==='DNA'?'RNA':'DNA'):mode,reverse:Boolean(i&4),complement:Boolean(i&2)});
 assert.equal(result.valid,true);assert.equal(outputText(result),expected[i]);assert.equal(result.direction,Boolean(i&4)!==Boolean(i&2)?'3′→5′':'5′→3′');
}
for(const [mode,input,comp,rc] of [['DNA','ATGCRYN','TACGYRN','NRYGCAT'],['RNA','AUGC','UACG','GCAU'],['DNA','ACGTRYSWKMBDHVN','TGCAYRSWMKVHDBN','NBDHVKMWSRYACGT'],['RNA','ACGURYSWKMBDHVN','UGCAYRSWMKVHDBN','NBDHVKMWSRYACGU']]){
 assert.equal(transform(input,{outputMode:mode,complement:true}),comp);assert.equal(transform(input,{outputMode:mode,reverse:true,complement:true}),rc);
 for(const opts of [{reverse:true},{complement:true},{reverse:true,complement:true}])assert.equal(transform(transform(input,{...opts,outputMode:mode}),{...opts,outputMode:mode}),input);
}
const raw='/Any-9/<ignored>/FAM/atGC- n/어떤 표기든/';assert.equal(analyze(raw).valid,false,'Outside token markup is not silently removed');
const source='/FAM/atGC- n/BHQ/';const normal=analyze(source);assert.equal(outputText(normal),'atGCn');assert.equal(normal.raw,source);assert.deepEqual(normal.counts,{mods:2,spaces:1,hyphens:1,lowercase:3,converted:0});
assert.equal(outputText(analyze(source,{uppercase:true})),'ATGCN');assert.equal(outputText(analyze(source,{reverse:true,complement:true,outputMode:'RNA',uppercase:true})),'NGCAU');
assert.equal(outputText(analyze('AT/ACGT123&<>/GC//')),'ATGC');assert.equal(analyze('AT/FAM//BHQ/GC').counts.mods,2);assert.equal(outputText(analyze('AT/multi\nline/GC')),'ATGC');
for(const invalid of ['', '   ', '/FAM/', 'AT?GC','AT1GC','AT/left','AT.GC','AT*GC','AT\u00a0GC','AT\u200bGC','\ufeffATGC','X'])assert.equal(analyze(invalid).valid,false,JSON.stringify(invalid));
assert.equal(outputText(analyze('AT',{outputMode:'RNA'})),'AU');assert.equal(outputText(analyze('AU',{outputMode:'DNA'})),'AT');
const multi='>synthetic_a /keep/- description\r\natGC\r\n>synthetic_b note\nTTAN';const multiple=analyze(multi,{reverse:true,complement:true,uppercase:true});assert.equal(multiple.records.length,2);assert.equal(outputText(multiple),'>synthetic_a /keep/- description\nGCAT\n>synthetic_b note\nNTAA\n');
for(const width of [0,1,60,200]){const emitted=outputText(multiple,{width});const parsed=analyze(emitted);assert(parsed.valid);assert.deepEqual(parsed.records.map(r=>[r.header,r.sequence]),multiple.records.map(r=>[r.header,r.output]));}
assert(analyze('>a\nATGC\n>a\nATGC').warnings.length);for(const raw of ['>\nAT','>a\n>b\nAT',' >a\nAT','>a\nAT/\n>b\nGC/'])assert.equal(analyze(raw).valid,false);
assert.equal(analyze('>a<img>- /x/\nATGC').valid,true);assert.equal(analyze('ATGC\n>unexpected').valid,false);
assert.deepEqual(position('AT\r\nGC\nA',4),{line:2,column:1});assert.deepEqual(position('AT\r\nGC\nA',7),{line:3,column:1});
assert.throws(()=>outputText(analyze('AT?')));assert.throws(()=>outputText(normal,{fasta:true,name:'bad name'}));assert.throws(()=>outputText(normal,{fasta:true,width:2.5}));
assert.equal(outputText(normal,{fasta:true,name:'synthetic',width:2}),'>synthetic\nat\nGC\nn\n');
const before=JSON.stringify(normal);outputText(normal,{fasta:true});assert.equal(JSON.stringify(normal),before);
const started=performance.now();const big=analyze('A'.repeat(MAX_INPUT));assert(big.valid);assert.equal(outputText(big).length,MAX_INPUT);const elapsed=performance.now()-started;
assert.equal(analyze('A'.repeat(MAX_INPUT+1)).valid,false);const many=Array.from({length:MAX_RECORDS},(_,i)=>'>synthetic_'+i+'\nATGC').join('\n');assert(analyze(many).valid);assert.equal(analyze(many+'\n>extra\nATGC').valid,false);
console.log('PASS: 16 combinations, IUPAC examples/round trips, raw/case preservation, slash tokens, errors, FASTA boundaries/round-trip, max input/records. 1M-base core '+elapsed.toFixed(0)+' ms (Node, not browser).');

for(const outputMode of ['DNA','RNA']){
 const expected=outputMode==='DNA'?'TGC':'UGC';assert.equal(outputText(analyze('ACG',{outputMode,complement:true})),expected);
 assert.equal(outputText(analyze('aCg',{outputMode,complement:true})) ,outputMode==='DNA'?'tGc':'uGc');
 for(const raw of ['ATU','atU','AT/TU/U','>x\nATU']){const result=analyze(raw,{outputMode});assert.equal(result.valid,true);assert.equal(result.errorCount,0);assert(result.warnings.some(w=>w.includes('혼재 오류')));assert(outputText(result).length>0);}
 assert.equal(analyze('A/TU/C',{outputMode}).valid,true,'T/U inside removed token does not affect validation');
 assert.equal(analyze('>x TU\nATGC\n>y\nAUGC',{outputMode}).valid,true,'Separate records can use separate input notation');
}
assert.equal(analyze('auGc',{outputMode:'DNA'}).counts.converted,1);assert.equal(analyze('atGc',{outputMode:'RNA'}).counts.converted,1);
assert.equal(lengthSummary(analyze('/FAM/aN- C/BHQ/')),'최종 길이: 3 nt (DNA 이중가닥 길이 기준 3 bp)');
assert.equal(lengthSummary(analyze('/FAM/aN- C/BHQ/',{outputMode:'RNA'})),'최종 길이: 3 nt');
assert.equal(lengthSummary(analyze('>x\nAT\n>y\nANCG',{outputMode:'RNA'})),'최종 길이: 기록별 2 / 4 nt · 합계 6 nt');
assert.equal(lengthSummary(analyze('AT?')),'');assert.throws(()=>analyze('ATGC',{outputMode:'other'}));assert.equal(transform('TU'),'TT');
const shortSummary=lengthSummary(analyze(many));assert(shortSummary.length<250);assert(shortSummary.includes('합계 4000 nt'));
console.log('PASS: bidirectional output selection, ACG-only complements, per-record T/U policy, conversion counts and final nt/bp length summaries.');

const mixedRaw='/TU/AtUu- N';
for(const [outputMode,expected,indices] of [['DNA','AtTtN',[6,7]],['RNA','AuUuN',[5]]]){
 const result=analyze(mixedRaw,{outputMode});assert.equal(result.raw,mixedRaw);assert(result.valid);assert.equal(outputText(result),expected);assert.equal(result.counts.converted,indices.length);assert.equal(result.warnings.length,1);
 const converted=result.segments.filter(p=>p.kind==='convert').flatMap(p=>Array.from({length:p.end-p.start},(_,i)=>p.start+i));assert.deepEqual(converted,indices);assert(lengthSummary(result).includes('5 nt'));
 for(let i=0;i<4;i++){const opts={outputMode,reverse:Boolean(i&2),complement:Boolean(i&1)};const normalized=outputMode==='DNA'?'ATT':'AUU';assert.equal(outputText(analyze('ATU',opts)),transform(normalized,opts));}
 assert.equal(analyze('ATU?',{outputMode}).valid,false);assert.throws(()=>outputText(analyze('ATU?',{outputMode})));
}
assert.equal(analyze('>TU header\nAT/TU/GC').warnings.length,0);assert.equal(analyze('>a\nATU\n>b\nUTN',{outputMode:'RNA'}).warnings.length,2);
assert.equal(outputText(analyze('>a\nATU\n>b\nUTN',{outputMode:'RNA'})),'>a\nAUU\n>b\nUUN\n');
console.log('PASS: nonblocking mixed T/U notice, exact target-letter highlights, case/raw/count/length preservation and other errors remain blocking.');

const single='>single_reference original description\natGc';
assert.equal(outputText(analyze(single)),'>single_reference original description\natGc\n');
assert.equal(outputText(analyze(single),{fasta:false,name:'do_not_replace',width:2}),'>single_reference original description\nat\nGc\n');
assert.equal(outputText(analyze(single,{reverse:true,complement:true,outputMode:'RNA'})),'>single_reference original description\ngCau\n');
assert.equal(outputText(analyze('atGc')),'atGc');
assert.equal(outputText(analyze('atGc'),{fasta:true,name:'new_name'}),'>new_name\natGc\n');
assert.throws(()=>outputText(analyze(single),{width:2.5}));
const gap=analyze('>alignment_a\nAT--GC');assert.equal(outputText(gap),'>alignment_a\nATGC\n');assert.equal(gap.counts.hyphens,2);assert(gap.warnings.some(w=>w.includes('gap')&&w.includes('2개')));
assert.equal(analyze('>name-with-hyphen\nATGC').warnings.length,0,'Header hyphens are not sequence gaps');
assert.equal(analyze('AT--GC').warnings.length,0,'Ordinary cleanup retains the existing notice policy');
assert.equal(analyze('>mod\nAT/F-AM/GC').warnings.length,0,'Hyphens in a removed token are not sequence gaps');
console.log('PASS: single FASTA default/name/case/wrapping/direction preservation and scoped gap notice.');
