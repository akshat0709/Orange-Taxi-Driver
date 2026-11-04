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

/** "★ 4.8" for a rated chauffeur, "★ New" before the first rating (was a made-up 5.0). */
export function ratingLabel(rating: number | string | null | undefined): string {
  const n = Number(rating);
  return n > 0 ? `★ ${n.toFixed(1)}` : '★ New';
}
