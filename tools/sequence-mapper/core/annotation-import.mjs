// SPDX-License-Identifier: GPL-2.0-or-later
// Annotation files for the reference: GFF3, or a CSV/TSV table with Name, Type, Start, End, Strand (Product optional).
// Positions are 1-based and inclusive on the reference. Only CDS, gene and mRNA are taken; other types are skipped and
// counted. Any error stops the whole file, with its line number, so nothing is fixed or dropped quietly (AP-275).
import {ANNOTATION_TYPES} from './features.mjs';
const TYPE=new Map(ANNOTATION_TYPES.map(t=>[t.toLowerCase(),t]));
const decode=s=>s.replace(/%([0-9A-Fa-f]{2})/g,(_,h)=>String.fromCharCode(parseInt(h,16)));
const accession=s=>String(s??'').split(/\s+/,1)[0];
const sameId=(a,b)=>a===b||a.split('.')[0]===b.split('.')[0];
const STRAND={'+':1,'-':-1,'−':-1,'.':0,'?':0};
const MAX_ERRORS=10;

export function readAnnotationFile(text,{referenceLength,referenceId,source}){
 const lines=String(text).replace(/^﻿/,'').split(/\r?\n/);
 const gff=/^##gff-version\s+3/.test(lines[0]??'')||lines.some(l=>l&&!l.startsWith('#')&&l.split('\t').length===9&&/^\d+$/.test(l.split('\t')[3]));
 const r=gff?readGff(lines,referenceLength,accession(referenceId)):readTable(lines,referenceLength);
 r.format=gff?'GFF3':'표';
 // Errors read in line order, whichever check found them.
 const lineOf=e=>{const m=/^(\d+)번째 줄/.exec(e);return m?Number(m[1]):Infinity;};r.errors.sort((a,b)=>lineOf(a)-lineOf(b));
 if(r.errors.length>MAX_ERRORS)r.errors=[...r.errors.slice(0,MAX_ERRORS),`그 밖의 오류 ${r.errors.length-MAX_ERRORS}건`];
 r.list=r.errors.length?[]:r.list.map((f,k)=>({...f,id:`i${source?.id??0}_${k}`,source:source?.name??'파일'}));
 return r;
}
function checkRange(n,start,end,L,errors){
 if(!Number.isInteger(start)||!Number.isInteger(end)){errors.push(`${n}번째 줄: 위치가 정수가 아닙니다.`);return false;}
 if(start<1||end<start||end>L){errors.push(`${n}번째 줄: 위치 ${start}–${end}가 Reference(1–${L}) 범위를 벗어나거나 시작이 끝보다 큽니다.`);return false;}
 return true;
}
function readGff(lines,L,refId){
 const errors=[],notes=[],rows=[];let skipped=0;
 for(let k=0;k<lines.length;k++){const n=k+1,line=lines[k];
  if(line.startsWith('##FASTA'))break;if(!line.trim()||line.startsWith('#'))continue;
  const c=line.split('\t');if(c.length!==9){errors.push(`${n}번째 줄: 탭으로 나뉜 9개 열이 아닙니다.`);continue;}
  const type=TYPE.get(c[2].trim().toLowerCase());if(!type){skipped++;continue;}
  const attrs={};for(const part of c[8].split(';')){const i=part.indexOf('=');if(i>0)attrs[part.slice(0,i).trim()]=decode(part.slice(i+1).trim());}
  const strand=STRAND[c[6].trim()];if(strand===undefined){errors.push(`${n}번째 줄: 방향은 +, -, . 중 하나여야 합니다.`);continue;}
  rows.push({n,seqid:decode(c[0].trim()),type,start:Number(c[3]),end:Number(c[4]),strand,attrs});}
 // One seqid in the file is taken as this reference (with a note if the name differs); several keep only the matching one.
 const ids=[...new Set(rows.map(r=>r.seqid))];let use=rows;
 if(ids.length>1){use=rows.filter(r=>sameId(r.seqid,refId));if(!use.length)errors.push(`파일의 seqid(${ids.slice(0,5).join(', ')})에 Reference 이름 ${refId}와 같은 것이 없습니다.`);else notes.push(`seqid가 ${ids.length}가지라 Reference 이름 ${refId}와 같은 줄만 넣었습니다.`);}
 else if(ids.length===1&&!sameId(ids[0],refId))notes.push(`파일의 seqid ${ids[0]}가 Reference 이름 ${refId}와 다릅니다. seqid가 한 가지뿐이라 이 Reference 위치로 넣었습니다.`);
 // Rows sharing an ID are pieces of one annotation (CDS exons).
 const groups=new Map();
 for(const r of use){if(!checkRange(r.n,r.start,r.end,L,errors))continue;const key=r.attrs.ID?'id:'+r.attrs.ID:'line:'+r.n,g=groups.get(key);
  if(g){if(g.type!==r.type||g.strand!==r.strand){errors.push(`${r.n}번째 줄: 같은 ID(${r.attrs.ID})의 종류나 방향이 앞 줄과 다릅니다.`);continue;}g.ranges.push({start:r.start-1,end:r.end});}
  else groups.set(key,{type:r.type,strand:r.strand,ranges:[{start:r.start-1,end:r.end}],label:r.attrs.Name||r.attrs.gene||r.attrs.ID||r.type,gene:r.attrs.gene??'',product:r.attrs.product??''});}
 const list=[...groups.values()].map(g=>({...g,ranges:g.ranges.sort((a,b)=>a.start-b.start)}));
 if(!errors.length&&!list.length)errors.push('CDS·gene·mRNA annotation이 없습니다.');
 return {list,errors,notes,skipped};
}
function cells(line,sep){const out=[];let cur='',q=false;for(let i=0;i<line.length;i++){const c=line[i];if(q){if(c==='"'){if(line[i+1]==='"'){cur+='"';i++;}else q=false;}else cur+=c;}else if(c==='"')q=true;else if(c===sep){out.push(cur.trim());cur='';}else cur+=c;}out.push(cur.trim());return out;}
function readTable(lines,L){
 const errors=[],notes=[],list=[];let skipped=0;
 const rows=lines.map((l,k)=>({l,n:k+1})).filter(x=>x.l.trim());if(!rows.length)return {list,errors:['내용이 없습니다.'],notes,skipped};
 const sep=rows[0].l.includes('\t')?'\t':',',head=cells(rows[0].l,sep).map(h=>h.toLowerCase()),col=k=>head.indexOf(k);
 const need=['name','type','start','end','strand'];if(need.some(k=>col(k)<0))return {list,errors:['첫 줄(머리글)에 Name, Type, Start, End, Strand 열이 필요합니다. Product는 선택입니다.'],notes,skipped};
 for(const {l,n} of rows.slice(1)){const c=cells(l,sep),get=k=>col(k)<0?'':c[col(k)]??'';
  const type=TYPE.get(get('type').toLowerCase());if(!type){skipped++;continue;}
  const start=Number(get('start')),end=Number(get('end')),strand=STRAND[get('strand')];
  if(strand===undefined||strand===0){errors.push(`${n}번째 줄: Strand는 + 또는 -여야 합니다.`);continue;}
  if(!checkRange(n,start,end,L,errors))continue;
  const name=get('name');if(!name){errors.push(`${n}번째 줄: Name이 비어 있습니다.`);continue;}
  list.push({type,strand,ranges:[{start:start-1,end}],label:name,gene:'',product:get('product')});}
 if(!errors.length&&!list.length)errors.push('CDS·gene·mRNA annotation이 없습니다.');
 return {list,errors,notes,skipped};
}
