import {escapeHTML as esc} from './help-content.mjs';
export function plotLegend(items){
 const height=350+Math.ceil(items.length/2)*22+8;
 const markup=items.map((s,i)=>{const x=90+(i%2)*230,y=345+Math.floor(i/2)*22;return `<g data-series-legend="${esc(s.name)}">${s.dot?`<circle cx="${x}" cy="${y}" r="${s.hollow?4.5:3.5}" fill="${s.hollow?'white':s.color}" ${s.hollow?`stroke="${s.color}" stroke-width="2"`:''}/>`:`<line x1="${x-10}" x2="${x+10}" y1="${y}" y2="${y}" stroke="${s.color}" stroke-width="2" ${s.dash?'stroke-dasharray="5 4"':''}/>`}<text x="${x+16}" y="${y+4}">${esc(s.name)}</text></g>`;}).join('');
 return {height,markup,description:items.map(s=>`${s.dot?s.hollow?'빈 원':'점':s.dash?'점선':'실선'}: ${s.name}`).join(' / ')};
}
