import { Communicator, ProviderRpcError } from "./communication";
import { EventEmitter } from "eventemitter3";
import { getKey, getLocalStorage, setLocalStorage } from "./storage";
import { rpc } from "./utils";

export enum WalletRpcMethod {
  eth_chainId = "eth_chainId",
  eth_accounts = "eth_accounts",
  eth_requestAccounts = "eth_requestAccounts",
  eth_sendTransaction = "eth_sendTransaction",
  eth_signTypedData_v4 = "eth_signTypedData_v4",
  wallet_switchEthereumChain = "wallet_switchEthereumChain",
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

type Chain = {
  id: number;
  rpcUrl: string;
};

export const HoTUrl = [
  "https://home-of-token-web.vercel.app/", // main
  "https://home-of-token-web-test.vercel.app/", // test
  "http://localhost:3000/", // local
];
export class HoTProvider
  extends ProviderEventEmitter
  implements ProviderInterface
{
  private readonly communicator: Communicator;
  private accounts: string[] = [];
  private chain: Chain;

  constructor(options: { url?: string } = { url: HoTUrl[0] }) {
    super();
    // check if url is from HoT
    if (options.url && HoTUrl.includes(options.url)) {
      sessionStorage.setItem(getKey("url"), options.url);
    } else {
      options.url = sessionStorage.getItem(getKey("url")) ?? HoTUrl[0];
    }

    this.communicator = new Communicator(`${options.url}/wallet`);
    this.accounts = getLocalStorage(getKey("accounts")) ?? [];
    this.chain = getLocalStorage(getKey("activeChainId")) ?? {
      id: 11155111,
      rpcUrl: "https://rpc.sepolia.org",
    };
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
        case WalletRpcMethod.wallet_switchEthereumChain:
          return this.handleSwitchChain(args);
        case WalletRpcMethod.eth_sendTransaction:
        case WalletRpcMethod.eth_signTypedData_v4:
          return this.sendRequestToPopup(args);
        case WalletRpcMethod.eth_chainId:
          return this.getChainId();
        default:
          const { result } = await rpc(this.chain.rpcUrl, args);
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
      chainId: this.chain.id,
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
    return this.chain.id;
  }

  private async handleRequestAccounts(
    request: RequestArguments
  ): Promise<unknown> {
    if (this.accounts.length > 0) {
      return this.accounts;
    }
    const result = (await this.sendRequestToPopup(request)) as {
      accounts: string[];
      availableChainList: Chain[];
    };
    const accounts = result.accounts;
    this.accounts = accounts;
    setLocalStorage(getKey("accounts"), this.accounts);
    setLocalStorage(getKey("availableChainList"), result.availableChainList);
    console.log("[HoT Provider] handleRequestAccounts", accounts);
    this.updateChain(result.availableChainList[0].id);
    return accounts;
  }

  private async handleSwitchChain(request: RequestArguments) {
    if (
      !Array.isArray(request.params) ||
      request.params.length === 0 ||
      !("chainId" in request.params[0])
    ) {
      return {
        code: -32602,
        message: "Invalid request params",
      };
    }

    // check if the chain is available in the list
    const { chainId: chainIdHex } = request?.params?.[0] as {
      chainId: string;
    };
    const chainId = parseInt(chainIdHex, 16);

    const isChainAvailable = this.updateChain(chainId);
    if (isChainAvailable) {
      return null; // success
    }

    return {
      code: 4902,
      message: "Unrecognized or unsupported chain ID.",
    };
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
  private updateChain(chainId: number) {
    const availableChainList = getLocalStorage(getKey("availableChainList"));
    console.log("availableChainList"), availableChainList;
    const chain = availableChainList.find(
      (chain: Chain) => chain.id === chainId
    );
    if (!chain) {
      return false;
    }
    this.chain = chain;
    setLocalStorage(getKey("activeChainId"), chain);
    return true;
  }
}
