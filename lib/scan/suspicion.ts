/**
 * Cheap, deterministic scam signals, checked before any AI call.
 * "high" = the offer is put aside for the user (and never sent to Gemini until
 * they clear it); "low" = a hint passed to Gemini, which decides.
 * Never a verdict: a flagged offer goes to "À vérifier", it is not deleted.
 */

export type Suspicion = { level: "none" | "low" | "high"; reasons: string[] };

const HIGH: { test: RegExp; reason: string }[] = [
  {
    test: /(vous (devez|devrez|aurez [àa]) (payer|r[ée]gler|verser|avancer)|[àa] la charge du candidat|frais d.inscription (de|:)?\s*\d|avancer (les|des) frais|acheter (votre|le|du) (mat[ée]riel|kit|ordinateur))/i,
    reason: "Un paiement est demandé au candidat",
  },
  {
    test: /(r[ée]ception(ner)? (de|des) colis|r[ée]exp[ée]di(er|tion) (de |des )?colis|encaisser (des |un )?ch[èe]ques?|western union|mandat cash|transcash|carte[s]? (cadeau|pcs))/i,
    reason: "Mission typique des arnaques (colis, chèques, cartes prépayées)",
  },
  {
    test: /(transf[ée]r(er|ts?) d.argent|recevoir (des|de l.) (fonds|argent) sur (votre|ton) compte|agent de paiement)/i,
    reason: "Demande de faire transiter de l’argent",
  },
];

const MEDIUM: { test: RegExp; reason: string }[] = [
  { test: /\b(whats ?app|telegram|signal)\b/i, reason: "Contact demandé par messagerie (WhatsApp/Telegram)" },
  {
    test: /[\w.+-]+@(gmail|hotmail|yahoo|outlook|live|icloud|laposte|orange|free|sfr|wanadoo|aol)\.[a-z]{2,}/i,
    reason: "Adresse e-mail personnelle au lieu du domaine de l’entreprise",
  },
  { test: /(gagne[rz]? jusqu.?[àa]|revenus? (garanti|illimit)|argent facile|devenez riche)/i, reason: "Promesse de gains" },
  { test: /(sans (aucun )?entretien|embauche imm[ée]diate sans|aucune exp[ée]rience ni dipl[ôo]me requis)/i, reason: "Recrutement sans aucune sélection" },
];

/** Monthly pay far above what an apprenticeship or internship pays. */
function unrealisticPay(text: string): boolean {
  for (const m of text.matchAll(/(\d[\d\s.]{2,7})\s?(?:€|euros?)\s*(?:brut|net)?\s*(?:\/|par)\s*(mois|semaine|jour)/gi)) {
    const amount = Number(m[1].replace(/[\s.]/g, ""));
    const per = m[2].toLowerCase();
    const monthly = per === "mois" ? amount : per === "semaine" ? amount * 4.3 : amount * 21;
    if (monthly > 4500) return true;
  }
  return false;
}

export function detectSuspicion(offer: {
  title?: string | null;
  company?: string | null;
  contract_type?: string | null;
  description?: string | null;
}): Suspicion {
  const text = `${offer.title || ""}\n${offer.description || ""}`;
  const reasons: string[] = [];
  let high = false;
  for (const rule of HIGH)
    if (rule.test.test(text)) {
      reasons.push(rule.reason);
      high = true;
    }
  let medium = 0;
  for (const rule of MEDIUM)
    if (rule.test.test(text)) {
      reasons.push(rule.reason);
      medium += 1;
    }
  if (/(alternan|apprenti|stage|stagiaire|intern)/i.test(`${offer.title} ${offer.contract_type}`) && unrealisticPay(text)) {
    reasons.push("Rémunération irréaliste pour une alternance ou un stage");
    medium += 1;
  }
  if (high || medium >= 2) return { level: "high", reasons };
  if (medium === 1) return { level: "low", reasons };
  return { level: "none", reasons: [] };
}
