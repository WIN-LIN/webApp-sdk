import { closePopup, openPopup } from "./popup";
import { UUID } from "crypto";

export interface Message {
  id?: UUID;
  requestId?: UUID;
  method?: string;
  params?: unknown[] | object;
  data?: unknown;
  event?: string;
}

export interface ConfigMessage extends Message {
  event: "PopupLoaded" | "PopupUnload";
}

export class Communicator {
  private readonly url: URL;
  private popup: Window | null = null;
  private listeners = new Map<
    (_: MessageEvent) => void,
    { reject: (_: Error) => void }
  >();

  constructor(url: string) {
    this.url = new URL(url);
  }

  public async postMessage(message: Message) {
    console.log("postMessage", message);
    const popup = await this.waitForPopupLoaded();
    popup.postMessage(message, this.url.origin);
  }

  public async postRequestAndWaitForResponse<M extends Message>(
    request: Message & { id: UUID }
  ): Promise<M> {
    console.log("postRequestAndWaitForResponse", request);
    const responsePromise = this.onMessage<M>(
      ({ requestId }) => requestId === request.id
    );
    await this.postMessage(request);
    return await responsePromise;
  }

  public async onMessage<M extends Message>(
    predicate: (_: Partial<M>) => boolean
  ): Promise<M> {
    console.log("onMessage", predicate);
    return new Promise((resolve, reject) => {
      const listener = (event: MessageEvent<M>) => {
        if (event.origin !== this.url.origin) return;
        const message = event.data;
        if (predicate(message)) {
          resolve(message);
          window.removeEventListener("message", listener);
          this.listeners.delete(listener);
        }
      };

      window.addEventListener("message", listener);
      this.listeners.set(listener, { reject });
    });
  }

  public async waitForPopupLoaded() {
    console.log("waitForPopupLoaded...");
    if (this.popup && !this.popup.closed) {
      // In case the user un-focused the popup between requests, focus it again
      this.popup.focus();
      return this.popup;
    }

    this.popup = openPopup(this.url);

    this.onMessage<ConfigMessage>(({ event }) => event === "PopupUnload")
      .then(() => this.disconnect())
      .catch(() => {});

    return this.onMessage<ConfigMessage>(({ event }) => event === "PopupLoaded")
      .then(() => {
        console.log("the window has been loaded!");
      })
      .then(() => {
        if (!this.popup) throw new Error("Internal error: Popup is null");
        return this.popup;
      });
  }

  public removeListener(listener: (_: MessageEvent) => void): void {
    if (this.listeners.has(listener)) {
      window.removeEventListener("message", listener);
      this.listeners.delete(listener);
    }
  }

  private disconnect = () => {
    closePopup(this.popup);
    this.popup = null;

    this.listeners.forEach(({ reject }, listener) => {
      reject(new Error("Request rejected: Popup closed"));
      window.removeEventListener("message", listener);
    });
    this.listeners.clear();
  };
}
