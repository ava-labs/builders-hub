declare module 'bs58' {
  function encode(source: Uint8Array): string;
  function decode(string: string): Uint8Array;
}
