/** Two-digit step number: 3 -> "03". */
export const padStep = (n: number): string => String(n).padStart(2, "0");
