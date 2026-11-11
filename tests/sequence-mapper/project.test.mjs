import assert from 'node:assert/strict';
import {writeProject,readProject,checkDataset,encodeNames,decodeNames,MAGIC} from '../../tools/sequence-mapper/core/project.mjs';
import {referenceGenbank,primerGff3,primerCsv,bindingCsv} from '../../tools/sequence-mapper/core/annotation-export.mjs';
import {RecordStore,readInto} from '../../tools/sequence-mapper/core/parse.mjs';
import {parseText,detectColumns,buildPrimers} from '../../tools/sequence-mapper/core/primer.mjs';
import {STRIDE,REF,QE,COFF,CN} from '../../tools/sequence-mapper/core/alignment.mjs';
const enc=new TextEncoder(),dec=new TextDecoder();
const memory=()=>{const parts=[];return {parts,write:async b=>{parts.push(b.slice());}};};
const asStream=bytes=>new Blob([bytes]).stream();
const join=parts=>{const n=parts.reduce((s,p)=>s+p.length,0),o=new Uint8Array(n);let q=0;for(const p of parts){o.set(p,q);q+=p.length;}return o;};
function sample(n=3000){const pool=new Uint8Array(n*10),offs=new Uint32Array(n+1),meta=new Int32Array(n*STRIDE),cig=new Uint32Array(n);for(let i=0;i<n;i++){pool.fill(65+(i%4),i*10,i*10+10);offs[i+1]=(i+1)*10;const b=i*STRIDE;meta[b+REF]=i%50;meta[b+QE]=10;meta[b+COFF]=i;meta[b+CN]=1;cig[i]=10*16+7;}return {pool,offs,flags:new Uint8Array(n),fileIdx:new Uint16Array(n),meta,cig,extra:new Int32Array(0),names:encodeNames(Array.from({length:n},(_,i)=>`Q${i} 한글 설명`))};}
const info={tool:'t',engine:'2.31',parameters:'-x t',reference:{name:'R desc',format:'FASTA'},state:{primers:[{name:'한글'}],view:{zoom:2}}};
// Round trip: every section and the state come back identical
{const s=sample(),sink=memory(),size=await writeProject(info,s,sink);const file=join(sink.parts);assert.equal(size,file.length);assert(file.length<s.pool.length+s.meta.byteLength,'compressed');
 const r=await readProject(asStream(file));assert.deepEqual(r.manifest.state,info.state);for(const k of Object.keys(s)){assert.equal(r.sections[k].constructor,s[k].constructor,k);assert.deepEqual(new Uint8Array(r.sections[k].buffer),new Uint8Array(s[k].buffer.slice(s[k].byteOffset,s[k].byteOffset+s[k].byteLength)),k);}
 assert.equal(decodeNames(r.sections.names)[2],'Q2 한글 설명');checkDataset({...r.sections},100,3000);}
// Sections larger than one write slice
{const big=new Uint8Array(20e6);for(let i=0;i<big.length;i+=997)big[i]=i&255;const sink=memory();await writeProject(info,{big},sink);const r=await readProject(asStream(join(sink.parts)));assert.equal(r.sections.big.length,big.length);assert.equal(r.sections.big[997*3],big[997*3]);}
// Damage is reported, never loaded
{const sink=memory();await writeProject(info,sample(500),sink);const file=join(sink.parts);
 await assert.rejects(readProject(asStream(file.slice(0,file.length>>1))),/끝까지|손상/);
 const bad=file.slice();bad[bad.length>>1]^=255;await assert.rejects(readProject(asStream(bad)),/손상/);
 await assert.rejects(readProject(asStream(enc.encode('not a project'))),/손상|프로젝트/);}
const gz=async bytes=>{const parts=[],r=new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip')).getReader();for(;;){const {done,value}=await r.read();if(done)break;parts.push(value);}return join(parts);};
const packed=async m=>{const j=enc.encode(JSON.stringify(m)),h=new Uint8Array(MAGIC.length+4);h.set(enc.encode(MAGIC));new DataView(h.buffer).setUint32(MAGIC.length,j.length,true);return gz(join([h,j]));};
await assert.rejects(readProject(asStream(await packed({format:'other',schema:1,sections:[]}))),/프로젝트 파일이 아닙니다/);
await assert.rejects(readProject(asStream(await packed({format:'jsu-sequence-mapper',schema:2,sections:[]}))),/더 새로운/);
await assert.rejects(readProject(asStream(await packed({format:'jsu-sequence-mapper',schema:1,sections:[{name:'x',kind:'evil',bytes:4,sha256:''}]}))),/구획/);
await assert.rejects(readProject(asStream(await gz(enc.encode('XXXXXXXX\0\0\0\0')))),/프로젝트 파일이 아닙니다/);
// Links between sections
{const s=sample(10);const ok=()=>checkDataset(s,100,10);ok();assert.throws(()=>checkDataset(s,100,9),/이름 수/);const o=s.meta[CN];s.meta[CN]=99;assert.throws(ok,/정렬 기록/);s.meta[CN]=o;s.meta[REF]=500;assert.throws(ok,/정렬 기록/);s.meta[REF]=0;const e=s.offs[3];s.offs[3]=1;assert.throws(ok,/위치 기록/);s.offs[3]=e;ok();}
// Annotation exports
const ref=enc.encode('ACGT'.repeat(40));const primers=[{name:'F "1"',set:'B2',sequence:'ACGTACGTAC',visible:true,site:{start:9,end:19,strand:1,mismatches:0,source:'reference'}},{name:'R;2',set:'',sequence:'GTACGTACGT',visible:false,site:{start:30,end:40,strand:-1,mismatches:1,source:'consensus'}},{name:'없음',set:'B2',sequence:'TTTTTTTTTT',visible:true,site:null}];
{const text=referenceGenbank({reference:{name:'NC_1.2 test virus',sequence:ref,features:null,source:{locus:'NC_1',version:'NC_1.2',definition:'test virus'}},primers,date:new Date(Date.UTC(2026,10,6))});
 assert.match(text,/^LOCUS       NC_1\s+160 bp    DNA     linear   UNA 06-NOV-2026\n/);assert.match(text,/VERSION     NC_1\.2/);assert.match(text,/primer_bind     10\.\.19\n/);assert.match(text,/primer_bind     complement\(31\.\.40\)\n/);assert.match(text,/\/label="F ""1"""/);assert(!text.includes('없음'));assert.match(text,/\/\/\n$/);for(const l of text.split('\n'))if(!/^ {21}\/(Sequence|Mismatch Positions)=/.test(l))assert(l.length<=80,l);
 // Geneious qualifiers: the primer's own sequence and its differences from the bound reference (AP-270)
 assert.match(text,/\n {21}\/Sequence="ACGTACGTAC"\n {21}\/Mismatches=\d+\n {21}\/Mismatch Positions="[=ACGT]{10}"\n/);assert.match(text,/\/Sequence="GTACGTACGT"/);
 // Our own reader takes it back
 const st=new RecordStore(16),rep=await readInto(st,new File([text],'r.gb'),0,{keepFeatures:true}),r=st.finish();assert.equal(rep.errors.length,0);assert.equal(r.names[0],'NC_1.2 test virus');assert.equal(dec.decode(r.pool),dec.decode(ref));assert.match(rep.features,/primer_bind/);
 // Features already in the source file stay
 const kept=referenceGenbank({reference:{name:'X',sequence:ref,features:'FEATURES             Location/Qualifiers\n     gene            1..160\n                     /gene="n"',source:null},primers:[]});assert.match(kept,/\/gene="n"/);}
{const text=primerGff3({referenceId:'NC_1.2',referenceLength:160,primers}),rows=text.trim().split('\n');assert.equal(rows[0],'##gff-version 3');assert.equal(rows[1],'##sequence-region NC_1.2 1 160');const a=rows[2].split('\t'),b=rows[3].split('\t');assert.equal(a.length,9);assert.deepEqual([a[0],a[2],a[3],a[4],a[6]],['NC_1.2','primer_binding_site','10','19','+']);assert.deepEqual([b[3],b[4],b[6]],['31','40','-']);assert.match(b[8],/Name=R%3B2;/);assert.match(rows[4],/제외한 primer 1개: 없음/);}
{const csv=primerCsv(primers).split('\r\n');assert.match(csv[0],/^﻿Name,Sequence,Set,/);assert.match(csv[1],/^"F ""1""",ACGTACGTAC,B2,10,0,10,19,\+,0,/);assert.match(csv[3],/위치 없음/);
 // The CSV works as primer input again
 const {rows}=parseText(primerCsv(primers).replace(/"F ""1"""/,'F1').replace('﻿','')),m=detectColumns(rows),r=buildPrimers(rows,m);assert.deepEqual([m.name,m.sequence,m.set],[0,1,2]);assert.equal(r.primers.length,3);}
{const b={result:[{set:'S',name:'P',start:9,end:19,strand:1,total:10,counts:[5,1,0,0,0,4],end3:1,rule:6,variantCount:3}]};const text=bindingCsv(b,[[0,'일치'],['rule','조건 충족']],(t,c)=>c==='rule'?t.rule:t.counts[c],'note');assert.match(text,/S,P,10,19,\+,10,5,6,3/);assert.match(text,/note/);}
// Geneious /Mismatch Positions: along the primer 5'->3', '=' where the primer base covers the bound base (AP-270). Synthetic.
{const {mismatchPositions}=await import('../../tools/sequence-mapper/core/annotation-export.mjs');
 assert.equal(mismatchPositions('ACGAACGT',{start:1,end:9,strand:1},'AACGTACGTT'),'===A====');
 assert.equal(mismatchPositions('AACGGA',{start:1,end:7,strand:-1},'AACCGTTAG'),'=====A');assert.equal(mismatchPositions('AACGGW',{start:1,end:7,strand:-1},'AACCGTTAG'),'======');
 assert.equal(mismatchPositions('ACGT',{start:0,end:4,strand:1},'ANGT'),'=C==');assert.equal(mismatchPositions('TTAC',{start:6,end:10,strand:1},'ACGTAGTT'),'====');assert.equal(mismatchPositions('ACG',{start:0,end:4,strand:1},'ACGT'),null);}
// ZIP (stored): the archive opens with a standard reader. Checked with the system unzip when present.
{const {zipParts,crc32}=await import('../../tools/sequence-mapper/core/zip.mjs');
 assert.equal(crc32(enc.encode('123456789')),0xCBF43926);
 const a=enc.encode('LOCUS a\n//\n'),b=[enc.encode('@HD\tVN:1.6\n'),enc.encode('r1\t0\tA\t1\t60\t4M\t*\t0\t0\tACGT\t*\n')],bs=b.reduce((s,x)=>s+x.length,0);
 const {crc32Start,crc32Update,crc32End}=await import('../../tools/sequence-mapper/core/zip.mjs');let c=crc32Start();for(const x of b)c=crc32Update(c,x);
 const parts=zipParts([{name:'reference_annotated.gb',parts:[a],size:a.length,crc:crc32(a)},{name:'mapping.sam',parts:b,size:bs,crc:crc32End(c)}],new Date(2026,10,12,9,30,0));
 const zip=new Uint8Array(parts.reduce((s,x)=>s+x.length,0));let o=0;for(const x of parts){zip.set(x,o);o+=x.length;}
 const v=new DataView(zip.buffer);assert.equal(v.getUint32(0,true),0x04034b50);assert.equal(v.getUint32(zip.length-22,true),0x06054b50);assert.equal(v.getUint16(zip.length-12,true),2);
 const {mkdtempSync,writeFileSync,readFileSync}=await import('node:fs'),{tmpdir}=await import('node:os'),{join}=await import('node:path'),{execFileSync}=await import('node:child_process');
 const dir=mkdtempSync(join(tmpdir(),'smzip-'));writeFileSync(join(dir,'t.zip'),zip);
 // Windows ships bsdtar, which reads ZIP; GNU tar does not.
 let opened=false;for(const tar of ['C:\\Windows\\System32\\tar.exe','bsdtar']){try{execFileSync(tar,['-xf',join(dir,'t.zip'),'-C',dir],{stdio:'ignore'});opened=true;break;}catch{}}
 if(opened){assert.equal(readFileSync(join(dir,'reference_annotated.gb'),'utf8'),'LOCUS a\n//\n');assert.equal(readFileSync(join(dir,'mapping.sam'),'utf8'),'@HD\tVN:1.6\nr1\t0\tA\t1\t60\t4M\t*\t0\t0\tACGT\t*\n');}else console.log('note: tar not available, ZIP checked by structure only');}
console.log('PASS: Sequence Mapper project round trip, damage handling, GenBank, GFF3 and CSV exports.');
