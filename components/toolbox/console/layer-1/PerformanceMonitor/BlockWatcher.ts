export interface BlockInfo {
    blockNumber: number;
    transactionCount: number;
    gasUsed: bigint;
    timestamp: number; // Unix timestamp in seconds
    timestampMs: number; // Unix timestamp in milliseconds (from Subnet-EVM timestampMilliseconds)
}

interface RpcBlock {
    number: string;
    transactions: string[];
    gasUsed: string;
    timestamp: string;
    timestampMilliseconds?: string;
}

export class BlockWatcher {
    private rpcUrl: string;
    private callback: (blockInfo: BlockInfo) => void;
    private isRunning: boolean = false;

    constructor(rpcUrl: string, callback: (blockInfo: BlockInfo) => void) {
        this.rpcUrl = rpcUrl;
        this.callback = callback;
    }

    private async rpcCall(method: string, params: unknown[]): Promise<unknown> {
        const response = await fetch(this.rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method,
                params,
                id: 1
            })
        });
        const json = await response.json();
        if (json.error) {
            throw new Error(json.error.message);
        }
        return json.result;
    }

    private async getBlockNumber(): Promise<bigint> {
        const result = await this.rpcCall('eth_blockNumber', []) as string;
        return BigInt(result);
    }

    private async getBlock(blockNumber: bigint): Promise<RpcBlock> {
        const hexBlock = '0x' + blockNumber.toString(16);
        return await this.rpcCall('eth_getBlockByNumber', [hexBlock, false]) as RpcBlock;
    }

    private parseBlock(block: RpcBlock): BlockInfo {
        const timestampSec = Number(BigInt(block.timestamp));
        // Use timestampMilliseconds if available, otherwise derive from seconds
        const timestampMs = block.timestampMilliseconds
            ? Number(BigInt(block.timestampMilliseconds))
            : timestampSec * 1000;

        return {
            blockNumber: Number(BigInt(block.number)),
            transactionCount: block.transactions.length,
            gasUsed: BigInt(block.gasUsed),
            timestamp: timestampSec,
            timestampMs: timestampMs
        };
    }

    async start(startFromBlock: number, blockHistory: number) {
        if (this.isRunning) return;
        this.isRunning = true;

        let currentBlockNumber = BigInt(startFromBlock);
        console.log('Starting from block', currentBlockNumber);

        const maxBatchSize = 200;

        // First, fetch historical blocks
        try {
            const latestBlock = await this.getBlockNumber();
            const historicalStartBlock = Math.max(
                Number(latestBlock) - blockHistory,
                1
            );

            console.log(`Fetching ${blockHistory} historical blocks from ${historicalStartBlock} to ${latestBlock}`);

            // Process historical blocks in batches
            for (let i = historicalStartBlock; i < Number(latestBlock) && this.isRunning; i += maxBatchSize) {
                const endBlock = Math.min(i + maxBatchSize, Number(latestBlock));
                const blockPromises = [];

                for (let j = i; j < endBlock; j++) {
                    blockPromises.push(this.getBlock(BigInt(j)));
                }

                const blocks = await Promise.all(blockPromises);

                blocks.forEach((block) => {
                    this.callback(this.parseBlock(block));
                });

                console.log(`Processed historical blocks ${i} to ${endBlock - 1}`);
            }

            // Set current block number to latest after historical sync
            currentBlockNumber = latestBlock;
            console.log('Historical sync complete, now watching for new blocks');
        } catch (error) {
            console.error('Error fetching historical blocks:', error);
        }

        // Now start monitoring new blocks
        while (this.isRunning) {
            try {
                let lastBlock = await this.getBlockNumber();

                while (lastBlock === currentBlockNumber) {
                    console.log('Reached end of chain');
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    lastBlock = await this.getBlockNumber();
                }

                const endBlock = currentBlockNumber + BigInt(maxBatchSize) < BigInt(lastBlock)
                    ? currentBlockNumber + BigInt(maxBatchSize)
                    : BigInt(lastBlock);

                const blockPromises = [];
                for (let i = currentBlockNumber; i < endBlock; i++) {
                    blockPromises.push(this.getBlock(i));
                }

                const blocks = await Promise.all(blockPromises);

                // Send block info to callback
                blocks.forEach((block) => {
                    this.callback(this.parseBlock(block));
                });

                console.log('Synced blocks', currentBlockNumber, 'to', endBlock);
                currentBlockNumber = endBlock;
            } catch (error) {
                if (error instanceof Error &&
                    error.message.includes('cannot query unfinalized data')) {
                    console.log(`Block ${currentBlockNumber} not finalized yet, waiting...`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } else {
                    console.error('Error fetching block:', error);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }
    }

    stop() {
        this.isRunning = false;
    }
}
