import { Address } from 'viem';

// Helper function to convert decimal number string to hex wei string
export const decimalToHex = (value: string): string => {
    try {
        // Parse the decimal value
        const numValue = parseFloat(value);
        if (isNaN(numValue) || numValue < 0) return "0x0";

        // Convert to wei (multiply by 10^18)
        // Using BigInt to handle large numbers
        const weiValue = BigInt(Math.floor(numValue * 10 ** 18));

        // Convert to hex
        return "0x" + weiValue.toString(16);
    } catch (error) {
        console.error("Error converting to hex:", error);
        return "0x0";
    }
}

// Helper function to parse a comma-separated string of addresses into an array
export const parseAddressList = (input: string): Address[] => {
    // Trim input and handle empty case
    const trimmedInput = input.trim();
    if (!trimmedInput) return [];
    
    // Check if input is a single address without commas
    if (!trimmedInput.includes(',')) {
        // Clean up any possible whitespace
        const singleAddress = trimmedInput.trim();
        if (/^0x[a-fA-F0-9]{40}$/i.test(singleAddress)) {
            return [singleAddress as Address];
        } else {
            // Invalid single address format
            return [];
        }
    }
    
    // Handle multiple addresses
    const addresses = trimmedInput.split(',')
        .map(addr => addr.trim())
        .filter(addr => /^0x[a-fA-F0-9]{40}$/i.test(addr));
    
    return addresses as Address[];
}

// Helper function to format an array of addresses into a comma-separated string
export const formatAddressList = (addresses: Address[]): string => {
    return addresses.map(addr => addr.startsWith('0x') ? addr : `0x${addr}`).join(', ');
} 