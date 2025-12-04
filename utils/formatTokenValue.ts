/**
 * Utility functions for formatting token/crypto values with sensible precision
 */

/**
 * Format a token value with appropriate precision based on its magnitude
 * @param value - The value to format (can be string or number)
 * @param options - Formatting options
 * @returns Formatted string
 */
export function formatTokenValue(
  value: string | number | null | undefined,
  options: {
    maxDecimals?: number;
    minDecimals?: number;
    showZero?: boolean;
    trimTrailingZeros?: boolean;
  } = {}
): string {
  const {
    maxDecimals = 6,
    minDecimals = 2,
    showZero = true,
    trimTrailingZeros = true,
  } = options;

  if (value === null || value === undefined || value === '') {
    return showZero ? '0' : '';
  }

  const num = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(num)) {
    return showZero ? '0' : '';
  }

  // Handle zero
  if (num === 0) {
    return showZero ? '0' : '';
  }

  const absNum = Math.abs(num);

  // For very large numbers, use compact notation
  if (absNum >= 1_000_000_000) {
    return formatCompact(num / 1_000_000_000, 2) + 'B';
  }
  if (absNum >= 1_000_000) {
    return formatCompact(num / 1_000_000, 2) + 'M';
  }
  if (absNum >= 1_000) {
    return formatWithCommas(num, Math.min(maxDecimals, 4), trimTrailingZeros);
  }

  // For values >= 1, use standard decimals
  if (absNum >= 1) {
    return formatWithDecimals(num, Math.min(maxDecimals, 4), minDecimals, trimTrailingZeros);
  }

  // For values >= 0.0001, show more decimals
  if (absNum >= 0.0001) {
    return formatWithDecimals(num, maxDecimals, 0, trimTrailingZeros);
  }

  // For very small non-zero values, show "< 0.0001" or scientific notation
  if (absNum > 0) {
    // Find first significant digit
    const significantDecimals = Math.ceil(-Math.log10(absNum));
    if (significantDecimals <= 8) {
      // Show actual value with enough decimals
      return formatWithDecimals(num, significantDecimals + 2, 0, trimTrailingZeros);
    }
    // Very small - show "< 0.00000001"
    return num < 0 ? '> -0.00000001' : '< 0.00000001';
  }

  return '0';
}

/**
 * Format a value with commas for thousands separators
 */
function formatWithCommas(
  value: number,
  maxDecimals: number,
  trimTrailingZeros: boolean
): string {
  const formatted = value.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  });
  
  if (trimTrailingZeros && formatted.includes('.')) {
    return formatted.replace(/\.?0+$/, '');
  }
  
  return formatted;
}

/**
 * Format a value with specific decimal places
 */
function formatWithDecimals(
  value: number,
  maxDecimals: number,
  minDecimals: number,
  trimTrailingZeros: boolean
): string {
  const fixed = value.toFixed(maxDecimals);
  
  if (trimTrailingZeros) {
    // Trim trailing zeros but keep at least minDecimals
    const parts = fixed.split('.');
    if (parts.length === 2) {
      let decimals = parts[1];
      // Remove trailing zeros
      decimals = decimals.replace(/0+$/, '');
      // Ensure minimum decimals
      while (decimals.length < minDecimals) {
        decimals += '0';
      }
      return decimals.length > 0 ? `${parts[0]}.${decimals}` : parts[0];
    }
    return fixed;
  }
  
  return fixed;
}

/**
 * Format for compact notation
 */
function formatCompact(value: number, decimals: number): string {
  return value.toFixed(decimals).replace(/\.?0+$/, '');
}

/**
 * Format a USD value with appropriate precision
 */
export function formatUsdValue(
  value: string | number | null | undefined,
  options: {
    showCents?: boolean;
    prefix?: string;
  } = {}
): string {
  const { showCents = true, prefix = '$' } = options;

  if (value === null || value === undefined || value === '') {
    return `${prefix}0.00`;
  }

  const num = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(num)) {
    return `${prefix}0.00`;
  }

  const absNum = Math.abs(num);

  // For very large values
  if (absNum >= 1_000_000_000) {
    return `${prefix}${(num / 1_000_000_000).toFixed(2)}B`;
  }
  if (absNum >= 1_000_000) {
    return `${prefix}${(num / 1_000_000).toFixed(2)}M`;
  }
  if (absNum >= 1_000) {
    return `${prefix}${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  // Standard formatting with 2 decimal places
  if (showCents || absNum >= 0.01) {
    return `${prefix}${num.toFixed(2)}`;
  }

  // Very small amounts
  if (absNum > 0 && absNum < 0.01) {
    return `< ${prefix}0.01`;
  }

  return `${prefix}0.00`;
}

/**
 * Format gas values (typically shown as integers or with few decimals)
 */
export function formatGasValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '0';
  }

  const num = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(num)) {
    return '0';
  }

  // Gas values are typically large integers
  return Math.round(num).toLocaleString('en-US');
}

/**
 * Format a percentage value
 */
export function formatPercentage(
  value: string | number | null | undefined,
  decimals: number = 2
): string {
  if (value === null || value === undefined || value === '') {
    return '0%';
  }

  const num = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(num)) {
    return '0%';
  }

  return `${num.toFixed(decimals)}%`;
}

