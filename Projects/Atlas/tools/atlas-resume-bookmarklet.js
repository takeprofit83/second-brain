/**
 * Atlas Context Resume Bookmarklet
 *
 * Назначение:
 * Открывает защищённое окно Atlas Context Hub в режиме подхвата контекста (?action=resume).
 * Работает в ЛЮБОМ браузере и на ЛЮБОЙ странице (Claude, ChatGPT, DeepSeek, Gemini, Qwen).
 *
 * Безопасность:
 * - В коде букмарклета НЕТ API-ключей, паролей или токенов.
 * - Букмарклет не вмешивается в DOM сторонних сайтов и не подвержен изменениям верстки.
 * - Контекст копируется в буфер обмена по нажатию кнопки в окне Relay.
 */
(function () {
  const RELAY_BASE_URL = "http://195.19.12.38/atlas-relay-d42332f0300f625f.html";
  const url = RELAY_BASE_URL + "?action=resume&t=" + Date.now();
  const win = window.open(url, "atlas_resume", "width=460,height=520,menubar=no,toolbar=no,location=no,status=no,resizable=yes");
  
  if (!win) {
    alert("Atlas: Браузер заблокировал всплывающее окно. Пожалуйста, разрешите всплывающие окна для этой страницы и нажмите букмарклет снова.");
  } else {
    win.focus();
  }
})();
