// Ported from @avalabs/ac-eerc-sdk (src/crypto/poseidon/poseidon.ts).
//
// Poseidon hash + encryption (PCT — Poseidon Ciphertext). Used by eERC for
// per-operation audit ciphertexts and for reconstructing the user's own
// plaintext balance from the running `balancePCT` stored on-chain.

import { SNARK_FIELD_SIZE } from '../constants';
import { BabyJub, type BJPoint } from '../babyjub';
import { FF } from '../ff';
import { formatKeyForCurve } from '../key';
import { C_RAW, M_RAW } from './constants';

export interface PoseidonEncryptionResult {
  cipher: bigint[];
  nonce: bigint;
  encryptionRandom: bigint;
  authKey: BJPoint;
  encryptionKey: BJPoint;
}

export class Poseidon {
  public field: FF;
  public curve: BabyJub;
  public two128: bigint;
  public N_ROUNDS_F = 8;
  public N_ROUNDS_P = [56, 57, 56, 60, 60, 63, 64, 63];

  constructor(field: FF, curve: BabyJub) {
    this.field = field;
    this.curve = curve;
    this.two128 = this.field.newElement('340282366920938463463374607431768211456');
  }

  /**
   * Convenience: decrypt a 7-element PCT array (as emitted by the contract)
   * back to the scalar it encodes. Layout: `[c0, c1, c2, c3, authKeyX, authKeyY, nonce]`.
   */
  static decryptAmountPCT(decryptionKey: string, pct: (string | bigint)[]): bigint {
    const privateKey = formatKeyForCurve(decryptionKey);
    const pctBig = pct.map((e) => (typeof e === 'bigint' ? e : BigInt(e)));

    const cipher = pctBig.slice(0, 4);
    const authKey: BJPoint = [pctBig[4]!, pctBig[5]!];
    const nonce = pctBig[6]!;

    const field = new FF(SNARK_FIELD_SIZE);
    const curve = new BabyJub(field);
    const poseidon = new Poseidon(field, curve);

    const [amount] = poseidon.processPoseidonDecryption({
      privateKey,
      authKey,
      cipher,
      nonce,
      length: 1,
    });
    return amount!;
  }

  async processPoseidonEncryption(params: {
    inputs: bigint[];
    publicKey: BJPoint;
  }): Promise<PoseidonEncryptionResult> {
    const { inputs, publicKey } = params;
    const nonce = (await BabyJub.generateRandomValue()) % this.two128;
    const encryptionRandom = (await BabyJub.generateRandomValue()) % BigInt(2 ** 253);
    const encryptionKey = this.curve.mulWithScalar(publicKey, encryptionRandom);
    const cipher = this.poseidonEncrypt(inputs, encryptionKey, nonce);
    const authKey = this.curve.mulWithScalar(this.curve.Base8, encryptionRandom);
    return { cipher, nonce, encryptionRandom, authKey, encryptionKey };
  }

  processPoseidonDecryption(params: {
    privateKey: bigint;
    authKey: BJPoint;
    cipher: bigint[];
    nonce: bigint;
    length: number;
  }): bigint[] {
    const { privateKey, authKey, cipher, length, nonce } = params;
    const sharedKey = this.curve.mulWithScalar(authKey, privateKey);
    return this.poseidonDecrypt(cipher, sharedKey, nonce, length);
  }

  private poseidonPerm(ss: bigint[]): bigint[] {
    if (ss.length > this.N_ROUNDS_P.length) throw new Error('Invalid poseidon state');
    const t = ss.length;
    const nRoundsF = this.N_ROUNDS_F;
    const nRoundsP = this.N_ROUNDS_P[t - 2]!;

    let state = ss.map((e) => this.field.newElement(e));
    for (let r = 0; r < nRoundsF + nRoundsP; r++) {
      state = state.map((a, i) => this.field.add(a, BigInt(C_RAW[t - 2]![r * t + i]!)));
      if (r < nRoundsF / 2 || r >= nRoundsF / 2 + nRoundsP) {
        state = state.map((e) => this.pow5(e));
      } else {
        state[0] = this.pow5(state[0]!);
      }
      state = state.map((_, i) =>
        state.reduce(
          (acc, a, j) => this.field.add(acc, this.field.mul(BigInt(M_RAW[t - 2]![i]![j]!), a)),
          this.field.zero,
        ),
      );
    }
    return state.map((e) => this.field.normalize(e));
  }

  private poseidonEncrypt(inputs: bigint[], key: BJPoint, nonce: bigint): bigint[] {
    const msg = inputs.map((x) => this.field.newElement(x));
    if (nonce >= this.two128) throw new Error('Invalid nonce');
    while (msg.length % 3 > 0) msg.push(this.field.zero);

    const cipherLength = msg.length;
    let state = [
      this.field.zero,
      this.field.newElement(key[0]),
      this.field.newElement(key[1]),
      this.field.add(
        this.field.newElement(nonce),
        this.field.mul(this.field.newElement(String(inputs.length)), this.two128),
      ),
    ];

    const cipher: bigint[] = [];
    for (let i = 0; i < cipherLength / 3; i++) {
      state = this.poseidonPerm(state);
      state[1] = this.field.add(state[1]!, msg[i * 3]!);
      state[2] = this.field.add(state[2]!, msg[i * 3 + 1]!);
      state[3] = this.field.add(state[3]!, msg[i * 3 + 2]!);
      cipher.push(state[1]!, state[2]!, state[3]!);
    }
    state = this.poseidonPerm(state);
    cipher.push(state[1]!);
    return cipher;
  }

  private poseidonDecrypt(cipher: bigint[], sharedKey: BJPoint, nonce: bigint, length: number): bigint[] {
    let state = [
      this.field.zero,
      this.field.newElement(sharedKey[0]),
      this.field.newElement(sharedKey[1]),
      this.field.add(
        this.field.newElement(nonce),
        this.field.mul(this.field.newElement(length.toString()), this.two128),
      ),
    ];
    const msg: bigint[] = [];
    const count = Math.floor(cipher.length / 3);
    for (let i = 0; i < count; i++) {
      state = this.poseidonPerm(state);
      msg.push(this.field.sub(cipher[i * 3]!, state[1]!));
      msg.push(this.field.sub(cipher[i * 3 + 1]!, state[2]!));
      msg.push(this.field.sub(cipher[i * 3 + 2]!, state[3]!));
      state[1] = cipher[i * 3]!;
      state[2] = cipher[i * 3 + 1]!;
      state[3] = cipher[i * 3 + 2]!;
    }
    if (length % 3) {
      const tail = msg[msg.length - 1]!;
      if (!this.field.eq(tail, this.field.zero))
        throw new Error('The last element of the message must be 0');
      if (length % 3 === 1) {
        const tail2 = msg[msg.length - 2]!;
        if (!this.field.eq(tail2, this.field.zero))
          throw new Error('The second-to-last element of the message must be 0');
      }
    }
    state = this.poseidonPerm(state);
    if (!this.field.eq(cipher[cipher.length - 1]!, state[1]!))
      throw new Error('Invalid ciphertext');
    return msg.slice(0, length);
  }

  private pow5(a: bigint): bigint {
    return this.field.mul(a, this.field.square(this.field.square(a)));
  }
}
