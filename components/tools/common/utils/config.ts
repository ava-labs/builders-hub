const endpoints = ["http://localhost:3857", "https://launcher-backend.fly.dev"];

const getAPIHost = async (): Promise<string> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000); // 1 second timeout

  try {
    const response = await fetch(`${endpoints[0]}/ping`, {
      method: "GET",
      signal: controller.signal,
    });

    if (response.ok) {
      const text = await response.text();
      if (text === "pong") {
        console.debug(endpoints[0], "is available, using local API");
        return endpoints[0];
      }
    }
  } catch (error: any) {
    console.debug("Using remote API", endpoints[1]);
  } finally {
    clearTimeout(timeoutId);
  }

  console.debug("Using remote API", endpoints[1]);
  return endpoints[1];
};

export const apiHostPromise = getAPIHost();
