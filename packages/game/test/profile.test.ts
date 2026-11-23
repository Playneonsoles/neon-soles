import { describe, expect, it } from "vitest";
import { AVATARS, COUNTRY_CODES, handleError, normalizeHandle, profileSchema, resolveShoeVisual } from "../src/profile";

describe("profil", () => {
  it("normalise le nom avec @ et minuscules", () => {
    expect(normalizeHandle("  Marie_B ")).toBe("@marie_b");
    expect(normalizeHandle("@Marie_B")).toBe("@marie_b");
  });
  it("refuse les noms invalides ou réservés", () => {
    expect(handleError("ab")).not.toBeNull();
    expect(handleError("a b c")).not.toBeNull();
    expect(handleError("admin")).not.toBeNull();
    expect(handleError("_toto")).not.toBeNull();
    expect(handleError("to__to")).not.toBeNull();
    expect(handleError("marie_b")).toBeNull();
  });
  it("accepts a valid profile and rejects an unknown avatar", () => {
    const ok = profileSchema.safeParse({ pseudo: "Marie_B", avatar: 3 });
    expect(ok.success).toBe(true);
    if (ok.success) { expect(ok.data.pseudo).toBe("@marie_b"); }
    expect(profileSchema.safeParse({ pseudo: "marie_b", avatar: AVATARS.length }).success).toBe(false);
  });
  it("liste de pays sans doublon", () => {
    expect(new Set(COUNTRY_CODES).size).toBe(COUNTRY_CODES.length);
    expect(COUNTRY_CODES).toContain("FR");
  });
  it("les caractéristiques de la chaussure priment sur le niveau", () => {
    expect(resolveShoeVisual(1, {}).effects).toHaveLength(0);
    expect(resolveShoeVisual(1, { effects: ["wings"], color: "#FF00AA" })).toMatchObject({ color: "#FF00AA", effects: ["wings"] });
    expect(resolveShoeVisual(20, null).effects).toContain("halo");
    expect(resolveShoeVisual(5, { color: "red" }).color).toBe("#39FF88"); // invalide → retombe sur le niveau
  });
});
