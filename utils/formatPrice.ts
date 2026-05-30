// Convert number to superscript Unicode characters
function toSuperscript(num: number): string {
  const superscriptMap: Record<string, string> = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹'
  };
  return num.toString().split('').map(digit => superscriptMap[digit] || digit).join('');
}

/**
 * Format price in USD with compact notation for very small numbers
 * Uses superscript notation like 0⁴5 for 0.00005
 */
export function formatPrice(num: number): string {
  if (num >= 1) return `$${num.toFixed(2)}`;
  if (num >= 0.01) return `$${num.toFixed(4)}`;
  if (num >= 0.0001) return `$${num.toFixed(6)}`;
  if (num >= 0.00001) return `$${num.toFixed(8)}`;
  
  // For very small numbers, use compact notation like 0⁴5 for 0.00005
  if (num > 0 && num < 0.00001) {
    const str = num.toExponential();
    const match = str.match(/^(\d)\.(\d+)e-(\d+)$/);
    if (match) {
      const [, firstDigit, decimals, exponent] = match;
      const expNum = parseInt(exponent);
      
      // Format as 0ⁿX where n is number of zeros after decimal (superscript), X is firstDigit
      // Example: 0.00005 = 5e-5 -> 0⁴5
      // Example: 0.0000005 = 5e-7 -> 0⁶5
      if (expNum >= 4) {
        // Count leading zeros: expNum - 1 (because first digit is non-zero)
        const leadingZeros = expNum - 1;
        const significantDigit = firstDigit;
        const superscript = toSuperscript(leadingZeros);
        return `$0${superscript}${significantDigit}`;
      }
    }
    return `$${num.toExponential(2)}`;
  }
  
  return `$${num.toFixed(8)}`;
}

/**
 * Format AVAX price with compact notation for very small numbers
 * Uses superscript notation like 0⁴5 for 0.00005
 */
export function formatAvaxPrice(num: number): string {
  if (num >= 0.0001) return num.toFixed(4);
  if (num >= 0.00001) return num.toFixed(6);
  
  // For very small numbers, use compact notation with superscript
  if (num > 0 && num < 0.00001) {
    const str = num.toExponential();
    const match = str.match(/^(\d)\.(\d+)e-(\d+)$/);
    if (match) {
      const [, firstDigit, decimals, exponent] = match;
      const expNum = parseInt(exponent);
      
      if (expNum >= 4) {
        const leadingZeros = expNum - 1;
        const significantDigit = firstDigit;
        const superscript = toSuperscript(leadingZeros);
        return `0${superscript}${significantDigit}`;
      }
    }
    return num.toExponential(2);
  }
  
  return num.toFixed(6);
}

