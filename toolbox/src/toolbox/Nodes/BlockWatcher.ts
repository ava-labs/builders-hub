import { PublicClient } from 'viem';


export interface BlockInfo {
    blockNumber: number;
    transactionCount: number;
    gasUsed: bigint;
    timestamp: number; // Unix timestamp in seconds
}

export
    class BlockWatcher {
    private publicClient: PublicClient;
    private callback: (blockInfo: BlockInfo) => void;
    private isRunning: boolean = false;

    constructor(publicClient: PublicClient, callback: (blockInfo: BlockInfo) => void) {
        this.publicClient = publicClient;
        this.callback = callback;
    }

    async start(startFromBlock: number, blockHistory: number) {
        if (this.isRunning) return;
        this.isRunning = true;

        let currentBlockNumber = BigInt(startFromBlock);
        console.log('Starting from block', currentBlockNumber);

        const maxBatchSize = 200;

        // First, fetch historical blocks
        try {
            const latestBlock = await this.publicClient.getBlockNumber();
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
                    blockPromises.push(this.publicClient.getBlock({
                        blockNumber: BigInt(j)
                    }));
                }

                const blocks = await Promise.all(blockPromises);


                blocks.forEach((block) => {
                    this.callback({
                        blockNumber: Number(block.number),
                        transactionCount: block.transactions.length,
                        gasUsed: block.gasUsed,
                        timestamp: Number(block.timestamp)
                    });
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
                let lastBlock = await this.publicClient.getBlockNumber()

                while (lastBlock === currentBlockNumber) {
                    console.log('Reached end of chain');
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    lastBlock = await this.publicClient.getBlockNumber();
                }

                const endBlock = currentBlockNumber + BigInt(maxBatchSize) < BigInt(lastBlock)
                    ? currentBlockNumber + BigInt(maxBatchSize)
                    : BigInt(lastBlock);

                const blockPromises = [];
                for (let i = currentBlockNumber; i < endBlock; i++) {
                    blockPromises.push(this.publicClient.getBlock({
                        blockNumber: i
                    }));
                }

                const blocks = await Promise.all(blockPromises);

                // Send block info to callback
                blocks.forEach((block, index) => {
                    this.callback({
                        blockNumber: Number(currentBlockNumber) + index,
                        transactionCount: block.transactions.length,
                        gasUsed: block.gasUsed,
                        timestamp: Number(block.timestamp)
                    });
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
