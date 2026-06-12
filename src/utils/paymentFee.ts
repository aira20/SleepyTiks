// ── Payment Method Fee Service
// Semua dari database, ga ada yang hardcoded.
// Owner server tinggal atur sendiri lewat Admin Panel.

export interface DbPaymentFeeRule {
  id:          string;
  methodName:  string;
  fee:         number;
  recommended: boolean;
  enabled:     boolean;
  description: string | null;
  sortOrder:   number;
}

export const CUSTOM_METHOD_VALUE = 'OTHER_CUSTOM';

/**
 * Looks up the fee for a method name from DB rules (case-insensitive).
 * Returns 0 if not found.
 */
export function getPaymentMethodFeeFromRules(
  methodName: string | null | undefined,
  rules: DbPaymentFeeRule[],
): number {
  if (!methodName) return 0;
  const lower = methodName.trim().toLowerCase();
  return rules.find(r => r.methodName.toLowerCase() === lower)?.fee ?? 0;
}

/**
 * Formats a display label for a payment method.
 * For the custom method, appends the user-typed name in parentheses.
 */
export function formatPaymentMethodLabel(
  methodName: string | null | undefined,
  customLabel: string,
  customMethodTyped?: string | null,
): string {
  if (!methodName) return 'Not specified';
  if (methodName === CUSTOM_METHOD_VALUE) {
    const typed = (customMethodTyped ?? '').trim();
    return typed ? `${customLabel} (${typed})` : customLabel;
  }
  return methodName;
}
