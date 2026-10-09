import {formatNumber,formatPercent} from './format.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function barChart(data,names,title,percent=true){
  if(!data.length)return '<p class="hint">분석할 구간이 없습니다.</p>';
  const dateRanges=data.some(g=>g.label.includes(' 이상 ~ '));
  const width=Math.max(600,data.length*(dateRanges?195:145)+70),left=65,right=width-20,base=275,top=50,step=(right-left)/data.length;
  const values=data.flatMap(g=>g.values).map(s=>s.value).filter(Number.isFinite),lo=percent?0:Math.min(0,...values),hi=percent?1:Math.max(1,...values)*1.12;
  const y=v=>base-(v-lo)/(hi-lo)*(base-top),colors=['#20668A','#ED7333'];
  let svg=`<svg class="bar-chart" style="min-width:${width}px" viewBox="0 0 ${width} 375" role="img" aria-label="${esc(title)}"><title>${esc(title)}</title>`;
  for(let i=0;i<=4;i++){const v=lo+(hi-lo)*i/4;svg+=`<path d="M${left} ${y(v)} H${right}" stroke="#dae3ee"/><text x="${left-8}" y="${y(v)+4}" text-anchor="end">${percent?Math.round(v*100)+'%':formatNumber(v)}</text>`;}
  for(const [i,g] of data.entries()){
    const center=left+step*(i+.5),w=Math.min(44,step/(names.length+2));
    for(const [j,s] of g.values.entries()){
      const c=center+(j-(names.length-1)/2)*Math.max(w+7,names.length>1?68:0),v=s.value;
      svg+=`<g data-group="${esc(g.label)}" data-series="${esc(names[j])}" data-value="${v===null?'none':v}"><title>${esc(g.label)} ${esc(names[j])}: ${v===null?'대상 없음':percent?formatPercent(v):formatNumber(v)}</title>`;
      if(v!==null&&Number.isFinite(v)){
        const at=y(v),zero=y(0);svg+=`<rect x="${c-w/2}" y="${Math.min(at,zero)}" width="${w}" height="${Math.abs(zero-at)}" fill="${colors[j]}"/>`;
        if(v===0)svg+=`<path d="M${c-w/2} ${zero} H${c+w/2}" stroke="${colors[j]}" stroke-width="3"/>`;
        svg+=`<text x="${c}" y="${Math.max(22,at-18)}" text-anchor="middle">${percent?formatPercent(v):formatNumber(v)}</text><text x="${c}" y="${Math.max(38,at-3)}" text-anchor="middle">${percent?`(${s.k}/${s.n})`:`n=${s.n}`}</text>`;
      }else svg+=`<text x="${c}" y="${base-12}" text-anchor="middle">없음</text>`;
      const chunks=g.label.includes(' 이상 ~ ')?g.label.split(' ~ ').map((part,k)=>part+(k===0?' ~':'')):g.label.match(/.{1,17}/gu)||[''];if(j===0)chunks.forEach((part,k)=>svg+=`<text x="${center}" y="${300+k*16}" text-anchor="middle">${esc(part)}</text>`);
      svg+='</g>';
    }
  }
  names.forEach((name,i)=>{const x=width/2+(i-(names.length-1)/2)*135;svg+=`<rect x="${x-45}" y="350" width="10" height="10" fill="${colors[i]}"/><text x="${x-30}" y="360">${esc(name)}</text>`;});
  return `<div class="chart-scroll">${svg}</svg></div>`;
}
export const detectionBars=gs=>gs.map(g=>({label:g.label,values:[{value:g.summary.detection.p,k:g.summary.detection.k,n:g.summary.detection.n}]}));
export const agreementBars=gs=>gs.map(g=>({label:g.label,values:[g.summary.ppa,g.summary.npa].map(p=>({value:p.p,k:p.k,n:p.n}))}));
export const medianBars=gs=>gs.map(g=>({label:g.label,values:[g.reference,g.product].map(d=>({value:d.median,n:d.n}))}));
