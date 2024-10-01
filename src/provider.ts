import { Communicator, Message } from "./communication";
import { EventEmitter } from "eventemitter3";

export enum WalletRpcMethod {
  eth_chainId = "eth_chainId",
  eth_requestAccounts = "eth_requestAccounts",
  eth_sendTransaction = "eth_sendTransaction",
  eth_signTypedData = "eth_signTypedData",
  personal_sign = "personal_sign",
}

export interface RequestArguments {
  method: string;
  params?: unknown[] | object;
}

export interface ProviderRpcError extends Error {
  code: number;
  data?: unknown;
}
/* EIP-1193  https://eips.ethereum.org/EIPS/eip-1193 */
interface ProviderConnectInfo {
  readonly chainId: string;
}

type ProviderEventMap = {
  connect: ProviderConnectInfo;
  disconnect: ProviderRpcError;
  chainChanged: string;
  accountsChanged: string[];
};

export class ProviderEventEmitter extends EventEmitter<
  keyof ProviderEventMap
> {}

export interface ProviderInterface extends ProviderEventEmitter {
  request(args: RequestArguments): Promise<unknown>;
  // disconnect(): Promise<void>;
  emit<K extends keyof ProviderEventMap>(
    event: K,
    ...args: [ProviderEventMap[K]]
  ): boolean;
  on<K extends keyof ProviderEventMap>(
    event: K,
    listener: (_: ProviderEventMap[K]) => void
  ): this;
}
// export interface ProviderInterface extends ProviderEventEmitter {
//   request(args: RequestArguments): Promise<unknown>;
//   on(event: string, listener: (...args: unknown[]) => void): void;
// }

export type ProviderEventCallback = ProviderInterface["emit"];

/* Hot Wallet Provider */
// type Chain = {
//   id: number;
//   rpcUrl: string;
// };

export class HoTProvider
  extends ProviderEventEmitter
  implements ProviderInterface
{
  private readonly communicator: Communicator;
  private accounts: string[] = [];
  // private chain: Chain;

  constructor(options: { url: string }) {
    super();
    this.communicator = new Communicator(options.url);
  }

  public async request(args: RequestArguments): Promise<unknown> {
    console.log("request", args);
    if (
      this.accounts.length === 0 &&
      args.method !== WalletRpcMethod.eth_requestAccounts
    ) {
      throw new Error("Should request accounts before sending request");
    }

    switch (args.method) {
      case WalletRpcMethod.eth_requestAccounts:
        return this.getAccounts(args);
      case WalletRpcMethod.eth_sendTransaction:
      case WalletRpcMethod.eth_signTypedData:
      case WalletRpcMethod.personal_sign:
        return this.sendRequestToPopup(args);
    }
  }

  // public on(event: string, listener: (...args: unknown[]) => void): void {
  //   this.communicator
  //     .onMessage<Message>((message) => message.event === event)
  //     .then((message) => {
  //       listener(
  //         ...(Array.isArray(message.params) ? message.params : [message.params])
  //       );
  //       // Re-register the listener for future events
  //       this.on(event, listener);
  //     })
  //     .catch((error) => {
  //       console.error(`Error in event listener for ${event}:`, error);
  //     });
  // }
  private async sendRequestToPopup(request: RequestArguments) {
    const popupLoaded = await this.communicator.waitForPopupLoaded();
    console.log("[HoT Provider] popupLoaded", popupLoaded);

    return this.communicator.postRequestAndWaitForResponse({
      id: crypto.randomUUID(),
      method: request.method,
      params: request.params,
    });
  }

  private async getAccounts(args: RequestArguments) {
    console.log("[HoT Provider] getAccounts request", args);
    const response: Message =
      await this.communicator.postRequestAndWaitForResponse({
        id: crypto.randomUUID(),
        method: args.method,
        params: args.params,
      });
    console.log("[HoT Provider] getAccounts response", response);
    return response;
  }

  private wrapError(error: unknown): ProviderRpcError {
    if (error instanceof Error) {
      return {
        ...error,
        code: (error as any).code || -32603, // Internal error
        data: (error as any).data,
      };
    }
    return {
      name: "ProviderRpcError",
      message: "Unknown error",
      code: -32603, // Internal error
      data: error,
    };
  }
}
