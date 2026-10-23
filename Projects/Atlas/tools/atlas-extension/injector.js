(function(textToInject) {
  try {
    const input = document.querySelector('#prompt-textarea')
      || document.querySelector('.ProseMirror')
      || document.querySelector('rich-textarea [contenteditable="true"]')
      || document.querySelector('div.ql-editor')
      || document.querySelector('textarea#chat-input')
      || document.querySelector('div[contenteditable="true"]')
      || document.querySelector('textarea');

    if (!input) {
      return { success: false, message: 'Не найдено поле ввода на странице' };
    }

    input.focus();

    // Native browser command triggers React/ProseMirror change detection
    let inserted = false;
    try {
      inserted = document.execCommand('insertText', false, textToInject);
    } catch(e) {}

    if (!inserted) {
      if (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT') {
        input.value = textToInject;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        input.innerText = textToInject;
        input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: textToInject }));
      }
    }

    return { success: true };
  } catch(err) {
    return { success: false, message: err.message };
  }
})(promptToInject);
