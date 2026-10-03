/* Versioned draft storage, not an analysis-result trust boundary. */
'use strict';
(function(root){
 const keys=['lod','confirmation','lob','loq'],MAX=20000000;
 const object=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
 const exact=(x,fields)=>object(x)&&Object.keys(x).length===fields.length&&fields.every(k=>Object.hasOwn(x,k));
 const str=x=>typeof x==='string'&&x.length<=1000000;
 function safe(x,depth=0){if(depth>64)return false;if(x===null||typeof x==='boolean'||typeof x==='string')return typeof x!=='string'||str(x);if(typeof x==='number')return Number.isFinite(x);if(Array.isArray(x))return x.length<=100000&&x.every(v=>safe(v,depth+1));return object(x)&&Object.keys(x).length<=100000&&Object.entries(x).every(([k,v])=>!['__proto__','constructor','prototype'].includes(k)&&safe(v,depth+1));}
 function raw(d,k){return exact(d,['key','unit','setting','group','reference','dataKind','rows','blank','samples'])&&d.key===k&&['unit','setting','group','reference','blank'].every(f=>str(d[f]))&&['','실제','합성'].includes(d.dataKind)&&Array.isArray(d.rows)&&d.rows.length<=1000&&d.rows.every(r=>Array.isArray(r)&&r.length===3&&r.every(str))&&Array.isArray(d.samples)&&d.samples.length<=8&&d.samples.every(s=>exact(s,['name','reference','source','measurements'])&&Object.values(s).every(str))&&(['lod','confirmation'].includes(k)?d.blank===''&&d.samples.length===0:k==='lob'?d.rows.length===0&&d.samples.length===0:d.rows.length===0&&d.blank==='');}
 function validModules(m){return exact(m,keys)&&keys.every(k=>{const d=m[k];return exact(d,['raw','revision','source','history'])&&raw(d.raw,k)&&Number.isSafeInteger(d.revision)&&d.revision>=0&&d.revision<Number.MAX_SAFE_INTEGER-1&&(d.source===null||object(d.source))&&Array.isArray(d.history)&&safe(d.source)&&safe(d.history);});}
 function valid(x){return exact(x,['format','version','savedAt','activeModule','modules','archivedResults'])&&x.format==='mdc-minimal-project'&&x.version===1&&typeof x.savedAt==='string'&&Number.isFinite(Date.parse(x.savedAt))&&keys.includes(x.activeModule)&&validModules(x.modules)&&exact(x.archivedResults,keys)&&safe(x.archivedResults);}
 function parse(text){if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX)throw Error('작업 파일은 최대 20 MB입니다.');let x;try{x=JSON.parse(text);}catch{throw Error('JSON 파일을 읽을 수 없습니다.');}if(!valid(x))throw Error('지원하지 않는 버전 또는 잘못된 작업 파일 구조입니다. 자동 변환하지 않습니다.');return x;}
 const api={keys,MAX,validModules,valid,parse};if(typeof module==='object'&&module.exports)module.exports=api;else root.ProjectFileContract=api;
})(globalThis);
