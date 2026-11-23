import { describe, expect, it } from "vitest";
import { type ParsedTxLike, verifyPayment } from "../src/payment-verify";

const market = { payer: "BUYER", mint: "MINT", transfers: [{ destinationAta: "SATA", amountBase: 500_000_000n }], sol: { destination: "TREAS", minLamports: 10_000_000n }, memo: "walk:mkt:L1:abc" };
const ix = (program: string, parsed: unknown) => ({ program, parsed });
const tr = (dest: string, amount: string, authority = "BUYER", mint = "MINT") => ix("spl-token", { type: "transferChecked", info: { authority, destination: dest, mint, tokenAmount: { amount } } });
const sol = (lamports: number, destination = "TREAS") => ix("system", { type: "transfer", info: { source: "BUYER", destination, lamports } });
const tx = (...instructions: ReturnType<typeof ix>[]): ParsedTxLike => ({ meta: { err: null }, transaction: { message: { instructions } } });
const good = () => tx(tr("SATA", "500000000"), sol(10_000_000), ix("spl-memo", "walk:mkt:L1:abc"));

describe("place de marché", () => {
  it("accepte un paiement exact, ou avec des frais plus élevés", () => {
    expect(verifyPayment(good(), market).ok).toBe(true);
    expect(verifyPayment(tx(tr("SATA", "500000000"), sol(50_000_000), ix("spl-memo", "walk:mkt:L1:abc")), market).ok).toBe(true);
  });
  it("refuse frais insuffisants, mauvais montant, mauvais vendeur, mauvais mint, mauvais payeur", () => {
    const memo = ix("spl-memo", "walk:mkt:L1:abc");
    expect(verifyPayment(tx(tr("SATA", "500000000"), sol(9_999_999), memo), market).ok).toBe(false);
    expect(verifyPayment(tx(tr("SATA", "499999999"), sol(10_000_000), memo), market).ok).toBe(false);
    expect(verifyPayment(tx(tr("OTHER", "500000000"), sol(10_000_000), memo), market).ok).toBe(false);
    expect(verifyPayment(tx(tr("SATA", "500000000", "BUYER", "FAKE"), sol(10_000_000), memo), market).ok).toBe(false);
    expect(verifyPayment(tx(tr("SATA", "500000000", "THIEF"), sol(10_000_000), memo), market).ok).toBe(false);
    expect(verifyPayment(tx(tr("SATA", "500000000"), sol(10_000_000, "ELSE"), memo), market).ok).toBe(false);
  });
  it("refuse un autre mémo, une transaction échouée ou absente", () => {
    expect(verifyPayment(tx(tr("SATA", "500000000"), sol(10_000_000), ix("spl-memo", "walk:mkt:L2:zzz")), market).ok).toBe(false);
    expect(verifyPayment({ ...good(), meta: { err: { InstructionError: [0, "x"] } } }, market).ok).toBe(false);
    expect(verifyPayment(null, market).ok).toBe(false);
  });
});

describe("boutique de chaussures : pool + trésorerie + brûlage", () => {
  const shop = { payer: "BUYER", mint: "MINT", transfers: [{ destinationAta: "POOL", amountBase: 40n }, { destinationAta: "TREA", amountBase: 20n }], burnBase: 40n, memo: "walk:shop:o1" };
  const burn = (amount: string) => ix("spl-token", { type: "burnChecked", info: { authority: "BUYER", mint: "MINT", tokenAmount: { amount } } });
  const memo = ix("spl-memo", "walk:shop:o1");
  it("accepte la répartition exacte", () => expect(verifyPayment(tx(burn("40"), tr("POOL", "40"), tr("TREA", "20"), memo), shop).ok).toBe(true));
  it("refuse si le brûlage manque ou si un transfert est faux", () => {
    expect(verifyPayment(tx(tr("POOL", "40"), tr("TREA", "20"), memo), shop).ok).toBe(false);
    expect(verifyPayment(tx(burn("39"), tr("POOL", "40"), tr("TREA", "20"), memo), shop).ok).toBe(false);
    expect(verifyPayment(tx(burn("40"), tr("POOL", "40"), tr("TREA", "19"), memo), shop).ok).toBe(false);
  });
  it("un même transfert ne compte pas deux fois", () => {
    const both = { ...shop, transfers: [{ destinationAta: "POOL", amountBase: 40n }, { destinationAta: "POOL", amountBase: 40n }] };
    expect(verifyPayment(tx(burn("40"), tr("POOL", "40"), memo), both).ok).toBe(false);
  });
});
