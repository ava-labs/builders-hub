// Reads a fetch response as JSON. A proxy in front of the site (Cloudflare,
// Vercel) can answer with an HTML error page; name the status instead of
// letting JSON.parse fail with "Unexpected token '<'".
export async function readJsonResponse(response: Response): Promise<any> {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`The server returned HTTP ${response.status} with a non-JSON response. Try again later.`);
  }
}
