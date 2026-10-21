// SPDX-License-Identifier: GPL-2.0-or-later
export async function createHairpin(bytes){
 let instance;
 const unavailable=()=>8; // WASI EBADF: no files/preopens are provided.
 const wasi={fd_close:unavailable,fd_fdstat_get:unavailable,fd_prestat_get:unavailable,fd_prestat_dir_name:unavailable,fd_seek:unavailable,
  fd_write:()=>{throw new Error('엔진의 예상하지 않은 출력 요청');},proc_exit:n=>{throw new Error('엔진 종료 '+n);}};
 instance=(await WebAssembly.instantiate(bytes,{wasi_snapshot_preview1:wasi})).instance;
 const e=instance.exports;e._initialize();
 const stringAt=p=>{const b=new Uint8Array(e.memory.buffer);let n=p;while(n<b.length&&b[n])n++;return new TextDecoder().decode(b.subarray(p,n));};
 const run=(seq,c,show=true)=>{
  if(!/^[ACGT]{2,60}$/.test(seq))throw new Error('Hairpin 길이/염기 미지원');
  const p=e.input_ptr();new Uint8Array(e.memory.buffer,p,seq.length+1).set(new TextEncoder().encode(seq+'\0'));
  const status=e.hp(c.temperature,c.na+c.k+c.nh4,c.mg,c.dntp,c.a,show?1:0);
  if(status<0)throw new Error(stringAt(e.message_ptr())||'Hairpin 엔진 오류 '+status);
  if(status===0)return {status:'no-structure',rawNoStructure:1,structure:stringAt(e.structure_ptr())};
  const v=new Float64Array(e.memory.buffer,e.output_ptr(),5);
  return {status:'ok',tm:v[0],dg:v[1],dh:v[2],ds:v[3],rawNoStructure:v[4],structure:show?stringAt(e.structure_ptr()):'',model:'primer3-py 2.3.1 THAL'};
 };
 Object.defineProperty(run,'memoryBytes',{get:()=>e.memory.buffer.byteLength});
 return run;
}
