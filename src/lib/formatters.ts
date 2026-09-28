/**
 * Utility functions for precise Indian Rupee currency formatting
 * Guarantees exactly 2 decimal places across all screens and modals.
 */

export function formatRupees(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return '0.00';
  }
  const num = Number(amount);
  return num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function round2(amount: number | string | null | undefined): number {
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return 0;
  }
  return Math.round((Number(amount) + Number.EPSILON) * 100) / 100;
}
