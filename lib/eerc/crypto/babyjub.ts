// Ported from @avalabs/ac-eerc-sdk (src/crypto/babyjub.ts).
//
// BabyJubJub curve ops + ElGamal encryption. Points are tuple-form
// `[x, y]` for arithmetic efficiency; convert to `{x, y}` only at the
// Solidity boundary via pointToStruct() in ../proof.ts.

import { SUB_GROUP_ORDER } from './constants';
import type { FF } from './ff';
import { Scalar } from './scalar';

export type BJPoint = [bigint, bigint];
export type ElGamalCipher = { c1: BJPoint; c2: BJPoint };

export class BabyJub {
  public A = 168700n;
  public D = 168696n;

  public Base8: BJPoint = [
    5299619240641551281634865583518297030282874472190772894086521144482721001553n,
    16950150798460657717958625567821834550301663161624707787222815936182638968203n,
  ];

  constructor(public field: FF) {}

  static order() {
    return 21888242871839275222246405745257275088614511777268538073601725287587578984328n;
  }

  /** Cryptographically-random scalar below SUB_GROUP_ORDER. */
  static async generateRandomValue(): Promise<bigint> {
    const lower = SUB_GROUP_ORDER / 2n;
    let rand: bigint;
    do {
      const bytes = await BabyJub.getRandomBytes(32);
      rand = BigInt(`0x${Buffer.from(bytes).toString('hex')}`);
    } while (rand < lower);
    return rand % SUB_GROUP_ORDER;
  }

  addPoints(a: BJPoint, b: BJPoint): BJPoint {
    const f = this.field;
    const beta = f.mul(a[0], b[1]);
    const gamma = f.mul(a[1], b[0]);
    const delta = f.mul(f.sub(a[1], f.mul(this.A, a[0])), f.add(b[0], b[1]));
    const tau = f.mul(beta, gamma);
    const dtau = f.mul(this.D, tau);
    const x = f.div(f.add(beta, gamma), f.add(f.one, dtau));
    const y = f.div(f.add(delta, f.sub(f.mul(this.A, beta), gamma)), f.sub(f.one, dtau));
    return [x, y];
  }

  subPoints(p1: BJPoint, p2: BJPoint): BJPoint {
    return this.addPoints(p1, [this.field.negate(p2[0]), p2[1]]);
  }

  /** Double-and-add scalar multiplication. */
  mulWithScalar(p: BJPoint, s: bigint): BJPoint {
    let res: BJPoint = [this.field.zero, this.field.one];
    let e = p;
    let rem = s;
    while (!Scalar.isZero(rem)) {
      if (Scalar.isOdd(rem)) res = this.addPoints(res, e);
      e = this.addPoints(e, e);
      rem = Scalar.shiftRight(rem, 1);
    }
    return res;
  }

  inCurve(p: BJPoint): boolean {
    const f = this.field;
    const x2 = f.mul(p[0], p[0]);
    const y2 = f.mul(p[1], p[1]);
    return f.eq(
      f.add(f.mul(this.A, x2), y2),
      f.add(f.one, f.mul(this.D, f.mul(x2, y2))),
    );
  }

  generatePublicKey(secretKey: bigint): BJPoint {
    if (!this.field.isInField(secretKey)) throw new Error('Secret key is not in the field');
    return this.mulWithScalar(this.Base8, secretKey);
  }

  async encryptMessage(publicKey: BJPoint, message: bigint): Promise<{ cipher: ElGamalCipher; random: bigint }> {
    const mm = this.mulWithScalar(this.Base8, message);
    return this.elGamalEncryption(publicKey, mm);
  }

  async elGamalEncryption(publicKey: BJPoint, message: BJPoint): Promise<{ cipher: ElGamalCipher; random: bigint }> {
    const random = await BabyJub.generateRandomValue();
    const c1 = this.mulWithScalar(this.Base8, random);
    const pky = this.mulWithScalar(publicKey, random);
    const c2 = this.addPoints(message, pky);
    return { cipher: { c1, c2 }, random };
  }

  /** Decrypt to a curve point. Caller must use decryptPointToScalar for the plaintext scalar. */
  elGamalDecryption(privateKey: bigint, cipher: ElGamalCipher): BJPoint {
    const c1x = this.mulWithScalar(cipher.c1, privateKey);
    const c1xInv: BJPoint = [this.field.mul(c1x[0], -1n), c1x[1]];
    return this.addPoints(cipher.c2, c1xInv);
  }

  private static async getRandomBytes(bytes: number): Promise<Uint8Array> {
    if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
      const u = new Uint8Array(bytes);
      globalThis.crypto.getRandomValues(u);
      return u;
    }
    const nodeCrypto = await import('node:crypto');
    return nodeCrypto.randomBytes(bytes);
  }
}
