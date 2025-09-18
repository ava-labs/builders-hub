export const localStorageComp = () => typeof window !== 'undefined' ? localStorage : { getItem: () => null, setItem: () => { }, removeItem: () => { } }
export const STORE_VERSION = "v4"
