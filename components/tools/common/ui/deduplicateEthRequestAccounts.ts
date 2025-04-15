let requestPromise: Promise<string[]> | null = null;

export const deduplicateEthRequestAccounts = async () => {
    if (requestPromise) {
        return requestPromise;
    }

    if (!window.avalanche) {
        throw new Error('No Avalanche provider found');
    }

    requestPromise = window.avalanche.request<string[]>({ method: 'eth_requestAccounts' })
    return requestPromise;
}
