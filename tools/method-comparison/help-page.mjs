import {TOPICS,topicHTML,escapeHTML} from './help-content.mjs';
document.getElementById('help-toc').innerHTML=Object.entries(TOPICS).map(([key,t])=>`<a href="#${key}">${escapeHTML(t.title)}</a>`).join('');
document.getElementById('help-chapters').innerHTML=Object.entries(TOPICS).map(([key,t])=>`<section id="${key}" tabindex="-1"><h2>${escapeHTML(t.title)}</h2>${topicHTML(key)}</section>`).join('');
function locate(){const target=document.getElementById(location.hash.slice(1));if(target){target.scrollIntoView();target.focus({preventScroll:true});}}
window.addEventListener('hashchange',locate);locate();
