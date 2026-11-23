import { describe, expect, it } from "vitest";
import { isOriginAllowed } from "../src/lib/origin";

const site = "https://walk.example";
describe("garde d'origine (CSRF)", () => {
  it("laisse passer les lectures", () => expect(isOriginAllowed("GET", "https://evil.test", site)).toBe(true));
  it("accepte une écriture venant du site", () => expect(isOriginAllowed("POST", site, site)).toBe(true));
  it("refuse une écriture venant d'un autre site", () => expect(isOriginAllowed("POST", "https://evil.test", site)).toBe(false));
  it("refuse aussi DELETE et PUT d'un autre site", () => {
    expect(isOriginAllowed("DELETE", "https://evil.test", site)).toBe(false);
    expect(isOriginAllowed("put", "null", site)).toBe(false);
  });
  it("accepte une écriture sans Origin (curl, serveur)", () => expect(isOriginAllowed("POST", undefined, site)).toBe(true));
});
