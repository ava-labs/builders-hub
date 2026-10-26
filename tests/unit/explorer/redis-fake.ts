/* An in-memory stand-in for the node-redis client, with the commands the
   trace gate and cache send: GET, MGET, SET with NX, PX or EX, INCR and EXPIRE in a MULTI,
   and the one EVAL script that frees a slot for its owner. Time comes from
   Date.now(), so vi.useFakeTimers() moves leases and windows. Several gates
   that share one fake act as Vercel instances that share one Redis. */

type Entry = { value: string; expiresAt: number | null };

const OWNER_DEL = 'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end';

export class RedisFake {
  readonly store = new Map<string, Entry>();
  /** milliseconds every command waits, to test the gate's own timeout */
  delayMs = 0;
  /** when set, every command fails */
  down = false;

  private live(key: string): Entry | undefined {
    const e = this.store.get(key);
    if (e && e.expiresAt !== null && e.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return e;
  }

  private async run<T>(f: () => T): Promise<T> {
    if (this.down) throw new Error("redis down");
    if (this.delayMs) await new Promise((r) => setTimeout(r, this.delayMs));
    return f();
  }

  get(key: string) {
    return this.run(() => this.live(key)?.value ?? null);
  }

  mGet(keys: string[]) {
    return this.run(() => keys.map((k) => this.live(k)?.value ?? null));
  }

  set(key: string, value: string, opts: { NX?: boolean; PX?: number; EX?: number } = {}) {
    return this.run(() => {
      if (opts.NX && this.live(key)) return null;
      const ttlMs = opts.PX ?? (opts.EX !== undefined ? opts.EX * 1000 : null);
      this.store.set(key, { value, expiresAt: ttlMs !== null ? Date.now() + ttlMs : null });
      return "OK";
    });
  }

  eval(script: string, opts: { keys: string[]; arguments: string[] }) {
    return this.run(() => {
      // the one script the fake knows, as text: a script without the owner
      // check must fail here, not pass as if it had one
      if (script !== OWNER_DEL) throw new Error("unknown script");
      const [key] = opts.keys;
      if (this.live(key)?.value !== opts.arguments[0]) return 0;
      this.store.delete(key);
      return 1;
    });
  }

  multi() {
    const ops: (() => number)[] = [];
    const chain = {
      incr: (key: string) => {
        ops.push(() => {
          const e = this.live(key);
          const n = (e ? Number(e.value) : 0) + 1;
          this.store.set(key, { value: String(n), expiresAt: e?.expiresAt ?? null });
          return n;
        });
        return chain;
      },
      expire: (key: string, seconds: number) => {
        ops.push(() => {
          const e = this.live(key);
          if (!e) return 0;
          e.expiresAt = Date.now() + seconds * 1000;
          return 1;
        });
        return chain;
      },
      exec: () => this.run(() => ops.map((op) => op())),
    };
    return chain;
  }
}
