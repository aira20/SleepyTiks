// Fee brackets for IDR middleman transactions
export const FEE_BRACKETS = [
  { min: 20_000,      max: 499_000,     fee: 10_000  },
  { min: 500_000,     max: 999_000,     fee: 20_000  },
  { min: 1_000_000,   max: 1_499_000,   fee: 30_000  },
  { min: 1_500_000,   max: 2_999_000,   fee: 40_000  },
  { min: 3_000_000,   max: 4_999_000,   fee: 50_000  },
  { min: 5_000_000,   max: 9_999_000,   fee: 100_000 },
  { min: 10_000_000,  max: Infinity,    fee: 200_000 },
] as const;

export const MM_AMOUNT_MIN = 20_000;
export const MM_AMOUNT_MAX = 75_000_000;

export type FeeResponsibility = 'buyer' | 'seller' | 'split';

export interface FeeCalculation {
  amount: number;
  fee: number;
  responsibility: FeeResponsibility;
  buyerPays: number;
  sellerReceives: number;
}

/**
 * Normalizes IDR amount strings into an integer.
 * Accepts: 500000 | 500.000 | Rp500.000 | Rp 1.250.000
 */
export function parseIDRAmount(input: string): number | null {
  // Strip "Rp", spaces, then remove thousand-separator dots
  const cleaned = input
    .replace(/[Rr][Pp]/g, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(/,/g, '');

  const value = parseInt(cleaned, 10);
  return isNaN(value) ? null : value;
}

/**
 * Validates a parsed IDR amount against min/max bounds.
 * Returns an error string or null if valid.
 */
export function validateIDRAmount(amount: number): string | null {
  if (amount < MM_AMOUNT_MIN) {
    return `The minimum supported transaction amount is **Rp ${formatIDR(MM_AMOUNT_MIN)}**.`;
  }
  if (amount > MM_AMOUNT_MAX) {
    return `The maximum supported transaction amount is **Rp ${formatIDR(MM_AMOUNT_MAX)}**.`;
  }
  return null;
}

/**
 * Formats a number as IDR with dot-separated thousands.
 * Example: 1250000 → "1.250.000"
 */
export function formatIDR(amount: number): string {
  return amount.toLocaleString('id-ID');
}

/**
 * Normalizes fee responsibility input to a canonical FeeResponsibility value.
 * Accepts: buyer | seller | split (case-insensitive, partial match)
 * Returns null if input is unrecognized.
 */
export function parseFeeResponsibility(input: string): FeeResponsibility | null {
  const normalized = input.trim().toLowerCase();
  if (normalized.startsWith('buyer') || normalized === 'b') return 'buyer';
  if (normalized.startsWith('seller') || normalized === 's') return 'seller';
  if (normalized.startsWith('split') || normalized === 'sp') return 'split';
  return null;
}

/**
 * Calculates the middleman fee and payment breakdown for a transaction.
 */
export function calculateMiddlemanFee(
  amount: number,
  responsibility: FeeResponsibility,
): FeeCalculation {
  const bracket = FEE_BRACKETS.find(b => amount >= b.min && amount <= b.max);
  const fee = bracket?.fee ?? 0;

  let buyerPays: number;
  let sellerReceives: number;

  switch (responsibility) {
    case 'buyer':
      buyerPays = amount + fee;
      sellerReceives = amount;
      break;
    case 'seller':
      buyerPays = amount;
      sellerReceives = amount - fee;
      break;
    case 'split': {
      const half = Math.ceil(fee / 2);
      buyerPays = amount + half;
      sellerReceives = amount - (fee - half);
      break;
    }
  }

  return { amount, fee, responsibility, buyerPays, sellerReceives };
}
