// SPDX-License-Identifier: GPL-2.0-or-later
// Bases of a primer arrow that differ from the consensus: white, hatched in the primer colour, with the primer base
// written in when the cell is wide enough. The caller has just built the arrow path; the cells are clipped to it.
const FONT='"Cascadia Mono",Consolas,"Liberation Mono","Courier New",monospace';
export const CELL_MIN=3,LETTER_MIN=7;
export function diffCells(x,cells,top,hh,fill){
 if(!cells.length)return;x.save();x.clip();
 for(const {px,w,base} of cells){
  x.save();x.beginPath();x.rect(px,top,w,hh);x.clip();x.fillStyle='#fff';x.fillRect(px,top,w,hh);
  x.strokeStyle=fill;x.lineWidth=1;x.beginPath();for(let s=-hh;s<w;s+=3){x.moveTo(px+s,top+hh);x.lineTo(px+s+hh,top);}x.stroke();
  if(w>=LETTER_MIN&&base){x.font=`bold ${Math.min(11,Math.round(w*1.2))}px ${FONT}`;x.textAlign='center';x.textBaseline='middle';x.lineWidth=3;x.strokeStyle='#fff';x.lineJoin='round';x.strokeText(base,px+w/2,top+hh/2+.5);x.fillStyle='#1f2d3a';x.fillText(base,px+w/2,top+hh/2+.5);}
  x.restore();}
 x.restore();}
// Name text stays readable over hatched cells: an outline in the arrow colour.
export function label(x,text,px,py,ink,fill,outlined){if(outlined){x.lineWidth=3;x.strokeStyle=fill;x.lineJoin='round';x.strokeText(text,px,py);}x.fillStyle=ink;x.fillText(text,px,py);}
