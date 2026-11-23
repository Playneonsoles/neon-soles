# Neon Soles ($WALK) : code ouvert pour vérification

Ce dépôt permet à chacun de **vérifier que le projet n'est pas une arnaque** : on peut lire comment les gains sont calculés,
comment les $WALK sont versés, dépensés, brûlés et retirés.

Site : https://playneonsoles.com

## Ce que vous pouvez vérifier
- **Pas de clé privée de joueur** : pour un compte par email, la clé est créée dans le navigateur (`apps/web/lib/localWallet.ts`), le serveur ne reçoit que l'adresse publique.
- **Formules de gains** : `packages/game` (minutes × niveau × rareté × série, pool quotidien fixe partagé au prorata).
- **Pas de création de tokens** : les récompenses viennent d'une réserve fixe (`apps/worker`, `packages/db`).
- **Dépenses** : 40 % brûlés, 40 % vers le pool, 20 % vers la trésorerie (`packages/solana/src/payment-verify.ts`, `apps/api/src/routes/upgrades.ts`, `apps/api/src/routes/market.ts`).
- **Retraits** : minimum, frais et limites visibles dans `apps/api/src/routes/claims.ts`, `packages/db/src/claims.ts` et `apps/worker/src/claims.ts`.

## Ce qui est volontairement masqué
Les éléments dont la publication aiderait des pirates ou des tricheurs sont remplacés par la mention **REDACTED**
(« donnée remplacée car trop risquée à publier ») : seuils anti-triche, limites de débit, liste anti-emails jetables,
console d'administration, scripts de déploiement et de durcissement du serveur, secrets.
Rien de tout cela ne concerne l'argent des joueurs.

Projet jeune, aucune garantie de rendement. DYOR. Licence : tous droits réservés (voir `LICENSE`). Le code est publié pour vérification uniquement.
