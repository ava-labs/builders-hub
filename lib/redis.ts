import "server-only";
import { createClient } from "redis";

/* One Redis connection for the server's caches and budgets that outlive an
   instance (Query's recipes, the ICM fee months, the trace node budget),
   opened on first use. It is null when REDIS_URL is not set, before the
   first connect lands, and while the socket is down: each caller then keeps
   to its own memory or, for the trace budget, refuses.

   There is one client per instance. After an error it reconnects on its
   own; a new client per error would leave the old ones reconnecting
   forever. A command sent while the socket is down fails at once instead of
   waiting in a queue. */

type Redis = ReturnType<typeof createClient>;

let client: Redis | null = null;
let connecting: Promise<Redis | null> | null = null;

export async function redis(): Promise<Redis | null> {
  if (client) return client.isReady ? client : null;
  if (connecting) return connecting;
  const url = process.env.REDIS_URL;
  if (!url) return null;
  connecting = (async () => {
    const c = createClient({
      url,
      disableOfflineQueue: true,
      socket: { connectTimeout: 1500, reconnectStrategy: (retries) => Math.min(100 * 2 ** retries, 5_000) },
    });
    c.on("error", (e) => console.warn("[redis] error", e instanceof Error ? e.message : e));
    await c.connect();
    client = c;
    return c;
  })()
    .catch(() => null)
    .finally(() => {
      connecting = null;
    });
  return connecting;
}
