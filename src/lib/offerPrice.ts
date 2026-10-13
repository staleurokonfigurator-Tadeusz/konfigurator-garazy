export const MAX_MANUAL_OFFER_PRICE = 100_000_000;

// Polish decimal separator and grouping spaces; reject silent rounding and exponents.
export function parseManualOfferPrice(value: string): number | null {
  const normalized = value.replace(/[\s\u00a0]/g, '').replace(',', '.');
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(normalized)) return null;
  const price = Number(normalized);
  return Number.isFinite(price) && price > 0 && price <= MAX_MANUAL_OFFER_PRICE ? price : null;
}
