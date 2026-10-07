import type { AbiParameter } from "viem";

/** Turns what a builder typed into a value viem can encode for `param`. Throws with a readable message. */
export function parseAbiInput(raw: string, param: AbiParameter): unknown {
  const type = param.type;
  const value = raw.trim();
  const name = param.name || type;
  if (type.endsWith("]") || type === "tuple") {
    try {
      return JSON.parse(value);
    } catch {
      throw new Error(`${name}: enter JSON, for example ${type === "tuple" ? '{"field": 1}' : "[1, 2]"}`);
    }
  }
  if (/^u?int\d*$/.test(type)) {
    if (!/^-?\d+$/.test(value)) throw new Error(`${name}: enter a whole number in base units`);
    return BigInt(value);
  }
  if (type === "bool") {
    if (value !== "true" && value !== "false") throw new Error(`${name}: enter true or false`);
    return value === "true";
  }
  if (type === "address") {
    if (!/^0x[0-9a-fA-F]{40}$/.test(value)) throw new Error(`${name}: enter a 0x address`);
    return value;
  }
  if (type.startsWith("bytes")) {
    if (!/^0x([0-9a-fA-F]{2})*$/.test(value)) throw new Error(`${name}: enter 0x-prefixed hex`);
    return value;
  }
  return raw;
}

export const placeholderFor = (param: AbiParameter) =>
  param.type === "address"
    ? "0x…"
    : /^u?int/.test(param.type)
      ? "0"
      : param.type === "bool"
        ? "true / false"
        : param.type.startsWith("bytes")
          ? "0x"
          : param.type.endsWith("]") || param.type === "tuple"
            ? "JSON"
            : "";

/** JSON with bigints as strings, for showing results. */
export const show = (value: unknown) => JSON.stringify(value, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2);
