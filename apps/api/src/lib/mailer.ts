import type { FastifyRequest } from "fastify";
import type { Env } from "../env";

export type Lang = "en" | "fr" | "es" | "pt" | "it" | "zh";

/** Langue du navigateur (en-tête Accept-Language), parmi les 6 langues du site ; anglais par défaut. */
export function langOf(req: FastifyRequest): Lang {
  const h = String(req.headers["accept-language"] ?? "").toLowerCase();
  for (const part of h.split(",")) {
    const c = part.trim().slice(0, 2);
    if (c === "fr" || c === "es" || c === "pt" || c === "it" || c === "zh" || c === "en") return c;
  }
  return "en";
}

export async function sendMail(env: Env, to: string, subject: string, text: string): Promise<boolean> {
  if (!env.RESEND_API_KEY || !env.MAIL_FROM) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.MAIL_FROM, to: [to], subject, text }),
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch { return false; }
}

const WELCOME: Record<Lang, (n: string, url: string) => [string, string]> = {
  en: (n, u) => ["Welcome to Neon Soles!", `Hi ${n},\n\nWelcome to the adventure! Your account is ready and your free level 1 starter shoes are waiting.\n\nHow it works: walk outdoors, earn $WALK, upgrade your shoes. Open the app: ${u}\n\nImportant: your wallet secret key was shown only to you when you signed up. We do not have it and cannot recover it. Keep your backup safe and never share it with anyone. We will never ask for it.\n\nSee you on the road,\nThe Neon Soles team`],
  fr: (n, u) => ["Bienvenue dans Neon Soles !", `Bonjour ${n},\n\nBienvenue dans l'aventure ! Ton compte est prêt et tes chaussures de départ de niveau 1, offertes, t'attendent.\n\nComment ça marche : marche dehors, gagne des $WALK, améliore tes chaussures. Ouvre l'appli : ${u}\n\nImportant : la clé secrète de ton wallet ne t'a été montrée qu'à toi, à l'inscription. Nous ne l'avons pas et ne pouvons pas la récupérer. Garde ta sauvegarde en lieu sûr et ne la partage jamais. Nous ne te la demanderons jamais.\n\nÀ bientôt sur la route,\nL'équipe Neon Soles`],
  es: (n, u) => ["¡Bienvenido a Neon Soles!", `Hola ${n},\n\n¡Bienvenido a la aventura! Tu cuenta está lista y tus zapatillas iniciales de nivel 1, gratis, te esperan.\n\nCómo funciona: camina al aire libre, gana $WALK y mejora tus zapatillas. Abre la app: ${u}\n\nImportante: la clave secreta de tu wallet solo se mostró a ti al registrarte. No la tenemos y no podemos recuperarla. Guarda bien tu copia y no la compartas nunca. Nunca te la pediremos.\n\nHasta pronto,\nEl equipo de Neon Soles`],
  pt: (n, u) => ["Bem-vindo à Neon Soles!", `Olá ${n},\n\nBem-vindo à aventura! A tua conta está pronta e as tuas sapatilhas iniciais de nível 1, grátis, esperam por ti.\n\nComo funciona: caminha ao ar livre, ganha $WALK e melhora as tuas sapatilhas. Abre a app: ${u}\n\nImportante: a chave secreta da tua wallet só foi mostrada a ti no registo. Não a temos e não a conseguimos recuperar. Guarda bem a cópia e nunca a partilhes. Nunca a pediremos.\n\nAté já,\nA equipa Neon Soles`],
  it: (n, u) => ["Benvenuto in Neon Soles!", `Ciao ${n},\n\nBenvenuto nell'avventura! Il tuo account è pronto e le tue scarpe iniziali di livello 1, gratuite, ti aspettano.\n\nCome funziona: cammina all'aperto, guadagna $WALK e migliora le scarpe. Apri l'app: ${u}\n\nImportante: la chiave segreta del tuo wallet è stata mostrata solo a te alla registrazione. Non l'abbiamo e non possiamo recuperarla. Conserva il backup e non condividerlo mai. Non te lo chiederemo mai.\n\nA presto,\nIl team Neon Soles`],
  zh: (n, u) => ["欢迎来到 Neon Soles！", `你好 ${n}，\n\n欢迎来到这场冒险！你的账户已就绪，免费的 1 级新手鞋在等你。\n\n玩法：户外步行，赚取 $WALK，升级你的鞋子。打开应用：${u}\n\n重要：注册时钱包私钥只向你一人显示。我们没有它，也无法找回。请妥善保管备份，切勿分享。我们绝不会向你索要。\n\nNeon Soles 团队`],
};
const GOODBYE: Record<Lang, [string, string]> = {
  en: ["Your Neon Soles account was deleted", "Your account and personal data (name, email) were deleted as you asked. If this was not you, contact us right away through our official channels.\n\nThank you for playing."],
  fr: ["Ton compte Neon Soles a été supprimé", "Ton compte et tes données personnelles (nom, email) ont été supprimés comme tu l'as demandé. Si ce n'était pas toi, contacte-nous tout de suite via nos canaux officiels.\n\nMerci d'avoir joué."],
  es: ["Tu cuenta de Neon Soles fue eliminada", "Tu cuenta y tus datos personales (nombre, email) se eliminaron como pediste. Si no fuiste tú, contáctanos de inmediato por nuestros canales oficiales.\n\nGracias por jugar."],
  pt: ["A tua conta Neon Soles foi eliminada", "A tua conta e os teus dados pessoais (nome, email) foram eliminados como pediste. Se não foste tu, contacta-nos de imediato pelos canais oficiais.\n\nObrigado por jogares."],
  it: ["Il tuo account Neon Soles è stato eliminato", "Il tuo account e i dati personali (nome, email) sono stati eliminati come richiesto. Se non sei stato tu, contattaci subito tramite i canali ufficiali.\n\nGrazie per aver giocato."],
  zh: ["你的 Neon Soles 账户已删除", "按你的要求，账户及个人数据（姓名、邮箱）已删除。如非本人操作，请立即通过官方渠道联系我们。\n\n感谢你的游玩。"],
};

export function sendWelcome(env: Env, to: string, firstName: string, lang: Lang) {
  const [subject, text] = WELCOME[lang](firstName.slice(0, 40), env.APP_ORIGIN);
  return sendMail(env, to, subject, text);
}
export function sendGoodbye(env: Env, to: string, lang: Lang) {
  const [subject, text] = GOODBYE[lang];
  return sendMail(env, to, subject, text);
}
