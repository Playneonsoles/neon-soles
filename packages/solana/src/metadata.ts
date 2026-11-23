export interface ShoeMetadataInput {
  shoeId: string;
  model: string;
  level: number;
  imageBaseUrl: string; // ex. https://nft.walk.example
  externalUrl: string; // ex. https://walk.example
}

/** JSON de métadonnées d'une chaussure (standard Metaplex), hébergé dans Object Storage. */
export function buildShoeMetadata(i: ShoeMetadataInput) {
  const image = `${i.imageBaseUrl}/shoes/${i.model}/level-${i.level}.png`;
  return {
    name: `$WALK Shoes #${i.shoeId.slice(0, 8)}`,
    symbol: "WALK",
    description: "Paire de chaussures $WALK : marche chaque jour pour la faire monter de niveau.",
    image,
    external_url: i.externalUrl,
    attributes: [
      { trait_type: "Niveau", value: i.level },
      { trait_type: "Model", value: i.model },
    ],
    properties: { category: "image", files: [{ uri: image, type: "image/png" }] },
  };
}

export const shoeMetadataKey = (shoeId: string) => `metadata/shoes/${shoeId}.json`;
