// SPDX-License-Identifier: GPL-2.0-or-later
// Primer input and binding-site search. A sequence match is not a claim that priming will work.
const CODES={A:1,C:2,G:4,T:8,R:5,Y:10,S:6,W:9,K:12,M:3,B:14,D:13,H:11,V:7,N:15};
// Primer colours offered to the user. An empty colour is the default green. Differences are drawn as hatched cells
// (consensusDiffs), not as a colour, so the colour only ever means what the user chose.
export const PRIMER_COLORS=Object.freeze([['','기본'],['#7030A0','보라'],['#0926FB','파랑'],['#00B050','초록'],['#FFC000','노랑'],['#FF0000','빨강']]);
export const primerFill=color=>color||'#3f9a63';
// Dark text on light fills (yellow), white otherwise.
export function primerInk(fill){const n=parseInt(fill.slice(1),16),r=n>>16,g=n>>8&255,b=n&255;return 0.299*r+0.587*g+0.114*b>170?'#1f2d3a':'#fff';}
export const MASK=new Uint8Array(256);for(const [k,v] of Object.entries(CODES))MASK[k.charCodeAt(0)]=v;
const COMP={A:'T',C:'G',G:'C',T:'A',R:'Y',Y:'R',S:'S',W:'W',K:'M',M:'K',B:'V',V:'B',D:'H',H:'D',N:'N'};
export const reverseComplement=s=>{let o='';for(let i=s.length-1;i>=0;i--)o+=COMP[s[i]];return o;};
// Positions where a placed primer differs from the consensus (or, with one sequence, from that sequence), read on the
// top strand: a minus-strand primer is compared as its reverse complement. A primer base matches when it covers the
// consensus base (R covers A and G; an ambiguous consensus must lie wholly inside it). Positions with no consensus
// or an N consensus are not compared; a deletion consensus counts as a difference. Returns {pos, base} with pos the
// reference position (wrapped on a circular reference) and base the primer's top-strand base there.
export function consensusDiffs(sequence,site,target){
 const out=[],L=target?.length??0;if(!L||!site||site.end-site.start!==sequence.length)return out;
 const top=site.strand<0?reverseComplement(sequence):sequence;
 for(let i=0;i<top.length;i++){const pos=(site.start+i)%L,c=target[pos];if(!c||c===78)continue;const m=MASK[c];if(!m||m&~MASK[top.charCodeAt(i)])out.push({pos,base:top[i]});}
 return out;}
export const MAX_PRIMER_LENGTH=200,MIN_PRIMER_LENGTH=8;
// Raised when site search changes. 2: N in the target is unresolved, not a match.
export const PLACEMENT_METHOD=2;

export function normalizeSequence(raw){
 const s=String(raw??'').toUpperCase().replace(/^\s*5['′]?\s*-?\s*/,'').replace(/\s*-?\s*3['′]?\s*$/,'').replace(/\s+/g,'').replace(/U/g,'T');
 if(!s)return {error:'서열이 없습니다.'};
 const bad=[...new Set([...s].filter(c=>!COMP[c]))];
 if(bad.length)return {error:`지원하지 않는 문자: ${bad.join(' ')}`};
 if(s.length<MIN_PRIMER_LENGTH)return {error:`${MIN_PRIMER_LENGTH} nt보다 짧습니다.`};
 if(s.length>MAX_PRIMER_LENGTH)return {error:`${MAX_PRIMER_LENGTH} nt보다 깁니다.`};
 return {sequence:s};
}
export const mixedBases=s=>[...s].filter(c=>!'ACGT'.includes(c)).length;

// Text input: FASTA, or a table separated by tab or comma.
// Comma tables may quote a cell that holds a comma.
function splitQuoted(line,sep){const out=[];let cur='',quoted=false;for(let i=0;i<line.length;i++){const c=line[i];if(quoted){if(c==='"'){if(line[i+1]==='"'){cur+='"';i++;}else quoted=false;}else cur+=c;}else if(c==='"'&&!cur.trim())quoted=true,cur='';else if(c===sep){out.push(cur);cur='';}else cur+=c;}out.push(cur);return out.map(x=>x.trim());}
export function parseText(text){
 const clean=text.replace(/^﻿/,'').trim();if(!clean)return {rows:[]};
 const lines=clean.split(/\r?\n/);
 if(lines[0].startsWith('>')){const rows=[['Name','Sequence']];for(const l of lines){if(l.startsWith('>'))rows.push([l.slice(1).trim(),'']);else if(rows.length>1)rows.at(-1)[1]+=l.trim();}return {rows};}
 const sep=lines[0].includes('\t')?'\t':lines[0].includes(',')?',':/\s+/;
 return {rows:lines.map(l=>typeof sep==='string'?splitQuoted(l,sep):l.split(sep).map(c=>c.trim().replace(/^"(.*)"$/,'$1')))};
}
const NAME=/^(primer[_ ]?name|name|oligo|oligo[_ ]?name|primer|id|이름|프라이머|올리고)$/i,SEQ=/^(sequence(_5to3)?|sequence \(with extension\)|seq|5.?-?3.?|서열|염기서열)$/i,SET=/^(set(_id)?|group|세트|그룹)$/i,TYPE=/^type$/i,PRIMER_TYPE=/^primer(_bind)?$/i;
// A Geneious annotation table has a Type column; only primer rows are read from it.
const isPrimerType=v=>PRIMER_TYPE.test(String(v??'').trim());
// Finds columns from a header row; a first row that already holds a sequence means there is no header.
export function detectColumns(rows){
 const head=rows[0]??[],find=re=>head.findIndex(c=>re.test(String(c).trim()));let name=find(NAME),sequence=find(SEQ),set=find(SET);
 if(name>=0||sequence>=0){let type=find(TYPE);if(type>=0&&!rows.slice(1).some(r=>isPrimerType(r[type])))type=-1;return {header:true,name,sequence,set,type};}
 const looksSeq=c=>/^[ACGTUacgtuRYSWKMBDHVNryswkmbdhvn\s]{8,}$/.test(String(c));
 sequence=head.findIndex(looksSeq);name=head.findIndex((c,i)=>i!==sequence&&String(c).trim());
 return {header:false,name,sequence,set:-1,type:-1};
}
export function buildPrimers(rows,map,{defaultSet='',existing=[]}={}){
 const primers=[],errors=[],type=map.type??-1;let skipped=0;const taken=new Set(existing.map(p=>p.set+'\0'+p.name)),first=map.header?1:0;
 for(let i=first;i<rows.length;i++){const r=rows[i],line=i+1;
  if(!r||r.every(c=>!String(c??'').trim()))continue;
  if(type>=0&&!isPrimerType(r[type])){skipped++;continue;}
  const name=String(r[map.name]??'').trim(),raw=r[map.sequence];
  if(!name){errors.push(`${line}행: 이름이 없습니다.`);continue;}
  const n=normalizeSequence(raw);if(n.error){errors.push(`${line}행 ${name}: ${n.error}`);continue;}
  const set=(map.set>=0?String(r[map.set]??'').trim():'')||defaultSet;
  let unique=name,k=2;while(taken.has(set+'\0'+unique))unique=`${name} (${k++})`;taken.add(set+'\0'+unique);
  primers.push({name:unique,set,sequence:n.sequence,renamed:unique!==name,visible:true});
 }
 return {primers,errors,skipped};
}

// Scans both strands. Minus-strand hits compare the reverse complement, so 3' lies at the left end of the site.
// A circular target is searched past its end, so a site across the origin has end > target length.
// A target base the primer only partly covers (N against A) is unresolved: it uses up the allowance like a mismatch and never counts as a match.
export function findSites(target,sequence,{maxMismatch=0,end3Exact=0,circular=false}={}){
 const hits=[],L=sequence.length,forms=[[1,sequence],[-1,reverseComplement(sequence)]];
 if(circular&&L>1&&target.length>=L){const t=new Uint8Array(target.length+L-1);t.set(target);t.set(target.subarray(0,L-1),target.length);target=t;}
 for(const [strand,form] of forms){const m=Uint8Array.from(form,c=>MASK[c.charCodeAt(0)]);
  scan:for(let s=0;s+L<=target.length;s++){const miss=[],unsure=[];
   for(let k=0;k<L;k++){const t=MASK[target[s+k]];if(!t)continue scan;if(!(t&m[k]))miss.push(k);else if(t&~m[k])unsure.push(k);else continue;if(miss.length+unsure.length>maxMismatch)continue scan;}
   const atEnd=k=>strand>0?k>=L-end3Exact:k<end3Exact;if(end3Exact&&(miss.some(atEnd)||unsure.some(atEnd)))continue;
   hits.push({start:s,end:s+L,strand,mismatches:miss.length,unresolved:unsure.length,positions:miss});}}
 return hits.sort((a,b)=>a.mismatches+a.unresolved-b.mismatches-b.unresolved||a.unresolved-b.unresolved||a.start-b.start||b.strand-a.strand);
}
// Reference first; the consensus only when the reference has no site. Coordinates stay on the reference.
export function placePrimer(p,reference,consensus,options){
 const onRef=findSites(reference,p.sequence,options);
 if(onRef.length)return {...p,hits:onRef,site:{...onRef[0],source:'reference'},placed:'found'};
 if(consensus){const onCons=findSites(consensus,p.sequence,options);if(onCons.length)return {...p,hits:onCons,site:{...onCons[0],source:'consensus'},placed:'found'};}
 return {...p,hits:[],site:null,placed:'missing'};
}
export function chooseHit(p,index){const h=p.hits[index];return h?{...p,site:{...h,source:p.site?.source??'reference'}}:p;}
// Pattern of the primer along the reference direction.
export const siteForm=p=>p.site.strand>0?p.sequence:reverseComplement(p.sequence);
