import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
export function assertPreserved(previous,current){
 const targets=new Set(current.files.map(f=>f.target));
 const missing=previous.files.filter(f=>!targets.has(f.target)).map(f=>f.target);
 assert.equal(missing.length,0,'Prior public targets missing: '+missing.join(', '));
}
if(process.argv.includes('--self-test')){
 const before={files:[{target:'index.html'},{target:'tools/example/index.html'}]};
 assertPreserved(before,{files:[...before.files,{target:'tools/new/index.html'}]});
 assert.throws(()=>assertPreserved(before,{files:[{target:'index.html'}]}));
 console.log('PASS: clean-checkout manifest comparison permits additions and rejects omissions.');
}else{
 const event=process.env.JSU_EVENT_NAME;
 const baseline=event==='push'?process.env.JSU_BEFORE_SHA:process.env.JSU_PUBLISHED_BASELINE_SHA;
 assert(['push','workflow_dispatch'].includes(event),'Explicit push or manual baseline required.');
 assert(/^[0-9a-f]{40}$/i.test(baseline||''),'Baseline must be a full commit SHA.');
 if(event==='push'&&/^0{40}$/.test(baseline)){console.log('First remote branch creation: no prior remote public list. Actual Pages history still requires first-release review.');process.exit(0);}
 assert(!/^0{40}$/.test(baseline),'Manual baseline must refer to previously published commit.');
 try{execFileSync('git',['cat-file','-e',baseline+'^{commit}'],{stdio:'pipe'});}
 catch{execFileSync('git',['fetch','origin',baseline,'--depth=1'],{stdio:'pipe'});}
 const previous=JSON.parse(execFileSync('git',['show',baseline+':public-manifest.json'],{encoding:'utf8'}));
 assertPreserved(previous,JSON.parse(await readFile('public-manifest.json','utf8')));
 console.log('Prior remote/published-baseline public targets preserved.');
}
