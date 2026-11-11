// SPDX-License-Identifier: GPL-2.0-or-later
// A plain ZIP (stored, no compression) built from parts already in memory, for handing several files to another
// program as one download. Each entry needs its size and CRC-32 before its header is written, so a streamed entry
// is collected first (crc32 can be fed chunk by chunk). No ZIP64: entries and the archive stay under 4 GiB.
const TABLE=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;TABLE[n]=c>>>0;}
export const ZIP_LIMIT=0xFFFFFFFF;
// Start with crc32Start(), feed every chunk through crc32Update, finish with crc32End.
export const crc32Start=()=>0xFFFFFFFF;
export function crc32Update(crc,bytes){for(let i=0;i<bytes.length;i++)crc=TABLE[(crc^bytes[i])&255]^(crc>>>8);return crc>>>0;}
export const crc32End=crc=>(crc^0xFFFFFFFF)>>>0;
export const crc32=bytes=>crc32End(crc32Update(crc32Start(),bytes));
function dosTime(d){return {time:(d.getHours()<<11)|(d.getMinutes()<<5)|(d.getSeconds()>>1),date:((Math.max(1980,d.getFullYear())-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate()};}
// entries: [{name, parts: Uint8Array[], size, crc}]. Returns the archive as a list of Uint8Array parts (for a Blob or a stream).
export function zipParts(entries,date=new Date()){
 const enc=new TextEncoder(),{time,date:day}=dosTime(date),out=[],central=[];let offset=0;
 for(const e of entries){
  if(e.size>ZIP_LIMIT||offset>ZIP_LIMIT)throw Error('ZIP 파일이 4 GB를 넘습니다.');
  const name=enc.encode(e.name),h=new Uint8Array(30+name.length),v=new DataView(h.buffer);
  // Bit 11: the name is UTF-8.
  v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x0800,true);v.setUint16(8,0,true);v.setUint16(10,time,true);v.setUint16(12,day,true);
  v.setUint32(14,e.crc,true);v.setUint32(18,e.size,true);v.setUint32(22,e.size,true);v.setUint16(26,name.length,true);v.setUint16(28,0,true);h.set(name,30);
  const c=new Uint8Array(46+name.length),w=new DataView(c.buffer);
  w.setUint32(0,0x02014b50,true);w.setUint16(4,20,true);w.setUint16(6,20,true);w.setUint16(8,0x0800,true);w.setUint16(10,0,true);w.setUint16(12,time,true);w.setUint16(14,day,true);
  w.setUint32(16,e.crc,true);w.setUint32(20,e.size,true);w.setUint32(24,e.size,true);w.setUint16(28,name.length,true);w.setUint32(42,offset,true);c.set(name,46);
  out.push(h,...e.parts);central.push(c);offset+=h.length+e.size;}
 const size=central.reduce((s,c)=>s+c.length,0);if(offset+size>ZIP_LIMIT)throw Error('ZIP 파일이 4 GB를 넘습니다.');
 const end=new Uint8Array(22),z=new DataView(end.buffer);
 z.setUint32(0,0x06054b50,true);z.setUint16(8,entries.length,true);z.setUint16(10,entries.length,true);z.setUint32(12,size,true);z.setUint32(16,offset,true);
 return [...out,...central,end];
}
