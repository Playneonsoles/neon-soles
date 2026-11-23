import { createHash } from "node:crypto";
import {
  create, createCollection, fetchCollection, mplCore, ruleSet,
} from "@metaplex-foundation/mpl-core";
import {
  type Umi, createSignerFromKeypair, generateSigner, keypairIdentity, publicKey,
} from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";

/** Umi avec le wallet « minter » comme payeur et signataire. */
export function makeUmi(rpcUrl: string, minterSecretKey: Uint8Array): Umi {
  const umi = createUmi(rpcUrl).use(mplCore());
  umi.use(keypairIdentity(umi.eddsa.createKeypairFromSecretKey(minterSecretKey)));
  return umi;
}

const delegate = (address: string) => ({ type: "Address" as const, address: publicKey(address) });

/**
 * Crée les deux collections (chaussures et pièces) avec des délégués permanents de transfert et de brûlage
 * (plus gel pour les pièces), comme au chapitre 8. Les pièces portent 5 % de redevances vers la trésorerie.
 * Le minter est autorité de mise à jour (il doit pouvoir créer et mettre à jour les NFT).
 */
export async function createCollections(
  umi: Umi, o: { delegate: string; treasury: string; shoeUri: string; partUri: string },
) {
  const shoes = generateSigner(umi);
  await createCollection(umi, {
    collection: shoes, name: "$WALK Shoes", uri: o.shoeUri,
    plugins: [
      { type: "PermanentTransferDelegate", authority: delegate(o.delegate) },
      { type: "PermanentBurnDelegate", authority: delegate(o.delegate) },
    ],
  }).sendAndConfirm(umi);

  const parts = generateSigner(umi);
  await createCollection(umi, {
    collection: parts, name: "$WALK Parts", uri: o.partUri,
    plugins: [
      { type: "PermanentFreezeDelegate", frozen: false, authority: delegate(o.delegate) },
      { type: "PermanentTransferDelegate", authority: delegate(o.delegate) },
      { type: "PermanentBurnDelegate", authority: delegate(o.delegate) },
      {
        type: "Royalties", basisPoints: 500, ruleSet: ruleSet("None"),
        creators: [{ address: publicKey(o.treasury), percentage: 100 }],
      },
    ],
  }).sendAndConfirm(umi);

  return { shoeCollection: shoes.publicKey.toString(), partCollection: parts.publicKey.toString() };
}

/**
 * Adresse du NFT dérivée de (clé du minter, identifiant du job) : un nouvel essai après un échec partiel
 * retombe sur la même adresse, donc ne peut jamais créer un second NFT pour la même chaussure.
 */
export function deriveAssetSigner(umi: Umi, minterSecretKey: Uint8Array, jobId: string) {
  const seed = createHash("sha256").update(minterSecretKey).update(`mint_shoe:${jobId}`).digest();
  return createSignerFromKeypair(umi, umi.eddsa.createKeypairFromSeed(new Uint8Array(seed)));
}

/**
 * Crée la chaussure de départ en NFT Metaplex Core, dans le wallet du joueur.
 * Liée au compte (soulbound) : délégué de gel permanent, gelé dès la création. Niveau écrit on-chain (Attributes).
 * Idempotent : si le NFT existe déjà, renvoie son adresse sans rien envoyer en chaîne.
 */
export async function mintShoe(
  umi: Umi,
  o: { minterSecretKey: Uint8Array; jobId: string; owner: string; collection: string; name: string; uri: string; level: number; model: string },
): Promise<{ assetId: string; created: boolean }> {
  const asset = deriveAssetSigner(umi, o.minterSecretKey, o.jobId);
  if ((await umi.rpc.getAccount(asset.publicKey)).exists) return { assetId: asset.publicKey.toString(), created: false };

  const collection = await fetchCollection(umi, publicKey(o.collection));
  await create(umi, {
    asset, collection, name: o.name, uri: o.uri, owner: publicKey(o.owner),
    plugins: [
      { type: "PermanentFreezeDelegate", frozen: true, authority: delegate(umi.identity.publicKey.toString()) },
      { type: "Attributes", attributeList: [{ key: "level", value: String(o.level) }, { key: "model", value: o.model }] },
    ],
  }).sendAndConfirm(umi);
  return { assetId: asset.publicKey.toString(), created: true };
}
