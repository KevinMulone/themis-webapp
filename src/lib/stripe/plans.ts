export const PLANS = {
  monthly: { envPrice: 'STRIPE_PRICE_MONTHLY', days: 30, label: 'Mensile' },
  semestrale: { envPrice: 'STRIPE_PRICE_SEMESTRALE', days: 180, label: 'Semestrale' },
  annuale: { envPrice: 'STRIPE_PRICE_ANNUALE', days: 365, label: 'Annuale' },
} as const;

export type PlanKey = keyof typeof PLANS;

export function isPlanKey(value: string): value is PlanKey {
  return value in PLANS;
}

export function priceIdFor(plan: PlanKey): string {
  return process.env[PLANS[plan].envPrice]!;
}

export function planKeyFromPriceId(priceId: string): PlanKey | null {
  for (const key of Object.keys(PLANS) as PlanKey[]) {
    if (process.env[PLANS[key].envPrice] === priceId) return key;
  }
  return null;
}
