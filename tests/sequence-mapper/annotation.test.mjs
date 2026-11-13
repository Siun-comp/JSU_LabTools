// Reference annotations: GenBank types kept for display, GFF3/CSV import with line-numbered errors, GenBank export of
// imported annotations, consensus filled from the reference. Synthetic data only (AP-275).
import assert from 'node:assert/strict';
import {parseFeatures,shownTypes,ANNOTATION_TYPES} from '../../tools/sequence-mapper/core/features.mjs';
import {readAnnotationFile} from '../../tools/sequence-mapper/core/annotation-import.mjs';
import {referenceGenbank} from '../../tools/sequence-mapper/core/annotation-export.mjs';

// GenBank: only CDS, gene and mRNA are shown; gene and product are kept for hover and search
{const text=['FEATURES             Location/Qualifiers','     source          1..300','     gene            10..200','                     /gene="synA"','     mRNA            join(10..50,100..200)','                     /gene="synA"','     CDS             join(20..50,100..180)','                     /gene="synA"','                     /product="synthetic protein A"','     misc_feature    5..8','                     /note="x"'].join('\n');
 const all=parseFeatures(text,300).list,shown=shownTypes(all);
 assert.deepEqual(ANNOTATION_TYPES,['CDS','gene','mRNA']);assert.deepEqual(shown.map(f=>f.type),['gene','mRNA','CDS']);
 const cds=shown[2];assert.equal(cds.label,'synA');assert.equal(cds.product,'synthetic protein A');assert.deepEqual(cds.ranges,[{start:19,end:50},{start:99,end:180}]);assert.equal(cds.strand,1);}

const opts={referenceLength:300,referenceId:'SYN_REF.1',source:{id:1,name:'t.gff3'}};
// GFF3: pieces sharing an ID join into one annotation; other types are skipped and counted
{const gff=['##gff-version 3','SYN_REF.1\tsyn\tgene\t10\t200\t.\t-\t.\tID=g1;Name=synB','SYN_REF.1\tsyn\tCDS\t20\t50\t.\t-\t0\tID=c1;Parent=g1;gene=synB;product=protein%20B','SYN_REF.1\tsyn\tCDS\t100\t180\t.\t-\t0\tID=c1;Parent=g1','SYN_REF.1\tsyn\texon\t20\t50\t.\t-\t.\tID=e1'].join('\n');
 const r=readAnnotationFile(gff,opts);assert.deepEqual(r.errors,[]);assert.equal(r.format,'GFF3');assert.equal(r.skipped,1);
 assert.deepEqual(r.list.map(f=>[f.type,f.label,f.strand,f.ranges.length]),[['gene','synB',-1,1],['CDS','synB',-1,2]]/* name order: Name, gene, ID */);assert.equal(r.list[1].product,'protein B');assert.equal(r.list[1].gene,'synB');assert.equal(r.list[0].source,'t.gff3');}
// GFF3: a different single seqid is taken with a note; several without a match is an error
{const one=readAnnotationFile('##gff-version 3\nOTHER.1\ts\tgene\t1\t10\t.\t+\t.\tName=g',opts);assert.deepEqual(one.errors,[]);assert.match(one.notes[0],/다릅니다/);
 const many=readAnnotationFile('##gff-version 3\nA.1\ts\tgene\t1\t10\t.\t+\t.\tName=a\nB.1\ts\tgene\t1\t10\t.\t+\t.\tName=b',opts);assert.match(many.errors[0],/같은 것이 없습니다/);assert.deepEqual(many.list,[]);
 const pick=readAnnotationFile('##gff-version 3\nA.1\ts\tgene\t1\t10\t.\t+\t.\tName=a\nSYN_REF.2\ts\tgene\t1\t10\t.\t+\t.\tName=b',opts);assert.deepEqual(pick.list.map(f=>f.label),['b']);}
// GFF3 errors stop the file, with line numbers
{const bad=readAnnotationFile('##gff-version 3\nSYN_REF.1\ts\tCDS\t50\t20\t.\t+\t0\tID=x\nSYN_REF.1\ts\tgene\t1\t400\t.\t+\t.\tID=y\nSYN_REF.1\ts\tgene\t1\t10\t.\tx\t.\tID=z',opts);
 assert.deepEqual(bad.list,[]);assert.equal(bad.errors.length,3);assert.match(bad.errors[0],/^2번째 줄/);assert.match(bad.errors[1],/^3번째 줄/);assert.match(bad.errors[2],/^4번째 줄: 방향/);}
// CSV / TSV
{const csv='Name,Type,Start,End,Strand,Product\n"syn, C",CDS,30,90,-,protein C\nP2,mRNA,1,300,+,\nskip,exon,1,5,+,';
 const r=readAnnotationFile(csv,{...opts,source:{id:2,name:'t.csv'}});assert.deepEqual(r.errors,[]);assert.equal(r.format,'표');assert.equal(r.skipped,1);
 assert.deepEqual(r.list.map(f=>[f.type,f.label,f.strand,f.ranges[0].start,f.ranges[0].end,f.product]),[['CDS','syn, C',-1,29,90,'protein C'],['mRNA','P2',1,0,300,'']]);
 const tsv=readAnnotationFile('name\ttype\tstart\tend\tstrand\nA\tgene\t5\t9\t+',opts);assert.equal(tsv.list.length,1);
 assert.match(readAnnotationFile('Name,Start,End\nA,1,2',opts).errors[0],/머리글/);
 const bad=readAnnotationFile('Name,Type,Start,End,Strand\nA,CDS,1,301,+\n,gene,1,2,+\nB,gene,1,2,.',opts);assert.equal(bad.errors.length,3);assert.match(bad.errors[1],/Name이 비어/);assert.match(bad.errors[2],/Strand/);
 assert.match(readAnnotationFile('Name,Type,Start,End,Strand\nA,exon,1,2,+',opts).errors[0],/CDS·gene·mRNA annotation이 없습니다/);}
// GenBank export carries imported annotations as their own features
{const seq=new TextEncoder().encode('ACGT'.repeat(75)),imp=readAnnotationFile('##gff-version 3\nSYN_REF.1\ts\tCDS\t20\t50\t.\t-\t0\tID=c1;Name=synD;product=protein D\nSYN_REF.1\ts\tCDS\t100\t180\t.\t-\t0\tID=c1',opts).list;
 const gb=referenceGenbank({reference:{name:'SYN_REF.1 s',sequence:seq,features:null,source:null},primers:[],annotations:imp,date:new Date(Date.UTC(2026,10,13))});
 assert.match(gb,/\n {5}CDS {13}complement\(join\(20\.\.50,100\.\.180\)\)\n {21}\/label="synD"\n {21}\/product="protein D"\n {21}\/note="JSU Sequence Mapper: imported from t\.gff3"\n/);}
console.log('PASS: Sequence Mapper reference annotations: GenBank types, GFF3/CSV import and errors, GenBank export of imported annotations.');
