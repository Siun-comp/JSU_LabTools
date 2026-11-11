import assert from 'node:assert/strict';
import {normalizeSequence,reverseComplement,parseText,detectColumns,buildPrimers,findSites,placePrimer,chooseHit,siteForm,mixedBases,MASK} from '../../tools/sequence-mapper/core/primer.mjs';
import {computeBinding,runToEnd,classify,passesRule,CAT,END3_FLAG,RULE_FLAG,recordsInCell} from '../../tools/sequence-mapper/core/binding.mjs';
import {analyzeSelection,gcRange,tmSummary,selfDimerSummary,DEFAULT_CONDITIONS} from '../../tools/sequence-mapper/core/selection.mjs';
import {STRIDE,REF,QS,QE,HITS,COFF,CN,OP} from '../../tools/sequence-mapper/core/alignment.mjs';
import {duplex} from '../../tools/oligo-thermodynamics/duplex-nn.mjs';
import {conditionsFromStrings} from '../../tools/oligo-thermodynamics/conditions.mjs';
import {analyzePair,formatDG} from '../../tools/oligo-analysis/dimer.mjs';
const enc=new TextEncoder(),B=s=>enc.encode(s);
// Input
assert.equal(normalizeSequence("5'-acgu acgt ac-3'").sequence,'ACGTACGTAC');assert.match(normalizeSequence('ACGTXACGTA').error,/X/);assert.match(normalizeSequence('ACG').error,/짧/);assert.match(normalizeSequence('').error,/없/);
assert.equal(reverseComplement('ACGTRYN'),'NRYACGT');assert.equal(mixedBases('ACRYN'),3);
{const {rows}=parseText('>B2_F3 x\nACGTACGT\nAC\n>B2_B3\nTTTTGGGG\n');assert.deepEqual(rows[1],['B2_F3 x','ACGTACGTAC']);const m=detectColumns(rows);assert.equal(m.header,true);assert.equal(m.sequence,1);}
{const {rows}=parseText('Set\tPrimer_Name\tSequence_5to3\nB2\tF3\tACGTACGTAC\nB2\tF3\tACGTACGTAA\n\t\t\nB2\t\tACGTACGTAA\nB2\tB3\tACXT\n');const m=detectColumns(rows);assert.deepEqual([m.set,m.name,m.sequence],[0,1,2]);const {primers,errors}=buildPrimers(rows,m);assert.deepEqual(primers.map(p=>p.name),['F3','F3 (2)']);assert.equal(primers[1].renamed,true);assert.equal(errors.length,2);assert.match(errors[0],/5행.*이름/);assert.match(errors[1],/6행 B3/);assert.equal(primers[0].set,'B2');}
{const {rows}=parseText('한글 이름,acgtacgtac\nsecond,ttttggggcc\n');const m=detectColumns(rows);assert.equal(m.header,false);const r=buildPrimers(rows,m,{defaultSet:'S1'});assert.equal(r.primers.length,2);assert.equal(r.primers[0].name,'한글 이름');assert.equal(r.primers[0].set,'S1');}
// Geneious annotation CSV: 'Sequence (with extension)' column, only primer rows read
{const {rows}=parseText('Name,Sequence Name,Type,Minimum,Maximum,Direction,Sequence (with extension),Tm\ngene1,Ref,gene,1,900,forward,,\nP-F,Consensus,primer_bind,10,29,forward,ACGTACGTACGT,55.0\nP-R,Consensus,primer_bind,80,99,reverse,UUGGCCAAGGCC,56.0\nnote,Ref,misc_feature,5,7,forward,,\n');const m=detectColumns(rows);assert.deepEqual([m.name,m.sequence,m.set,m.type],[0,6,-1,2]);const r=buildPrimers(rows,m);assert.deepEqual(r.primers.map(p=>[p.name,p.sequence]),[['P-F','ACGTACGTACGT'],['P-R','TTGGCCAAGGCC']]);assert.equal(r.skipped,2);assert.equal(r.errors.length,0);}
{const {rows}=parseText('Name,Type,Sequence\nF,note,ACGTACGTAC\n');const m=detectColumns(rows);assert.equal(m.type,-1);assert.equal(buildPrimers(rows,m).primers.length,1);}
{const r=buildPrimers([['F','ACGTACGTAC']],{header:false,name:0,sequence:1,set:-1},{existing:[{name:'F',set:''}]});assert.equal(r.primers[0].name,'F (2)');}
// Site search, 0-based half-open
const ref='TTTTTTTTTTACGGATCCTAGGCAATTTTTTTTTTTGGCATTAGCCAGTCCCCCCCCCC',R=B(ref),F='ACGGATCCTAGGCAA',RV=reverseComplement('GGCATTAGCCAGT');
{const h=findSites(R,F);assert.equal(h.length,1);assert.deepEqual([h[0].start,h[0].end,h[0].strand,h[0].mismatches],[10,25,1,0]);}
{const h=findSites(R,RV);assert.equal(h.length,1);assert.deepEqual([h[0].start,h[0].end,h[0].strand],[36,49,-1]);}
{const q='ACGGATCCTAGGCAT';assert.equal(findSites(R,q).length,0);const h=findSites(R,q,{maxMismatch:1});assert.equal(h[0].mismatches,1);assert.deepEqual(h[0].positions,[14]);assert.equal(findSites(R,q,{maxMismatch:1,end3Exact:3}).length,0);const inner='ACGGTTCCTAGGCAA';assert.equal(findSites(R,inner,{maxMismatch:1,end3Exact:3}).length,1);}
// 3-prime end of a minus-strand primer sits at the left of the site
{const site=ref.slice(36,49),changed='A'+site.slice(1);assert.notEqual(site[0],'A');const q=reverseComplement(changed);assert.equal(findSites(R,q,{maxMismatch:1}).length>0,true);assert.equal(findSites(R,q,{maxMismatch:1,end3Exact:3}).filter(h=>h.start===36).length,0);}
// Mixed bases are compatibility sets
{assert.equal(findSites(R,'ACGGATCCTRGGCAA').filter(h=>h.mismatches===0).length,1);assert.equal(findSites(R,'ACGGATCCTYGGCAA').length,0);assert.equal(findSites(R,'NCGGATCCTAGGCAA')[0].start,10);}
// Sites at the very ends
assert.equal(findSites(R,ref.slice(50)+'AAAA').length,0);assert.equal(findSites(R,ref.slice(0,12)).filter(h=>h.start===0&&h.strand>0).length,1);{const h=findSites(R,ref.slice(-12)).find(x=>x.strand>0);assert.equal(h.end,ref.length);}
// Placement falls back to the consensus and keeps reference coordinates
{const cons=B(ref.replace('ACGGATCC','ACGGTTCC')),p=placePrimer({name:'x',sequence:'ACGGTTCCTAGGCAA'},R,cons,{maxMismatch:0});assert.equal(p.site.source,'consensus');assert.equal(p.site.start,10);const none=placePrimer({name:'y',sequence:'GGGGGGGGGGGGGGG'},R,null,{});assert.equal(none.placed,'missing');assert.equal(none.site,null);}
{const two=B('ACGTTGCAAGTTTTACGTTGCAAG'),p=placePrimer({name:'d',sequence:'ACGTTGCAAG'},two,null,{});assert.equal(p.hits.length,2);assert.equal(chooseHit(p,1).site.start,14);}
// LAMP parts registered one by one; opposite strands stay apart
{const F2='GGATCCTAGG',F1c=reverseComplement('GCATTAGCCA');const a=findSites(R,F2)[0],b=findSites(R,F1c)[0];assert.equal(a.strand,1);assert.equal(b.strand,-1);assert(a.start<b.start);}
// Binding classes on hand-made rows
{const p={start:2,masks:Uint8Array.from('ACGTA',c=>MASK[c.charCodeAt(0)]),strand:1};const row=s=>Uint8Array.from(s,c=>c==='_'?0:c.charCodeAt(0)),ins=new Uint16Array(9);
 assert.equal(classify(row('TTACGTATT'),ins,p,3),CAT.MATCH);assert.equal(classify(row('TTTCGTATT'),ins,p,3),CAT.MM1);assert.equal(classify(row('TTACGTTTT'),ins,p,3),CAT.MM1|END3_FLAG);assert.equal(classify(row('TTACTATTT'),ins,p,3),CAT.MM2|END3_FLAG);assert.equal(classify(row('TTAC-TATT'),ins,p,3),CAT.INDEL);assert.equal(classify(row('TTACNTATT'),ins,p,3),CAT.UNRESOLVED);assert.equal(classify(row('TTAC_____'),ins,p,3),CAT.UNCOVERED);
 const i2=new Uint16Array(9);i2[4]=2;assert.equal(classify(row('TTACGTATT'),i2,p,3),CAT.INDEL);i2[4]=0;i2[2]=1;assert.equal(classify(row('TTACGTATT'),i2,p,3),CAT.MATCH,'insertion just before the site is outside it');
 const minus={...p,strand:-1};assert.equal(classify(row('TTTCGTATT'),ins,minus,3),CAT.MM1|END3_FLAG);assert.equal(classify(row('TTACGTTTT'),ins,minus,3),CAT.MM1);
 const mixed={...p,masks:Uint8Array.from('RCGTA',c=>MASK[c.charCodeAt(0)])};assert.equal(classify(row('TTGCGTATT'),ins,mixed,3),CAT.MATCH);assert.equal(classify(row('TTRCGTATT'),ins,mixed,3),CAT.MATCH);assert.equal(classify(row('TTNCGTATT'),ins,mixed,3),CAT.UNRESOLVED);}
// User rule: 3-prime N exact and at most M mismatches overall
{const site='ACGTACGTAC',p={start:0,masks:Uint8Array.from(site,c=>MASK[c.charCodeAt(0)]),strand:1},row=s=>Uint8Array.from(s,c=>c==='_'?0:c.charCodeAt(0)),ins=new Uint16Array(10),rule={end3:5,maxMismatch:1},pass=(s,r=rule,q=p,i=ins)=>passesRule(row(s),i,q,r);
 assert.equal(pass('ACGTACGTAC'),true);assert.equal(pass('TCGTACGTAC'),true,'one mismatch outside the 3-prime zone');assert.equal(pass('ACGTTCGTAC'),true,'last position outside the zone');assert.equal(pass('ACGTAGGTAC'),false,'first position inside the zone');assert.equal(pass('ACGTACGTAG'),false,'3-prime end');assert.equal(pass('TGGTACGTAC'),false,'two mismatches');
 assert.equal(pass('TGGTACGTAC',{end3:5,maxMismatch:2}),true);assert.equal(pass('ACGTAGGTAC',{end3:3,maxMismatch:1}),true);assert.equal(pass('TCGTACGTAC',{end3:0,maxMismatch:0}),false);assert.equal(pass('ACGTACGTAC',{end3:10,maxMismatch:0}),true);
 assert.equal(pass('AC-TACGTAC'),false,'deletion');assert.equal(pass('NCGTACGTAC'),false,'unresolved base');assert.equal(pass('_CGTACGTAC'),false,'uncovered');const i2=new Uint16Array(10);i2[3]=1;assert.equal(pass('ACGTACGTAC',rule,p,i2),false,'insertion');
 const minus={...p,strand:-1};assert.equal(pass('ACGTACGTAG',rule,minus),true,'minus strand: right end is 5-prime');assert.equal(pass('TCGTACGTAC',rule,minus),false,'minus strand: left end is 3-prime');}
// Whole table: every record counted once, duplicates stay separate
{const seqs=['ACGTACGTACGT','ACGTACGTACGT','ACGTTCGTACGT','GTACGT','AAAA'],pool=B(seqs.join('')),offs=new Uint32Array(6);seqs.forEach((s,i)=>{offs[i+1]=offs[i]+s.length;});const meta=new Int32Array(5*STRIDE),cig=[];
 const hit=(i,start,len,ops)=>{const b=i*STRIDE;meta[b+REF]=start;meta[b+QS]=0;meta[b+QE]=len;meta[b+HITS]=1;meta[b+COFF]=cig.length;meta[b+CN]=ops.length;for(const [l,o] of ops)cig.push(l*16+o);};
 hit(0,0,12,[[12,OP.EQ]]);hit(1,0,12,[[12,OP.EQ]]);hit(2,0,12,[[4,OP.EQ],[1,OP.X],[7,OP.EQ]]);hit(3,6,6,[[6,OP.EQ]]);meta[4*STRIDE+REF]=-1;
 const S={pool,offs,meta,cig:Uint32Array.from(cig)},order=Uint32Array.from([0,1,2,3,4]),primers=[{id:1,name:'P',set:'',sequence:'ACGTACGT',site:{start:0,end:8,strand:1}},{id:2,name:'Q',set:'',sequence:'ACGTACGT',site:null}];
 const r=runToEnd(computeBinding(S,order,primers,12));assert.equal(r.result.length,1);const t=r.result[0];assert.deepEqual(t.counts,[2,1,0,0,0,2]);assert.equal(t.total,5);assert.equal(t.counts.reduce((a,b)=>a+b),5);assert.equal(t.variantCount,2);assert.equal(t.variants[0].count,2);assert.equal(t.variants[0].differences,0);assert.equal(t.variants[1].differences,1);
 {const withRef=runToEnd(computeBinding(S,order,primers,12,{reference:new TextEncoder().encode('ACGTACGTACGT')})),base=runToEnd(computeBinding(S,order,primers,12)),x=withRef.result[0];assert.equal(withRef.reference,true);assert.equal(withRef.n,order.length+1);assert.equal(x.total,order.length+1);assert.equal(x.counts.reduce((a,b)=>a+b,0),order.length+1);assert.equal(x.counts[CAT.MATCH],base.result[0].counts[CAT.MATCH]+1,'an exact reference is one more match');for(const c of [CAT.MATCH,'rule'])assert.deepEqual([...recordsInCell(withRef.cats,withRef.n,0,order,c)],[...recordsInCell(base.cats,base.n,0,order,c)],'the reference is not a record position');}
 assert.equal(t.rule,2,'mismatch at position 5 of 8 falls in the 5-nt zone');assert.deepEqual([...recordsInCell(r.cats,r.n,0,order,'rule')],[0,1]);const relaxed=runToEnd(computeBinding(S,order,primers,12,{rule:{end3:3,maxMismatch:1}}));assert.equal(relaxed.result[0].rule,3);assert.deepEqual(relaxed.rule,{end3:3,maxMismatch:1});assert.equal(relaxed.cats[2]&RULE_FLAG,RULE_FLAG);assert.deepEqual([...recordsInCell(r.cats,r.n,0,order,CAT.MATCH)],[0,1]);assert.deepEqual([...recordsInCell(r.cats,r.n,0,order,CAT.UNCOVERED)],[3,4]);
 const rev={id:3,name:'R',set:'',sequence:reverseComplement('ACGTACGT'),site:{start:0,end:8,strand:-1}};assert.equal(siteForm(rev),'ACGTACGT');const r2=runToEnd(computeBinding(S,order,[rev],12));assert.deepEqual(r2.result[0].counts,[2,1,0,0,0,2]);assert.equal(r2.result[0].variants[0].sequence,rev.sequence);}
// Selection: identical to the existing tools for plain sequences
{const C=conditionsFromStrings(DEFAULT_CONDITIONS),s='ACGTTGCATGGCTAAGCTTGCA',a=analyzeSelection(s);assert.equal(a.length,22);assert.equal(a.tm.variants,1);assert.equal(a.tm.mean,duplex(s,C).tm);assert.equal(a.tm.min,a.tm.max);const rec={name:'x',sequence:s},p=analyzePair(rec,rec,'idt');assert.equal(a.self.minimum,p.minimum);assert.equal(a.self.text,formatDG(p.minimum));assert.equal(a.self.warning,p.warning);assert.equal(a.self.structures,p.structures.length);}
{const r=tmSummary('ACGTTGCRTGGCTAAGCYTGCN',DEFAULT_CONDITIONS);assert.equal(r.variants,16);assert(r.min<r.mean&&r.mean<r.max);const C=conditionsFromStrings(DEFAULT_CONDITIONS),all=[];for(const a of 'AG')for(const b of 'CT')for(const c of 'ACGT')all.push(duplex(`ACGTTGC${a}TGGCTAAGC${b}TGC${c}`,C).tm);assert.equal(r.min,Math.min(...all));assert.equal(r.max,Math.max(...all));}
assert.equal(tmSummary('A',DEFAULT_CONDITIONS).status,'na');assert.equal(tmSummary('A'.repeat(61),DEFAULT_CONDITIONS).status,'na');assert.equal(tmSummary('ACGT'+'N'.repeat(6),DEFAULT_CONDITIONS).status,'na');
assert.equal(selfDimerSummary('A'.repeat(201)).status,'na');assert.equal(selfDimerSummary('ACGTNNNNACGT').status,'na');assert.equal(selfDimerSummary('AAAAAAAAAAAA').status,'none');
{const s=selfDimerSummary('ACGTRCGTAC');assert.equal(s.variants,2);assert.equal(s.status,'ok');}
assert.deepEqual(gcRange('GCAT'),{min:50,max:50});{const g=gcRange('GNAT');assert.equal(g.min,25);assert.equal(g.max,50);}
console.log('PASS: Sequence Mapper primer input, site search, binding classes, LAMP parts and selection analysis.');
