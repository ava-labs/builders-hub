// Ported from @avalabs/ac-eerc-sdk (src/crypto/ff.ts).
//
// Finite-field arithmetic over an arbitrary prime — used by BabyJubJub as
// both the base field (SNARK_FIELD_SIZE) and indirectly as coefficients.

export class FF {
  public p: bigint;
  public one = 1n;
  public zero = 0n;

  constructor(prime: bigint) {
    this.p = prime;
  }

  newElement(value: bigint | string): bigint {
    const v = typeof value === 'string' ? BigInt(value) : value;
    if (v < this.zero) return ((v % this.p) + this.p) % this.p;
    return v % this.p;
  }

  add(a: bigint, b: bigint): bigint {
    return (a + b) % this.p;
  }

  sub(a: bigint, b: bigint): bigint {
    return (a - b + this.p) % this.p;
  }

  mul(a: bigint, b: bigint): bigint {
    const r = (a * b) % this.p;
    return r < 0n ? ((r % this.p) + this.p) % this.p : r;
  }

  div(a: bigint, b: bigint): bigint {
    return this.mul(a, this.modInverse(b));
  }

  negate(value: bigint): bigint {
    const v = this.newElement(value);
    return v === 0n ? 0n : this.p - v;
  }

  square(a: bigint): bigint {
    return this.mul(a, a);
  }

  normalize(value: bigint): bigint {
    if (value < 0n) {
      let na = -value % this.p;
      return na === 0n ? 0n : this.p - na;
    }
    return value >= this.p ? value % this.p : value;
  }

  eq(a: bigint, b: bigint): boolean {
    return a === b;
  }

  isInField(value: bigint): boolean {
    return value >= 0n && value < this.p;
  }

  modInverse(a: bigint): bigint {
    if (a === 0n) throw new Error('Division by zero');
    let t = 0n;
    let r = this.p;
    let newT = 1n;
    let newR = this.normalize(a);
    while (newR !== 0n) {
      const q = r / newR;
      [t, newT] = [newT, t - q * newT];
      [r, newR] = [newR, r - q * newR];
    }
    if (r > 1n) throw new Error(`${a} has no multiplicative inverse modulo ${this.p}`);
    if (t < 0n) t += this.p;
    return this.normalize(t);
  }
}
