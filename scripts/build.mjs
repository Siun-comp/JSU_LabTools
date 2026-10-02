import {lstat,readdir,mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,relative,dirname,sep,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const dist=resolve(root,'dist');
const manifest=JSON.parse(await readFile(resolve(root,'public-manifest.json'),'utf8'));
function inside(base,path){const rel=relative(base,path);if(!rel||isAbsolute(rel)||rel.startsWith('..'+sep)||rel==='..'||resolve(base,rel)!==path)throw Error('Path outside intended directory: '+path);}
async function list(base){let entries;try{entries=await readdir(base,{withFileTypes:true});}catch(e){if(e.code==='ENOENT')return [];throw e;}const files=[];for(const entry of entries){const path=resolve(base,entry.name);if(entry.isSymbolicLink())throw Error('Symlink rejected: '+path);if(entry.isDirectory())files.push(...await list(path));else files.push(path);}return files;}
const targets=new Set();
const prepared=[];
for(const entry of manifest.files){const source=resolve(root,entry.source),target=resolve(dist,entry.target);inside(root,source);inside(dist,target);if(targets.has(target))throw Error('Duplicate target');targets.add(target);if(!(await lstat(source)).isFile())throw Error('Not a regular source');if((await lstat(source)).isSymbolicLink())throw Error('Symlink source');prepared.push({target,bytes:await readFile(source)});}
try{if((await lstat(dist)).isSymbolicLink())throw Error('Symlink dist');}catch(e){if(e.code!=='ENOENT')throw e;}
const existing=await list(dist);
const missing=existing.filter(path=>!targets.has(path));
if(missing.length)throw Error('Build stopped: existing published files are absent from the complete manifest. Preserve or explicitly review them: '+missing.map(p=>relative(dist,p)).join(', '));
/* Validate every source and previous target before writing. No recursive removal. */
for(const {target,bytes} of prepared){await mkdir(dirname(target),{recursive:true});await writeFile(target,bytes);}
console.log('Prepared full public artifact v'+manifest.version+' ('+prepared.length+' files). No deployment.');

