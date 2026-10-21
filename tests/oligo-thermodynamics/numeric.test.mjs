// SPDX-License-Identifier: GPL-2.0-or-later
import fs from 'node:fs/promises';import assert from 'node:assert/strict';
import {duplex,magnesiumCorrection} from '../../tools/oligo-thermodynamics/duplex-nn.mjs';
const R=import.meta.dirname,refs=JSON.parse(await fs.readFile(R+'/mg-reference.json','utf8')),branches={},max={tm:0};
for(const r of refs){const d=duplex(r.seq,r.c);assert.equal(d.status,'tm-only',JSON.stringify({r,d}));assert.equal(d.self,r.self);assert(!['dg','dh','ds'].some(k=>k in d));const e=Math.abs(d.tm-r.tm);max.tm=Math.max(max.tm,e);assert(e<=1e-8,JSON.stringify({r,d,e}));branches[d.tmCorrection.branch]=(branches[d.tmCorrection.branch]||0)+1;}
const c={temperature:60,na:50,k:0,nh4:0,mg:3,dntp:.8,a:200,b:200},d=duplex('GCGCTTTAAGCGC',c),warm=duplex('GCGCTTTAAGCGC',{...c,temperature:100});assert.equal(d.tm,warm.tm);
const free=d.tmCorrection.freeMgM,K=3e4,D=.0008,M=.003;assert(Math.abs(free+K*free*D/(1+K*free)-M)<1e-14);
assert(magnesiumCorrection('ACGTACGT',50,3,3).freeMgM>0);assert(magnesiumCorrection('ACGTACGT',50,3,6).freeMgM>0);
assert(Object.keys(branches).length===3);
console.log(JSON.stringify({cases:refs.length,max,branches,defaultTm:d.tm}));
