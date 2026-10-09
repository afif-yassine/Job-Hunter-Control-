import { mkdir, writeFile, readFile } from 'node:fs/promises';

// Synthetic fixtures only. No database access, production changes or retries.
const models = [
  { id: 'mistral/mistral-nemo', provider: 'deepinfra', input: .04, output: .17 },
  { id: 'alibaba/qwen3.7-flash', provider: 'alibaba', input: .03, output: .13, reasoning: { enabled: false } },
  { id: 'deepseek/deepseek-v4-flash-0731', provider: 'deepinfra', input: .08, output: .18, reasoning: { enabled: false } },
  { id: 'openai/gpt-oss-20b', provider: 'deepinfra', input: .03, output: .14, reasoning: { effort: 'low' } },
  { id: 'nvidia/nemotron-3.5-lightning', provider: 'deepinfra', input: .05, output: .20, reasoning: { enabled: false } },
];
const offers = [
  ['Développeur', 'Alternance à Lyon, bac+3, Python et SQL, 12 mois, télétravail partiel.', ['python', 'sql'], 'bac+3', 'partiel'],
  ['Comptable', 'Stage à Paris, bac+2, Excel, rapprochements bancaires. Durée 4 mois.', ['excel'], 'bac+2', null],
  ['Marketing', 'Alternance à Lille, bac+3, SEO et Google Analytics, 24 mois.', ['seo', 'google analytics'], 'bac+3', null],
  ['Commercial', 'Stage à Nantes, prospection et Salesforce, anglais demandé.', ['salesforce', 'anglais'], null, null],
  ['Data analyst', 'Stage à Bordeaux, bac+5, Python, SQL, Power BI. Aucun télétravail.', ['python', 'sql', 'power bi'], 'bac+5', 'non'],
  ['RH', 'Alternance à Rennes, bac+3, recrutement, Excel. Rythme 3 jours entreprise et 2 école.', ['excel'], 'bac+3', null],
  ['Designer', 'Stage à Toulouse, Figma, portfolio demandé. Télétravail total.', ['figma'], null, 'total'],
  ['Logistique', 'Alternance à Marseille, bac+2, gestion des stocks et SAP.', ['sap'], 'bac+2', null],
  ['Communication', 'Stage à Nice, rédaction et Canva. Gratification 700 euros mensuels.', ['canva'], null, null],
  ['Support', 'Alternance à Strasbourg, Windows, anglais, bac+2. Salaire non précisé.', ['windows', 'anglais'], 'bac+2', null],
];
const profiles = [
  { name: 'Profil fictif A', education: 'Licence informatique', skills: ['python', 'sql'], evidence: ['Projet universitaire : tableau de bord Python et SQL.'] },
  { name: 'Profil fictif B', education: 'BTS comptabilité', skills: ['excel'], evidence: ['Projet scolaire : rapprochements bancaires sur Excel.'] },
  { name: 'Profil fictif C', education: 'Licence marketing', skills: ['seo', 'canva'], evidence: ['Association étudiante : rédaction de publications avec Canva.'] },
];
const cases = offers.map(([title, description, skills, level, remote], i) => ({
  id: `extraction-${i + 1}`, task: 'extraction', expected: { skills, level, remote }, max: 700,
  prompt: `Extrais uniquement les faits explicites. JSON strict : missions:string[], skills:string[], level:string|null, remote:"non"|"partiel"|"total"|null, conditions:string. Aucune invention. Compétences en minuscules. OFFRE=${JSON.stringify({ title, description })}`,
}));
for (let p = 0; p < 3; p++) for (let o = 0; o < 2; o++) cases.push({
  id: `redaction-${p + 1}-${o + 1}`, task: 'writing', max: 1600,
  prompt: `Rédige en français un CV court et une lettre de 170 à 240 mots pour cette offre. Utilise exclusivement les faits du profil fictif, même s'il correspond mal : aucune expérience, certification ou chiffre inventé. JSON strict {cv:{title:string,summary:string,skills:string[],experience:string[]},cover_letter:string,unresolved_questions:string[]}. PROFIL=${JSON.stringify(profiles[p])} OFFRE=${JSON.stringify(offers[p * 2 + o].slice(0, 2))}`,
});
const cleanExtraction = process.argv.includes('--clean-extraction');
const structured = process.argv.includes('--structured') || cleanExtraction;
if (cleanExtraction) cases.splice(10);
if (structured) for (const c of cases) {
  c.id += cleanExtraction ? '-clean' : '-structured';
  c.prompt += '\nRetourne exclusivement un objet JSON, sans Markdown ni balises. Ne déduis jamais absence de télétravail si non précisé.';
  if (c.task === 'writing') c.prompt += ' Le diplôme du profil est une formation, pas une preuve de diplôme obtenu. Ne transforme pas un outil demandé par l’offre en compétence du candidat. Une mobilité ou disponibilité non confirmée reste une question.';
  else c.prompt += ' skills contient toutes les compétences et tous les outils explicitement demandés dans l’offre. level contient le niveau bac+N exact ou null. conditions reste une chaîne de caractères. Exemple de forme : {"missions":[],"skills":[],"level":null,"remote":null,"conditions":""}.';
}
const ceiling = 1;
// Reserve using UTF-8 byte count as a conservative input-token estimate,
// plus overhead; reserve ALL capped output tokens, including reasoning.
const reserve = (m, c) => ((Buffer.byteLength(c.prompt) + 1024) * m.input + c.max * m.output) / 1e6;
const planned = models.reduce((sum, m) => sum + cases.reduce((n, c) => n + reserve(m, c), 0), 0);
console.log(JSON.stringify({ calls: models.length * cases.length, ceilingUsd: ceiling, conservativeReservationUsd: planned, credentialsAvailable: Boolean(process.env.AI_GATEWAY_API_KEY), live: process.argv.includes('--run') }));
if (planned > ceiling) throw new Error('Plan exceeds budget; no calls made.');
if (!process.argv.includes('--run')) process.exit(0);
if (!process.env.AI_GATEWAY_API_KEY) throw new Error('Configure AI_GATEWAY_API_KEY privately in .env.ai-test.local; no calls made.');
// Verify availability and enforce prices before the first billable request.
const catalogResponse = await fetch('https://ai-gateway.vercel.sh/v1/models', { signal: AbortSignal.timeout(20000) });
if (!catalogResponse.ok) throw new Error('Model catalog unavailable; no paid calls made.');
const catalog = await catalogResponse.json();
for (const m of models) {
  const live = catalog.data?.find(x => x.id === m.id);
  const input = Number(live?.pricing?.input) * 1e6;
  const output = Number(live?.pricing?.output) * 1e6;
  if (!live || !Number.isFinite(input) || !Number.isFinite(output) || input > m.input + 1e-8 || output > m.output + 1e-8)
    throw new Error(`Price/availability requires review for ${m.id}; no paid calls made.`);
}
await mkdir('test-results/ai-comparison', { recursive: true });
const resultPath = 'test-results/ai-comparison/results.json';
let previous;
try { previous = JSON.parse(await readFile(resultPath, 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const results = previous?.results ?? [];
let reserved = previous?.reservedUsd ?? 0;
const save = () => writeFile(resultPath, JSON.stringify({ ceilingUsd: ceiling, reservedUsd: reserved, results }, null, 2));
for (const m of models) for (const c of cases) {
  if (results.some(r => r.model === m.id && r.case === c.id)) continue;
  const charge = reserve(m, c);
  if (reserved + charge > ceiling) throw new Error('Local budget exhausted.');
  reserved += charge; // Never release reservation after failures; no retries.
  const record = { model: m.id, case: c.id, task: c.task, status: 'pending', reservationUsd: charge };
  results.push(record);
  await save(); // Persist before dispatch; interrupted requests must not be repeated.
  const started = Date.now();
  try {
  const response = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
    method: 'POST', signal: AbortSignal.timeout(90000),
    headers: { authorization: `Bearer ${process.env.AI_GATEWAY_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: m.id, messages: [{ role: 'user', content: c.prompt }], max_tokens: c.max,
      ...(m.reasoning ? { reasoning: m.reasoning } : {}),
      ...(structured ? { response_format: { type: 'json_object' } } : {}),
      providerOptions: { gateway: { only: [m.provider] } } }),
  });
  if (!response.ok) {
    record.status = 'http-error'; record.httpStatus = response.status;
    await save();
    console.log(`${m.id} ${c.id}: HTTP ${response.status}`);
    if ([401, 402, 403, 429].includes(response.status)) throw new Error('Authentication, credit or rate limit; stopped.');
    continue;
  }
  const body = await response.json();
  const text = body.choices?.[0]?.message?.content ?? '';
  let parsed = null;
  try { parsed = JSON.parse(text); } catch { /* Recorded failure, no repair call. */ }
  const missing = c.expected ? c.expected.skills.filter(s => !parsed?.skills?.some(t => String(t).toLowerCase() === s)) : [];
  Object.assign(record, { status: 'completed', elapsedMs: Date.now() - started,
    usage: body.usage, estimatedUsd: body.usage ? (body.usage.prompt_tokens * m.input + body.usage.completion_tokens * m.output) / 1e6 : null,
    jsonValid: parsed !== null, expected: c.expected, missingSkills: missing,
    levelCorrect: c.expected ? parsed?.level === c.expected.level : null,
    remoteCorrect: c.expected ? parsed?.remote === c.expected.remote : null,
    finishReason: body.choices?.[0]?.finish_reason, output: text });
  await save();
  console.log(`${m.id} ${c.id}: JSON ${parsed !== null ? 'OK' : 'INVALID'}`);
  } catch (error) {
    if (record.status === 'http-error') throw error;
    record.status = 'request-error'; record.errorType = error.name;
    await save();
    console.log(`${m.id} ${c.id}: ${error.name}, no retry`);
  }
}
console.log('Completed. Human review of factual accuracy and French writing still required.');
