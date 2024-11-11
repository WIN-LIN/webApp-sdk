const POPUP_WIDTH = 420;
const POPUP_HEIGHT = 540;

export function openPopup(url: URL): Window {
  console.log("openPopup");
  const left = (window.innerWidth - POPUP_WIDTH) / 2 + window.screenX;
  const top = (window.innerHeight - POPUP_HEIGHT) / 2 + window.screenY;

  const popup = window.open(
    url.toString(),
    "WebApp",
    `width=${POPUP_WIDTH}, height=${POPUP_HEIGHT}, left=${left}, top=${top}`
  );
  popup?.focus();
  if (!popup) {
    const userLang = navigator.language;
    const message = userLang.startsWith('zh') 
      ? "请前往浏览器设置，将「阻止弹出式弹窗」关闭以继续使用"
      : "Please go to the browsers setting page to allow pop-ups to continue";
    alert(message);
    throw new Error("WebApp window failed to open");
  }

  return popup;
}

export function closePopup(popup: Window | null) {
  console.log("closePopup");
  if (popup && !popup.closed) {
    popup.close();
  }
}
