// ─── Commission Tier System ───────────────────────────────────────────────────

export type CommissionTier = {
  id: string;
  label: string;
  minAmount: number;
  maxAmount: number | null; // null = unbegrenzt
  rate: number;             // Prozentsatz, z.B. 15 für 15 %
  active: boolean;
};

export type PayoutStatus =
  | "zahlung_offen"
  | "bezahlt"
  | "provision_verbucht"
  | "auszahlung_ausstehend"
  | "auszahlung_freigegeben"
  | "auszahlung_abgeschlossen"
  | "storniert";

export type Transaction = {
  id: string;
  listing: string;
  buyer: string;
  provider: string;
  amount: number;
  rate: number;
  commission: number;
  payout: number;
  status: PayoutStatus;
  date: string;
  category: string;
};

// ─── Default Staffelung ───────────────────────────────────────────────────────

export const defaultTiers: CommissionTier[] = [
  { id: "t1", label: "Mikro",  minAmount: 0,    maxAmount: 100,  rate: 15, active: true },
  { id: "t2", label: "Klein",  minAmount: 101,  maxAmount: 500,  rate: 12, active: true },
  { id: "t3", label: "Mittel", minAmount: 501,  maxAmount: 2000, rate: 10, active: true },
  { id: "t4", label: "Groß",   minAmount: 2001, maxAmount: null, rate: 8,  active: true },
];

// ─── Berechnung ───────────────────────────────────────────────────────────────

export function getCommissionRate(amount: number, tiers: CommissionTier[] = defaultTiers): number {
  const active = tiers.filter(t => t.active);
  const tier = active.find(t =>
    amount >= t.minAmount && (t.maxAmount === null || amount <= t.maxAmount)
  );
  return tier?.rate ?? 10;
}

export function calculateCommission(amount: number, tiers: CommissionTier[] = defaultTiers) {
  const rate = getCommissionRate(amount, tiers);
  const commission = Math.round(amount * rate) / 100;
  const payout = amount - commission;
  return { rate, commission, payout };
}

export function getTierForAmount(amount: number, tiers: CommissionTier[] = defaultTiers): CommissionTier | undefined {
  return tiers.filter(t => t.active).find(t =>
    amount >= t.minAmount && (t.maxAmount === null || amount <= t.maxAmount)
  );
}

