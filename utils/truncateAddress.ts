// Function to truncate Ethereum address
export function truncateAddress(address:string, startChars = 6, endChars = 4) {
    if (!address) return '';
    
    // Check if the address is valid (has enough characters)
    if (address.length < startChars + endChars) {
      return address;
    }
    
    // Get the first n characters
    const start = address.substring(0, startChars);
    
    // Get the last n characters
    const end = address.substring(address.length - endChars);
    
    // Return the truncated address
    return `${start}...${end}`;
  }
  