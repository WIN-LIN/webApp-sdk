export const prefix = "HoT";

export const getKey = (key: string) => {
  return `${prefix}:${key}`;
};

export const getLocalStorage = (key: string) => {
  const value = localStorage.getItem(`${prefix}:${key}`);
  return value ? JSON.parse(value) : null;
};
export const setLocalStorage = (key: string, value: string | object) => {
  return localStorage.setItem(
    `${prefix}:${key}`,
    typeof value === "object" ? JSON.stringify(value) : value
  );
};

export const removeLocalStorage = (key: string) => {
  return localStorage.removeItem(`${prefix}:${key}`);
};
export const clearLocalStorage = () => {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (typeof key === "string" && key.startsWith(prefix)) {
      localStorage.removeItem(key);
    }
  }
};
