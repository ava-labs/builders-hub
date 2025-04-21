
// Splits data into 32-byte chunks, adds 0xFF terminator, and pads with zeros
export function packWarpIntoAccessList(warpMessageBytes: Uint8Array): [{
    address: `0x${string}`,
    storageKeys: `0x${string}`[]
}] {
    const CHUNK_SIZE = 32;
    const chunks: string[] = [];
    let currentChunk = Array.from(warpMessageBytes);

    // Add 0xFF terminator
    currentChunk.push(0xFF);

    // Pad to multiple of 32 bytes with zeros
    const paddingNeeded = (CHUNK_SIZE - (currentChunk.length % CHUNK_SIZE)) % CHUNK_SIZE;
    currentChunk = currentChunk.concat(Array(paddingNeeded).fill(0));

    // Split into 32-byte chunks
    for (let i = 0; i < currentChunk.length; i += CHUNK_SIZE) {
        const chunk = currentChunk.slice(i, i + CHUNK_SIZE);
        const hexChunk = chunk
            .map(byte => byte.toString(16).padStart(2, '0'))
            .join('');
        chunks.push(`0x${hexChunk}`);
    }

    return [{
        address: "0x0200000000000000000000000000000000000005",
        storageKeys: chunks as `0x${string}`[]
    }];
}
