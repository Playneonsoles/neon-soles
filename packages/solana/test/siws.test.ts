import bs58 from "bs58";
import nacl from "tweetnacl";
import { describe, expect, it } from "vitest";
import { buildSignInMessage, isValidSolanaAddress, verifyWalletSignature } from "../src";

const kp = nacl.sign.keyPair();
const address = bs58.encode(kp.publicKey);
const fields = { domain: "walk.example", address, nonce: "abc123", issuedAt: "2026-11-22T10:00:00.000Z" };
const sign = (m: string) => Buffer.from(nacl.sign.detached(new TextEncoder().encode(m), kp.secretKey)).toString("base64");

describe("SIWS", () => {
  it("accepte une signature valide", () => {
    const msg = buildSignInMessage(fields);
    expect(verifyWalletSignature(msg, sign(msg), address)).toBe(true);
  });
  it("respecte le format SIWS strict attendu par les wallets", () => {
    const lines = buildSignInMessage(fields).split("\n");
    expect(lines[0]).toBe("walk.example wants you to sign in with your Solana account:");
    expect(lines[1]).toBe(address);
    expect(lines).toContain("URI: https://walk.example");
    expect(lines).toContain("Version: 1");
    expect(lines).toContain("Chain ID: mainnet");
    expect(lines).toContain("Nonce: abc123");
    expect(lines).toContain("Issued At: 2026-11-22T10:00:00.000Z");
  });
  it("refuse si le nonce ou le domaine change", () => {
    const sig = sign(buildSignInMessage(fields));
    expect(verifyWalletSignature(buildSignInMessage({ ...fields, nonce: "autre" }), sig, address)).toBe(false);
    expect(verifyWalletSignature(buildSignInMessage({ ...fields, domain: "evil.test" }), sig, address)).toBe(false);
  });
  it("refuse la signature d'un autre wallet", () => {
    const other = nacl.sign.keyPair();
    const msg = buildSignInMessage(fields);
    const sig = Buffer.from(nacl.sign.detached(new TextEncoder().encode(msg), other.secretKey)).toString("base64");
    expect(verifyWalletSignature(msg, sig, address)).toBe(false);
  });
  it("refuse une signature mal formée", () => {
    expect(verifyWalletSignature("x", "pas-du-base64!!", address)).toBe(false);
  });
  it("valide les adresses", () => {
    expect(isValidSolanaAddress(address)).toBe(true);
    expect(isValidSolanaAddress("0xabc")).toBe(false);
    expect(isValidSolanaAddress("")).toBe(false);
  });
});
