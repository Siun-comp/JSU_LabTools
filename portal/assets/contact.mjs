const address = document.querySelector('#contact-address');
const copy = document.querySelector('#contact-copy');
const status = document.querySelector('#contact-copy-status');
const hint = document.querySelector('#contact-tool-hint');

copy.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(address.textContent.trim());
    status.textContent = '주소를 복사했습니다.';
  } catch {
    status.textContent = '복사하지 못했습니다. 주소를 직접 선택해 복사해 주세요.';
  }
});

// A tool's information page links here as contact.html#<tool>. Name that tool for the form's tool list.
function showLinkedTool() {
  const id = location.hash.slice(1);
  const term = id ? document.getElementById(id) : null;
  if (term?.tagName !== 'DT') { hint.hidden = true; return; }
  hint.textContent = `양식의 "관련 도구"에서 "${term.textContent}" 항목을 골라 주세요. 현재 버전은 ${term.nextElementSibling.textContent}입니다.`;
  hint.hidden = false;
}
addEventListener('hashchange', showLinkedTool);
showLinkedTool();
