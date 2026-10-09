import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
import * as c from '../../tools/oligo-analysis/core.mjs';
const f=JSON.parse(await readFile(new URL('./web-fixtures.json',import.meta.url),'utf8'));
assert.equal(createHash('sha256').update(await readFile(new URL('../../tools/oligo-analysis/dimer.mjs',import.meta.url))).digest('hex'),'f3443712abf7116a3c3919d68392ac72f8d148eb935e3f7737066afe0be2460e');
for(const x of f.idt)assert.deepEqual(c.idtDimer(x.a,x.b).map(s=>JSON.stringify([Number(c.formatDG(s.deltaGMicros)),s.basePairs,s.topIndent,s.bottomIndent,s.diagram[1]])).sort(),x.rows.map(JSON.stringify).sort(),x.id);
for(const x of f.thermo)assert.deepEqual(c.thermoDimer(x.a,x.b).map(s=>[s.topIndent,s.bottomIndent,s.thermoDiagram[1]]),x.rows,x.a+' / '+x.b);
console.log('PASS: unchanged dimer engine; existing IDT16/176 and Thermo91/44 fixtures. No new vendor web observations.');
