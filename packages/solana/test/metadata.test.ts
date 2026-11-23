import { describe, expect, it } from "vitest";
import { buildShoeMetadata, shoeMetadataKey } from "../src/metadata";

describe("métadonnées de chaussure", () => {
  const m = buildShoeMetadata({ shoeId: "0b9c7a4e-1111-2222-3333-444455556666", model: "starter", level: 1, imageBaseUrl: "https://nft.walk.test", externalUrl: "https://walk.test" });
  it("pointe vers l'image du niveau", () => expect(m.image).toBe("https://nft.walk.test/shoes/starter/level-1.png"));
  it("porte le niveau et le modèle", () => expect(m.attributes.map((a) => a.value)).toEqual([1, "starter"]));
  it("clé de stockage stable", () => expect(shoeMetadataKey("abc")).toBe("metadata/shoes/abc.json"));
});
