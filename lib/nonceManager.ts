/**
 * Nonce Manager for server-side transaction serialization
 * Prevents nonce conflicts when multiple faucet requests arrive concurrently
 */

type QueuedRequest<T> = {
  execute: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
};

class NonceManager {
  private queue: QueuedRequest<any>[] = [];
  private isProcessing = false;

  async enqueue<T>(execute: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({ execute, resolve, reject });
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const request = this.queue.shift()!;
      try {
        const result = await request.execute();
        request.resolve(result);
      } catch (error) {
        request.reject(error instanceof Error ? error : new Error(String(error)));
      }
      // Small delay between transactions to allow nonce to propagate
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.isProcessing = false;
  }
}

// Singleton instance per faucet wallet
const faucetNonceManager = new NonceManager();

export { faucetNonceManager };
