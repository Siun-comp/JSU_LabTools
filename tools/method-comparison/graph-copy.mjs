function png(svg,title,scope,legend){
  return (async()=>{
    const clone=svg.cloneNode(true),vb=svg.viewBox.baseVal,width=vb.width,height=vb.height;
    clone.setAttribute('xmlns','http://www.w3.org/2000/svg');clone.setAttribute('width',width);clone.setAttribute('height',height);clone.removeAttribute('style');
    const style=document.createElementNS('http://www.w3.org/2000/svg','style');style.textContent="text{font:12px 'Malgun Gothic',sans-serif;fill:#3b526d}svg{background:#fafcfe}";clone.prepend(style);
    const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)],{type:'image/svg+xml'}));
    try{
      const img=new Image();img.src=url;await img.decode();
      const canvas=document.createElement('canvas'),pad=20,header=60,scale=Math.min(2,16000/(width+pad*2));
      const ctx=canvas.getContext('2d');if(!ctx)throw Error('이미지를 만들 수 없습니다.');ctx.font="11px 'Malgun Gothic',sans-serif";
      const wrap=text=>{const lines=[];let line='';for(const char of text){if(line&&ctx.measureText(line+char).width>width){lines.push(line);line='';}line+=char;}if(line)lines.push(line);return lines;};
      const contextLines=wrap(scope),legendLines=wrap(legend),footer=Math.max(44,(contextLines.length+legendLines.length)*14+20);
      canvas.width=(width+pad*2)*scale;canvas.height=(height+header+footer)*scale;
      ctx.scale(scale,scale);ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width/scale,canvas.height/scale);
      ctx.fillStyle='#24384c';ctx.font="bold 17px 'Malgun Gothic',sans-serif";ctx.fillText(title,pad,28);
      ctx.drawImage(img,pad,header,width,height);ctx.font="11px 'Malgun Gothic',sans-serif";ctx.fillStyle='#526981';
      // Size the footer from the actual text, including unit/lambda provenance.
      [...contextLines,...legendLines].forEach((line,i)=>ctx.fillText(line,pad,height+header+19+i*14));
      return await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('PNG 변환 실패')),'image/png'));
    }finally{URL.revokeObjectURL(url);}
  })();
}
export function installGraphCopy(root,getScope){
  root.querySelectorAll('svg').forEach(svg=>{
    const host=svg.closest('.chart-scroll')||svg,title=svg.getAttribute('aria-label')||'분석 그래프';
    const controls=document.createElement('div');controls.setAttribute('data-no-copy','');controls.className='graph-actions';const button=document.createElement('button'),status=document.createElement('span');
    button.type='button';button.textContent='그래프 복사';button.setAttribute('aria-label',title+' 그래프 복사');status.setAttribute('role','status');const expand=document.createElement('button');expand.type='button';expand.textContent='크게 보기';expand.dataset.graphExpand='';expand.setAttribute('aria-label',title+' 크게 보기');controls.append(expand,button,status);host.before(controls);
    button.onclick=async()=>{
      if(!navigator.clipboard?.write||!globalThis.ClipboardItem){status.textContent='이미지 클립보드 복사를 지원하는 브라우저에서 사용하세요.';return;}
      button.disabled=true;status.textContent='복사 중…';
      const legend=svg.dataset.legend||(title.includes('산점도')?'실선: 전체 OLS · 점선: PI · 주황 점: PI 이탈 검체':'');
      try{
        // Submit the promised PNG during the click's user activation.
        await navigator.clipboard.write([new ClipboardItem({'image/png':png(svg,title,[getScope().replace(/ · CI .*$/,''),svg.dataset.context].filter(Boolean).join(' / '),legend)})]);
        if(svg.isConnected)status.textContent='그래프를 이미지로 복사했습니다.';
      }catch{if(svg.isConnected)status.textContent='이미지 복사에 실패했습니다. 클립보드 권한을 확인하고 다시 시도하세요.';}
      finally{button.disabled=false;}
    };
  });
}
