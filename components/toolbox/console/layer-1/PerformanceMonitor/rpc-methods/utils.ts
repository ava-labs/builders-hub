export async function rpcCall(
    url: string,
    method: string,
    params: unknown[] | Record<string, unknown> = []
): Promise<{ result?: unknown; error?: { message: string; code?: number } }> {
    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
    });
    return response.json();
}
