import "server-only";
import { createClient } from "redis";

/* One Redis connection for the server's caches that outlive an instance
   (Query's recipes, the ICM fee months), opened on first use. It is null
   when REDIS_URL is not set or the server does not answer in time: each
   cache then keeps to its own memory. */

type Redis = ReturnType<typeof createClient>;

let client: Redis | null = null;
let connecting: Promise<Redis | null> | null = null;

export async function redis(): Promise<Redis | null> {
  if (client?.isOpen) return client;
  if (connecting) return connecting;
  const url = process.env.REDIS_URL;
  if (!url) return null;
  connecting = (async () => {
    const c = createClient({ url, socket: { connectTimeout: 1500 } });
    c.on("error", (e) => {
      console.warn("[redis] error", e instanceof Error ? e.message : e);
      client = null;
      connecting = null;
    });
    await c.connect();
    client = c;
    return c;
  })().catch(() => {
    connecting = null;
    return null;
  });
  return connecting;
}
