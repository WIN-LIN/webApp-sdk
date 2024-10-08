import { RequestArguments } from "../provider";

export const rpc = async(url: string, args: RequestArguments) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method: args.method,
      params: args.params || [],
    })
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message)
  }

  return data
}