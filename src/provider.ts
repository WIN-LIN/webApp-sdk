import {
  Communicator,
  JsonRpcResponse,
  ProviderRpcError,
} from "./communication";
import { EventEmitter } from "eventemitter3";
import { getKey, getLocalStorage, setLocalStorage } from "./storage";

export enum WalletRpcMethod {
  eth_chainId = "eth_chainId",
  eth_accounts = "eth_accounts",
  eth_requestAccounts = "eth_requestAccounts",
  eth_sendTransaction = "eth_sendTransaction",
  eth_signTypedData_v4 = "eth_signTypedData_v4",
  personal_sign = "personal_sign",
}

/* EIP-1193  https://eips.ethereum.org/EIPS/eip-1193 */
export interface RequestArguments {
  method: string;
  params?: unknown[] | object;
}

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
  emit<K extends keyof ProviderEventMap>(
    event: K,
    ...args: [ProviderEventMap[K]]
  ): boolean;
  on<K extends keyof ProviderEventMap>(
    event: K,
    listener: (_: ProviderEventMap[K]) => void
  ): this;
}

export type ProviderEventCallback = ProviderInterface["emit"];

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
    this.accounts = getLocalStorage(getKey("accounts")) ?? [];
  }

  public async request(args: RequestArguments): Promise<JsonRpcResponse> {
    console.log("[HoT Provider] request", args);
    if (
      this.accounts.length === 0 &&
      args.method !== WalletRpcMethod.eth_requestAccounts
    ) {
      throw new Error("Should request accounts before sending request");
    }

    switch (args.method) {
      case WalletRpcMethod.eth_accounts:
        return this.getAccounts();
      case WalletRpcMethod.eth_requestAccounts:
        return this.handleRequestAccounts(args);
      case WalletRpcMethod.eth_sendTransaction:
      case WalletRpcMethod.eth_signTypedData_v4:
        return this.sendRequestToPopup(args);
      default:
        const rpcError = this.wrapError(new Error("Method not found"));
        return {
          error: rpcError,
        };
    }
  }

  private async sendRequestToPopup(
    request: RequestArguments
  ): Promise<JsonRpcResponse> {
    await this.communicator.waitForPopupLoaded();
    console.log("[HoT Provider] sendRequestToPopup", request);

    const response = await this.communicator.postRequestAndWaitForResponse({
      id: crypto.randomUUID(),
      method: request.method,
      params: request.params,
    });

    console.log(
      "[HoT Provider] response from request",
      request.method,
      response
    );

    if (response.error) {
      return {
        error: this.wrapError(response.error),
      };
    }

    return {
      result: response.result,
    };
  }

  private getAccounts(): JsonRpcResponse {
    console.log("[HoT Provider] getAccounts", this.accounts);
    return {
      result: this.accounts,
    };
  }

  private async handleRequestAccounts(
    request: RequestArguments
  ): Promise<JsonRpcResponse> {
    if (this.accounts.length > 0) {
      return {
        result: this.accounts,
      };
    }
    const response = await this.sendRequestToPopup(request);
    if (response.error) {
      return {
        error: this.wrapError(response.error),
      };
    }
    const accounts = response.result as string[];
    this.accounts = accounts;
    setLocalStorage(getKey("accounts"), this.accounts);

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
