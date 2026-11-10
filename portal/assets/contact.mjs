const category = document.querySelector('#contact-category');
const tool = document.querySelector('#contact-tool');
const message = document.querySelector('#contact-message');
const draft = document.querySelector('#contact-draft');
const recipient = document.querySelector('#contact-address').getAttribute('href');
const portalVersion = document.querySelector('#contact-portal-version').textContent;

function updateDraft() {
  const context = tool.selectedOptions[0].textContent;
  const subject = `[JSU LabTools] ${category.value} - ${context}`;
  const body = [
    `문의 유형: ${category.value}`,
    `관련 도구: ${context}`,
    portalVersion,
    '',
    '문의 내용',
    message.value.trim().replace(/\r\n?|\n/g, '\r\n'),
  ].join('\r\n');

  draft.href = `${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.toWellFormed())}`;
}

function selectToolFromLink() {
  const linkedTool = location.hash.slice(1);
  tool.value = Array.from(tool.options).some(option => option.value === linkedTool) ? linkedTool : '';
  updateDraft();
}

category.addEventListener('change', updateDraft);
tool.addEventListener('change', updateDraft);
message.addEventListener('input', updateDraft);
draft.addEventListener('click', updateDraft);
selectToolFromLink();
