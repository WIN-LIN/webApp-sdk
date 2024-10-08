import {
  Communicator,
  JsonRpcResponse,
  ProviderRpcError,
} from "./communication";
import { EventEmitter } from "eventemitter3";
import { getKey, getLocalStorage, setLocalStorage } from "./storage";
import { rpc } from "./utils";

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

  public async request(args: RequestArguments): Promise<unknown> {
    console.log("[HoT Provider] request", args);
    if (
      this.accounts.length === 0 &&
      args.method !== WalletRpcMethod.eth_requestAccounts
    ) {
      throw new Error("Should request accounts before sending request");
    }

    try {
      switch (args.method) {
        case WalletRpcMethod.eth_accounts:
          return this.getAccounts();
        case WalletRpcMethod.eth_requestAccounts:
          return this.handleRequestAccounts(args);
        case WalletRpcMethod.eth_sendTransaction:
        case WalletRpcMethod.eth_signTypedData_v4:
          return this.sendRequestToPopup(args);
        case WalletRpcMethod.eth_chainId:
          return this.getChainId();
        default:
          const { result } = await rpc("https://rpc.sepolia.org", args);
          return result;
      }
    } catch (error) {
      throw this.wrapError(error);
    }
  }

  private async sendRequestToPopup(
    request: RequestArguments
  ): Promise<unknown> {
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
      throw this.wrapError(response.error);
    }

    return response.result;
  }

  private getAccounts() {
    console.log("[HoT Provider] getAccounts", this.accounts);
    return this.accounts;
  }

  private getChainId() {
    return 11155111;
  }

  private async handleRequestAccounts(
    request: RequestArguments
  ): Promise<unknown> {
    if (this.accounts.length > 0) {
      return this.accounts;
    }
    const result = await this.sendRequestToPopup(request);
    const accounts = result as string[];
    this.accounts = accounts;
    setLocalStorage(getKey("accounts"), this.accounts);

    return accounts;
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
