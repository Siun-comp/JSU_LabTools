// SPDX-License-Identifier: GPL-2.0-or-later
import fs from 'node:fs/promises';import assert from 'node:assert/strict';
import {duplex} from '../../tools/oligo-thermodynamics/duplex-nn.mjs';
import {createHairpin} from '../../tools/oligo-thermodynamics/engine-loader.mjs';
const R=import.meta.dirname,P=R,refs=JSON.parse(await fs.readFile(P+'/reference.json','utf8')),hp=await createHairpin(await fs.readFile(R+'/../../tools/oligo-thermodynamics/engine/hairpin.wasm'));
const fields=['tm','dg','dh','ds'],max={duplex:0,nativeWasm:0};
for(const r of refs){const d=duplex(r.seq,r.c);assert.equal(d.status,'ok');for(const k of fields){const e=Math.abs(d[k]-r.duplex[k]);max.duplex=Math.max(max.duplex,e);assert(e<=1e-8);}for(let show=0;show<2;show++){const n=r.hairpin[show],w=hp(r.seq,r.c,Boolean(show));assert.equal(w.status,n.status===1?'ok':'no-structure');if(n.status===1){for(const [i,k] of fields.entries()){const e=Math.abs(w[k]-n.values[i]);max.nativeWasm=Math.max(max.nativeWasm,e);assert(e<=1e-6);}if(show)assert.equal(w.structure.replaceAll('\r',''),n.structure.replaceAll('\r',''));}}}
console.log(JSON.stringify({cases:refs.length,hairpinRuns:refs.length*2,max}));
