import { normalizeText } from "@/lib/questions";

/**
 * Where is an offer? Job sites write places in many ways: "75 - PARIS 08",
 * "92100 Boulogne-Billancourt", "Puteaux, Hauts-de-Seine", "La Défense".
 * Île-de-France only for now (where the users are): département names and
 * the communes most offers are in. Elsewhere, the city name and the
 * département number still work.
 */

const IDF = ["75", "77", "78", "91", "92", "93", "94", "95"];

const DEPARTMENT_NAMES: Record<string, string> = {
  "75": "paris",
  "77": "seine et marne",
  "78": "yvelines",
  "91": "essonne",
  "92": "hauts de seine",
  "93": "seine saint denis",
  "94": "val de marne",
  "95": "val d oise",
};

const COMMUNES: Record<string, string> = {
  "92":
    "antony,asnieres sur seine,bagneux,bois colombes,boulogne billancourt,boulogne,bourg la reine,chatenay malabry,chatillon,chaville,clamart,clichy,colombes,courbevoie,fontenay aux roses,garches,la garenne colombes,gennevilliers,issy les moulineaux,levallois perret,levallois,malakoff,marnes la coquette,meudon,montrouge,nanterre,neuilly sur seine,le plessis robinson,puteaux,rueil malmaison,saint cloud,sceaux,sevres,suresnes,vanves,vaucresson,ville d avray,villeneuve la garenne,la defense",
  "93":
    "aubervilliers,aulnay sous bois,bagnolet,le blanc mesnil,bobigny,bondy,le bourget,clichy sous bois,la courneuve,drancy,epinay sur seine,gagny,l ile saint denis,les lilas,livry gargan,montfermeil,montreuil,neuilly plaisance,neuilly sur marne,noisy le grand,noisy le sec,pantin,pierrefitte sur seine,le pre saint gervais,le raincy,romainville,rosny sous bois,saint denis,saint ouen,saint ouen sur seine,sevran,stains,tremblay en france,villemomble,villepinte,villetaneuse",
  "94":
    "alfortville,arcueil,boissy saint leger,bonneuil sur marne,bry sur marne,cachan,champigny sur marne,charenton le pont,chennevieres sur marne,chevilly larue,choisy le roi,creteil,fontenay sous bois,fresnes,gentilly,l hay les roses,ivry sur seine,joinville le pont,le kremlin bicetre,kremlin bicetre,limeil brevannes,maisons alfort,nogent sur marne,orly,le perreux sur marne,le plessis trevise,rungis,saint mande,saint maur des fosses,saint maurice,sucy en brie,thiais,valenton,villejuif,villeneuve le roi,villeneuve saint georges,villiers sur marne,vincennes,vitry sur seine",
  "91":
    "evry,evry courcouronnes,massy,palaiseau,orsay,saclay,gif sur yvette,les ulis,courtaboeuf,villebon sur yvette,corbeil essonnes,savigny sur orge,sainte genevieve des bois,viry chatillon,athis mons,juvisy sur orge,draveil,grigny,ris orangis,bretigny sur orge,etampes,longjumeau,montgeron,yerres,igny,verrieres le buisson,wissous,chilly mazarin,morangis,lisses,bondoufle",
  "78":
    "versailles,velizy villacoublay,velizy,saint quentin en yvelines,guyancourt,montigny le bretonneux,saint germain en laye,poissy,mantes la jolie,rambouillet,plaisir,trappes,elancourt,les mureaux,sartrouville,houilles,chatou,le chesnay,viroflay,buc,jouy en josas,le pecq,maisons laffitte,conflans sainte honorine",
  "95":
    "cergy,pontoise,cergy pontoise,argenteuil,sarcelles,garges les gonesse,gonesse,roissy en france,roissy,franconville,ermont,eaubonne,bezons,herblay,saint gratien,enghien les bains,goussainville,montmorency",
  "77":
    "marne la vallee,meaux,melun,chelles,torcy,noisiel,champs sur marne,serris,bussy saint georges,lognes,pontault combault,fontainebleau,savigny le temple,lieusaint,senart,chessy",
};

const has = (text: string, name: string) => ` ${text} `.includes(` ${name} `);

/** Départements a place string points to (may be several: "Clichy, Nanterre"). */
export function departmentsOf(location: string): Set<string> {
  const found = new Set<string>();
  // Postcodes (75002) and département numbers ("- 92", "(93)").
  for (const m of location.matchAll(/(?:^|\D)(\d{2})(\d{3})?(?=\D|$)/g)) found.add(m[1]);
  const text = normalizeText(location);
  for (const [code, name] of Object.entries(DEPARTMENT_NAMES)) if (has(text, name)) found.add(code);
  for (const [code, list] of Object.entries(COMMUNES)) if (list.split(",").some((c) => has(text, c))) found.add(code);
  return found;
}

/** In the account's city or one of its départements. */
export function inArea(location: string | null | undefined, area: { city: string; departments: string[] }): boolean {
  // No city and no department chosen: the whole of France, no area filter.
  if (!area.city.trim() && !area.departments.length) return true;
  if (!location) return false;
  const text = normalizeText(location);
  const city = normalizeText(area.city);
  if (city && has(text, city)) return true;
  const deps = departmentsOf(location);
  if (area.departments.some((d) => deps.has(d))) return true;
  // "Île-de-France" alone: anywhere in the region, fine for a Paris-area search.
  const wholeRegion = /\bile de france\b|\bidf\b|\bparis region\b|\bregion parisienne\b/.test(text) && deps.size === 0;
  return wholeRegion && area.departments.some((d) => IDF.includes(d));
}
