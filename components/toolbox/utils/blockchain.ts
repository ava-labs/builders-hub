import { cb58ToHex } from '@/components/toolbox/console/utilities/format-converter/FormatConverter';

export function convertBlockchainIdToHex(blockchainId: string): `0x${string}` {
    try {
        let hexBlockchainId = cb58ToHex(blockchainId);

        // Ensure it's 32 bytes (64 hex chars)
        if (hexBlockchainId.length < 64) {
            // Pad with zeros on the left to make it 32 bytes
            hexBlockchainId = hexBlockchainId.padStart(64, '0');
        }

        return `0x${hexBlockchainId}` as `0x${string}`;
    } catch (error) {
        throw new Error(`Failed to convert blockchain ID to hex: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

export function formatBlockchainIdForDisplay(blockchainId: string): string {
    try {
        const hex = cb58ToHex(blockchainId);
        return `0x${hex.padStart(64, '0')}`;
    } catch {
        return 'Invalid CB58';
    }
}
