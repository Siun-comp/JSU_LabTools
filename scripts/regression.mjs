import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const tests=['oligo-mix/core','oligo-mix/plasmid','oligo-mix/copies','oligo-mix/clipboard','oligo-mix/workflow','oligo-mix/profiles-reverse','sequence/core','sequence/ui-contract','nucleic-acid/core','nucleic-acid/thermo','nucleic-acid/vector-copy','nucleic-acid/ui-contract','detection-capability/contracts','detection-capability/output'];
for(const test of tests){const result=spawnSync(process.execPath,['tests/'+test+'.test.mjs'],{cwd:root,stdio:'inherit'});if(result.error)throw result.error;if(result.status!==0)process.exit(result.status??1);}
console.log('PASS: Oligo/Sequence/Nucleic/LoBDQ synthetic regression14 modules. No browser dependency or user data.');
