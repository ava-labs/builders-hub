import { keccak256 } from 'viem';

export function calculateLibraryHash(libraryPath: string): string {
    const hash = keccak256(
        new TextEncoder().encode(libraryPath)
    ).slice(2);
    return hash.slice(0, 34);
}

export function getLinkedBytecode(
    bytecode: { object: string; linkReferences: Record<string, Record<string, any[]>> },
    libraryAddress: string
): `0x${string}` {
    if (!libraryAddress) {
        throw new Error('Library address is required for bytecode linking');
    }

    const libraryPath = `${Object.keys(bytecode.linkReferences)[0]}:${Object.keys(Object.values(bytecode.linkReferences)[0])[0]}`;
    const libraryHash = calculateLibraryHash(libraryPath);
    const libraryPlaceholder = `__$${libraryHash}$__`;

    const linkedBytecode = bytecode.object
        .split(libraryPlaceholder)
        .join(libraryAddress.slice(2).padStart(40, '0'));

    if (linkedBytecode.includes("$__")) {
        throw new Error("Failed to replace library placeholder with actual address");
    }

    return linkedBytecode as `0x${string}`;
}
