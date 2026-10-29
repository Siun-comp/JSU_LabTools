// SPDX-License-Identifier: GPL-2.0-or-later
export async function writeClipboard(text,html,{clipboard=globalThis.navigator?.clipboard,Item=globalThis.ClipboardItem}={}){
 if(!clipboard)throw new Error('클립보드를 사용할 수 없습니다.');
 if(html&&Item&&typeof clipboard.write==='function'){
  try{
   await clipboard.write([new Item({'text/plain':new Blob([text],{type:'text/plain'}),'text/html':new Blob([html],{type:'text/html'})})]);
   return 'formatted';
  }catch{/* Fall back only to the same text; never report a failed write as success. */}
 }
 if(typeof clipboard.writeText!=='function')throw new Error('일반 텍스트 복사를 사용할 수 없습니다.');
 await clipboard.writeText(text);return 'plain';
}
