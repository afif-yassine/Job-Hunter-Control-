/**
 * One place for the product name and the legal identity shown on the public
 * pages. The name is provisional (jinnjob.com belongs to another AI product):
 * renaming the brand is a change here, plus the logo.
 */
export const BRAND = {
  name: "JinnJob",
  /** Publisher of the site (LCEN art. 6): an individual while the product is in its free test phase. */
  publisher: "Yassine Afif",
  publisherStatus: "Particulier, projet en phase de test, sans activité commerciale",
  contactEmail: "yassine.afif.ma@gmail.com",
  siteUrl: "https://job-hunter-control.vercel.app",
  /** Date shown at the top of the legal pages; update it with every change of their content. */
  legalUpdatedAt: "4 octobre 2026",
} as const;

export const HOSTS = [
  {
    role: "Hébergement du site",
    name: "Vercel Inc.",
    address: "440 N Barranca Avenue #4133, Covina, CA 91723, États-Unis",
    url: "https://vercel.com",
  },
  {
    role: "Base de données et comptes (serveurs dans l’Union européenne, Irlande)",
    name: "Supabase Inc.",
    address: "970 Toa Payoh North #07-04, Singapour 318992",
    url: "https://supabase.com",
  },
  {
    role: "Service de lecture des formulaires de candidature",
    name: "Railway Corporation",
    address: "San Francisco, Californie, États-Unis",
    url: "https://railway.com",
  },
] as const;
