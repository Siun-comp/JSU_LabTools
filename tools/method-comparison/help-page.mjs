import {TOPICS,topicHTML,escapeHTML,chapterList} from './help-content.mjs';
const chapters=chapterList();
document.getElementById('help-toc').innerHTML=chapters.map(([title,keys],i)=>`<p><strong>${i+1}. ${escapeHTML(title)}</strong> ${keys.map(key=>`<a href="#${key}">${escapeHTML(TOPICS[key].title)}</a>`).join('')}</p>`).join('');
document.getElementById('help-chapters').innerHTML=chapters.map(([title,keys],i)=>`<div class="help-chapter"><h2>${i+1}. ${escapeHTML(title)}</h2>${keys.map(key=>`<section id="${key}" tabindex="-1"><h3>${escapeHTML(TOPICS[key].title)}</h3>${topicHTML(key)}</section>`).join('')}</div>`).join('');
function locate(){const target=document.getElementById(location.hash.slice(1));if(target){target.scrollIntoView();target.focus({preventScroll:true});}}
window.addEventListener('hashchange',locate);locate();
