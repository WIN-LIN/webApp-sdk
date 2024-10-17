export const prefix = "HoT";
export type Key = "accounts" | "activeChainId" | "availableChainList" | "url";
export const getKey = (key: Key) => {
  return `${prefix}:${key}`;
};

export const getLocalStorage = (key: string) => {
  if (typeof localStorage !== "undefined") {
    const value = localStorage.getItem(key);
    try {
      return JSON.parse(value!);
    } catch {
      return value;
    }
  }
  return null;
};
export const setLocalStorage = (key: string, value: string | object) => {
  return localStorage.setItem(
    key,
    typeof value === "object" ? JSON.stringify(value) : value
  );
};

export const removeLocalStorage = (key: string) => {
  return localStorage.removeItem(key);
};
export const clearLocalStorage = () => {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (typeof key === "string" && key.startsWith(prefix)) {
      localStorage.removeItem(key);
    }
  }
};

export const getSessionStorage = (key: string) => {
  if (typeof sessionStorage !== "undefined") {
    const value = sessionStorage.getItem(key);
    try {
      return JSON.parse(value!);
    } catch {
      return value;
    }
  }
  return null;
};

export const setSessionStorage = (key: string, value: string | object) => {
  if (typeof sessionStorage !== "undefined") {
    return sessionStorage.setItem(
      key,
      typeof value === "object" ? JSON.stringify(value) : value
    );
  }
  return;
};
