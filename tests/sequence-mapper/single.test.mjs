import assert from 'node:assert/strict';
import {parseLocation,parseFeatures,featureTypes} from '../../tools/sequence-mapper/core/features.mjs';
import {findSites,placePrimer,reverseComplement} from '../../tools/sequence-mapper/core/primer.mjs';
import {referenceGenbank,primerGff3,primerCsv,primerRows,endOf,PRIMER_COLUMNS} from '../../tools/sequence-mapper/core/annotation-export.mjs';
import {RecordStore,readInto} from '../../tools/sequence-mapper/core/parse.mjs';
const B=s=>new TextEncoder().encode(s);
// Locations
const at=(l,n=1000)=>parseLocation(l,n);
assert.deepEqual(at('5..20'),{ranges:[{start:4,end:20}],strand:1});assert.deepEqual(at('complement(5..20)'),{ranges:[{start:4,end:20}],strand:-1});assert.deepEqual(at('7'),{ranges:[{start:6,end:7}],strand:1});assert.deepEqual(at('<5..>20').ranges,[{start:4,end:20}]);
assert.deepEqual(at('join(1..5,10..20)').ranges,[{start:0,end:5},{start:9,end:20}]);assert.deepEqual(at('complement(join(1..5,10..20))'),{ranges:[{start:0,end:5},{start:9,end:20}],strand:-1});assert.deepEqual(at('join(complement(10..20),complement(1..5))').strand,-1);assert.equal(at('order(1..5,10..20)').ranges.length,2);
assert.equal(at('join(1..5,complement(10..20))').strand,0);
assert.deepEqual(at('join(990..1000,1..5)').ranges,[{start:989,end:1000},{start:0,end:5}]);assert.deepEqual(at('990..5').ranges,[{start:989,end:1000},{start:0,end:5}]);
assert.equal(at('J00194.1:1..5'),null);assert.equal(at('5^6'),null);assert.equal(at('5..2000'),null);assert.equal(at('0..5'),null);
// Features
const block=`FEATURES             Location/Qualifiers
     source          1..1000
                     /organism="synthetic"
     gene            complement(100..200)
                     /gene="abcD"
     CDS             join(100..150,
                     160..200)
                     /gene="abcD"
                     /product="a protein
                     with a long name"
     misc_feature    300..310
                     /note="spans two
                     lines"
     rep_origin      990..1000
     misc_feature    X1.1:5..9
                     /label=remote`;
{const {list,skipped}=parseFeatures(block,1000);assert.equal(list.length,5);assert.equal(skipped,1);assert.deepEqual(list.map(f=>f.type),['source','gene','CDS','misc_feature','rep_origin']);assert.deepEqual(list.map(f=>f.label),['source','abcD','abcD','spans two lines','rep_origin']);assert.equal(list[1].strand,-1);assert.equal(list[2].ranges.length,2);
 const t=featureTypes(list);assert.equal(t.find(x=>x.type==='source').visible,false);assert.equal(t.find(x=>x.type==='gene').visible,true);}
assert.deepEqual(parseFeatures(null,10),{list:[],skipped:0});
// Origin: linear finds nothing, circular finds it on both strands
const seq='GATTCCAGTCAGGTCTAGCATCGGATCAAGTCGCTTAGGACATTCGGCATAGCTTAGGCACGTTACCGATCGAATCGG',L=seq.length,R=B(seq),span=seq.slice(-8)+seq.slice(0,10);
assert.equal(findSites(R,span).length,0);
{const h=findSites(R,span,{circular:true});assert.equal(h.length,1);assert.deepEqual([h[0].start,h[0].end,h[0].strand],[L-8,L+10,1]);assert.equal(endOf(h[0],L),10);}
{const h=findSites(R,reverseComplement(span),{circular:true});assert.deepEqual([h[0].start,h[0].end,h[0].strand],[L-8,L+10,-1]);}
{const inner=seq.slice(10,28),a=findSites(R,inner),b=findSites(R,inner,{circular:true});assert.deepEqual(a,b);}
assert.equal(findSites(R,seq+seq.slice(0,5),{circular:true}).length,0);
// A site at the very last base stays inside
{const tail=seq.slice(-12),h=findSites(R,tail,{circular:true}).find(x=>x.strand>0);assert.equal(h.end,L);}
assert.equal(placePrimer({name:'x',sequence:span},R,null,{circular:true}).site.end,L+10);assert.equal(placePrimer({name:'x',sequence:span},R,null,{}).site,null);
// GenBank
const reference={name:'PL1.1 test plasmid',sequence:R,source:{locus:'PL1',version:'PL1.1',definition:'test plasmid',topology:'circular'},features:null},date=new Date('2026-11-06');
const primers=[{name:'SPAN',set:'A',sequence:span,visible:true,site:{start:L-8,end:L+10,strand:1,mismatches:0,source:'reference'}},{name:'BACK',set:'',sequence:'AAAA',visible:true,site:{start:L-8,end:L+10,strand:-1,mismatches:0,source:'reference'}},{name:'IN',set:'',sequence:'AAAA',visible:true,site:{start:3,end:15,strand:-1,mismatches:1,source:'reference'}},{name:'NONE',set:'',sequence:'AAAA',visible:true,site:null}];
{const g=referenceGenbank({reference,primers,date});assert.match(g,/^LOCUS +PL1 +78 bp +DNA +circular UNA 06-NOV-2026/);assert.match(g,new RegExp(`primer_bind +join\\(${L-7}\\.\\.${L},1\\.\\.10\\)`));assert.match(g,new RegExp(`primer_bind +complement\\(join\\(${L-7}\\.\\.${L},1\\.\\.10\\)\\)`));assert.match(g,/primer_bind +complement\(4\.\.15\)/);assert.doesNotMatch(g,/NONE/);}
assert.match(referenceGenbank({reference:{...reference,source:{...reference.source,topology:'linear'}},primers:[],date}),/DNA +linear   UNA/);assert.match(referenceGenbank({reference:{...reference,source:null},primers:[],date}),/DNA +linear   UNA/);assert.match(referenceGenbank({reference:{...reference,topology:'linear'},primers:[],date}),/linear   UNA/);
// The LOCUS topology survives a read
{const s=new RecordStore(1<<10),r=await readInto(s,new File([referenceGenbank({reference,primers,date})],'p.gb'),0,{keepFeatures:true});assert.equal(r.source.topology,'circular');assert.equal(s.finish().names.length,1);const f=parseFeatures(r.features,L).list.filter(x=>x.type==='primer_bind');assert.equal(f.length,3);assert.deepEqual(f[0].ranges,[{start:L-8,end:L},{start:0,end:10}]);assert.equal(f[1].strand,-1);assert.equal(f[0].label,'SPAN');}
// GFF3 and CSV
{const g=primerGff3({referenceId:'PL1.1',referenceLength:L,primers,circular:true});assert.match(g,/\tregion\t1\t78\t.*Is_circular=true/);assert.match(g,new RegExp(`primer_binding_site\\t${L-7}\\t${L+10}\\t`));assert.doesNotMatch(primerGff3({referenceId:'x',referenceLength:L,primers}),/Is_circular/);}
{const rows=primerRows(primers,{length:L,metrics:p=>({tm:'60.0',gc:'50.0'})});assert.equal(rows[0][PRIMER_COLUMNS.indexOf('End_1based')],10);assert.equal(rows[0][PRIMER_COLUMNS.indexOf('Tm_C')],'60.0');assert.equal(rows[3][PRIMER_COLUMNS.indexOf('Start_1based')],'');const c=primerCsv(primers,{length:L});assert.match(c,/Tm_C,GC_percent,Self_dimer_min_dG\r\n/);assert.equal(c.trim().split('\r\n').length,5);}
console.log('PASS: Sequence Mapper GenBank features, circular search, origin-spanning exports and topology.');
