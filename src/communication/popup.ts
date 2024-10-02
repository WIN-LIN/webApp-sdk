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
