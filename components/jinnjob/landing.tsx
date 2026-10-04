"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  FileText,
  MapPin,
  Moon,
  RotateCcw,
  Sun,
} from "lucide-react";
import s from "./landing.module.css";

/** Two complementary ribbons: the profile and the opportunity meet. */
function Declic({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`${s.declic} ${className}`}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
    >
      <path
        className={s.ribbonOne}
        d="M8 10h14v25a7 7 0 0 0 7 7h25v14H29A21 21 0 0 1 8 35V10Z"
        fill="currentColor"
      />
      <path
        className={s.ribbonTwo}
        d="M29 8h27v27H42V22H29V8Z"
        fill="currentColor"
      />
      <path
        className={s.connection}
        d="m28 35 12-12"
        stroke="currentColor"
        strokeWidth="8"
      />
    </svg>
  );
}

function Opening({ onComplete }: { onComplete: () => void }) {
  useEffect(() => {
    document.cookie = `lbt-home-intro=1; Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    const timer = window.setTimeout(onComplete, 2200);
    return () => window.clearTimeout(timer);
  }, [onComplete]);
  return (
    <div className={s.opening} data-home-opening="true">
      <div className={s.coverLeft} aria-hidden="true">
        <span />
      </div>
      <div className={s.coverRight} aria-hidden="true">
        <span />
      </div>
      <div className={s.openingTitle} aria-hidden="true">
        <Declic />
        <span>
          lebon<em>taf</em>.
        </span>
        <p>
          Un nouveau chapitre.
          <br />
          <em>Le tien.</em>
        </p>
        <small>STAGE · ALTERNANCE · PREMIER PAS</small>
      </div>
      <button type="button" className={s.skipIntro} onClick={onComplete}>
        Passer l’introduction <ArrowRight size={16} />
      </button>
    </div>
  );
}

function Brand() {
  return (
    <Link className={s.brand} href="/accueil" aria-label="LeBonTaf, accueil">
      <Declic />
      <span>
        lebon<span className={s.brandItalic}>taf</span>
        <span className={s.brandDot}>.</span>
      </span>
    </Link>
  );
}

const examples = {
  alternance: {
    contract: "Alternance",
    title: "Développeur·se front-end",
    company: "Atelier numérique",
    location: "Paris · Hybride",
    duration: "12 mois",
    skills: ["React", "TypeScript", "UI / UX"],
    initial: "an",
    cv: "Développement front-end",
    sentence:
      "Tes projets React et ton sens de l’interface ont leur place ici.",
  },
  stage: {
    contract: "Stage",
    title: "Assistant·e data analyst",
    company: "Studio des données",
    location: "Lyon · Hybride",
    duration: "6 mois",
    skills: ["Python", "SQL", "Analyse"],
    initial: "sd",
    cv: "Analyse de données",
    sentence:
      "Tes projets Python et tes compétences SQL font le lien avec cette offre.",
  },
};

export function Landing({
  initialTheme = "light",
  initialOpening = true,
}: {
  initialTheme?: "light" | "dark";
  initialOpening?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState(initialTheme);
  const [kind, setKind] = useState<keyof typeof examples>("alternance");
  const [opening, setOpening] = useState(initialOpening);
  const [openingVersion, setOpeningVersion] = useState(0);
  const closeOpening = useCallback(() => setOpening(false), []);
  useEffect(() => {
    const root = rootRef.current;
    if (
      !root ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !("IntersectionObserver" in window)
    )
      return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).dataset.revealed = "true";
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 },
    );
    root.dataset.motionReady = "true";
    root
      .querySelectorAll("[data-reveal]")
      .forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);
  const offer = examples[kind];
  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.cookie = `lbt-home-theme=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  }
  return (
    <div
      ref={rootRef}
      className={s.page}
      data-theme={theme}
      data-intro={initialOpening ? "yes" : "no"}
    >
      {opening && <Opening key={openingVersion} onComplete={closeOpening} />}
      <a className={s.skip} href="#contenu">
        Aller au contenu
      </a>
      <header className={s.header}>
        <div className={`${s.wrap} ${s.nav}`}>
          <Brand />
          <nav className={s.navLinks} aria-label="Navigation principale">
            <a href="#comment">Comment ça marche</a>
            <a href="#questions">Les réponses à tes questions</a>
          </nav>
          <div className={s.navActions}>
            <button
              type="button"
              className={s.themeButton}
              onClick={toggleTheme}
              aria-label={
                theme === "light"
                  ? "Activer le thème sombre"
                  : "Activer le thème clair"
              }
            >
              {theme === "light" ? <Moon size={19} /> : <Sun size={19} />}
            </button>
            <Link className={s.login} href="/login">
              Se connecter <ArrowUpRight size={16} />
            </Link>
          </div>
        </div>
      </header>

      <main id="contenu">
        <section className={`${s.wrap} ${s.hero}`} aria-labelledby="hero-title">
          <div className={s.heroCopy}>
            <h1 id="hero-title">
              <span>Ton alternance.</span>
              <span>Ton stage.</span>
              <span>
                <em>
                  Ton bon départ.
                  <svg
                    viewBox="0 0 500 20"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    <path d="M3 14 Q220 0 495 10" />
                  </svg>
                </em>
              </span>
            </h1>
            <p className={s.lead}>
              Les offres qui te correspondent. Un CV qui te ressemble.
              <br className={s.desktopBreak} /> L’IA pour avancer.{" "}
              <strong>Toi, pour faire la différence.</strong>
            </p>
            <div className={s.heroActions}>
              <Link href="/login" className={s.primary}>
                Trouver mon bon taf <ArrowUpRight size={20} />
              </Link>
              <a href="#comment" className={s.textLink}>
                Je découvre <ArrowDown size={16} />
              </a>
            </div>
            <p className={s.heroNote}>
              <Check size={16} /> Stages & alternances, partout en France.
            </p>
            <p className={s.trackingNote}>
              Et bientôt, le suivi de tes candidatures au même endroit.
            </p>
            <button
              type="button"
              className={s.replay}
              onClick={() => {
                setOpeningVersion((version) => version + 1);
                setOpening(true);
              }}
            >
              <RotateCcw size={14} /> Revoir le premier chapitre
            </button>
          </div>

          <div className={s.scene}>
            <div className={s.sceneTop}>
              <span>Le bon profil. La bonne rencontre.</span>
              <Declic />
            </div>
            <div
              className={s.switcher}
              role="group"
              aria-label="Type d’offre de démonstration"
            >
              <button
                type="button"
                aria-pressed={kind === "alternance"}
                onClick={() => setKind("alternance")}
              >
                Une alternance
              </button>
              <button
                type="button"
                aria-pressed={kind === "stage"}
                onClick={() => setKind("stage")}
              >
                Un stage
              </button>
            </div>
            <div
              key={kind}
              className={s.demoContent}
              aria-live="polite"
              aria-atomic="true"
            >
              <div className={s.offer}>
                <div className={s.offerTop}>
                  <span className={s.companyMark}>
                    {offer.initial}
                    <span>.</span>
                  </span>
                  <span className={s.contract}>
                    {offer.contract} · {offer.duration}
                  </span>
                  <ArrowUpRight size={22} />
                </div>
                <h2>{offer.title}</h2>
                <p className={s.company}>{offer.company}</p>
                <p className={s.location}>
                  <MapPin size={14} /> {offer.location}
                </p>
                <div className={s.skills}>
                  {offer.skills.map((skill) => (
                    <span key={skill}>{skill}</span>
                  ))}
                </div>
                <div className={s.match}>
                  <span className={s.matchIcon}>
                    <Check size={17} />
                  </span>
                  <span>
                    Des compétences en commun.
                    <strong>Une piste à explorer.</strong>
                  </span>
                </div>
              </div>
              <div className={s.bridge}>
                <span />
                <Declic />
                <span />
                <p>C’est là que ça matche.</p>
              </div>
              <div className={s.profile}>
                <div className={s.profileAvatar}>Toi</div>
                <div>
                  <span>Ton profil, ton potentiel</span>
                  <strong>{offer.cv}</strong>
                </div>
                <FileText size={23} />
              </div>
              <p className={s.demoExplanation}>{offer.sentence}</p>
            </div>
            <p className={s.demoCaption}>
              Aperçu illustratif · profils et offres fictifs
            </p>
          </div>
        </section>

        <div className={s.promiseStrip}>
          <div className={s.wrap}>
            <span>Moins d’onglets ouverts.</span>
            <Declic />
            <span>Plus de bonnes pistes.</span>
            <Declic />
            <span>Et un vrai premier pas.</span>
          </div>
        </div>

        <section
          id="comment"
          data-reveal="method"
          className={`${s.wrap} ${s.method}`}
          aria-labelledby="method-title"
        >
          <div className={s.sectionIntro}>
            <h2 id="method-title">
              Chercher, c’est bien.
              <br />
              <em>Se projeter, c’est mieux.</em>
            </h2>
            <p>
              Tu as autre chose à faire que réécrire ton CV à chaque annonce.
              LeBonTaf t’aide à passer de « ça m’intéresse » à « je suis prêt·e
              ».
            </p>
          </div>
          <div className={s.steps}>
            <article>
              <span className={s.stepNumber}>01</span>
              <h3>Commence par toi.</h3>
              <p>
                Importe ton CV et vérifie ton profil. Tes expériences, tes
                projets, tes compétences : c’est notre point de départ.
              </p>
              <span className={s.stepDetail}>
                <FileText size={17} /> Un CV, ton point de départ
              </span>
            </article>
            <article>
              <span className={s.stepNumber}>02</span>
              <h3>Repère le bon poste.</h3>
              <p>
                Explore les offres et retrouve celles qui sont proches de ton
                profil. Garde ton cap, affine ta recherche.
              </p>
              <span className={s.stepDetail}>
                <MapPin size={17} /> Des offres partout en France
              </span>
            </article>
            <article>
              <span className={s.stepNumber}>03</span>
              <h3>Fais valoir tes atouts.</h3>
              <p>
                Prépare un CV et une lettre adaptés à l’offre avec l’IA. Tu
                vérifies, tu ajustes, puis tu postules.
              </p>
              <span className={s.stepDetail}>
                <Check size={17} /> Le dernier mot reste le tien
              </span>
            </article>
          </div>
        </section>

        <section
          className={s.documentSection}
          data-reveal="documents"
          aria-labelledby="documents-title"
        >
          <div className={`${s.wrap} ${s.documentLayout}`}>
            <div
              className={s.documentArt}
              aria-label="Exemple illustratif de CV adapté"
            >
              <div className={s.paper}>
                <div className={s.paperHeader}>
                  <span>
                    TON NOM
                    <br />
                    <strong>Ton prochain chapitre.</strong>
                  </span>
                  <Declic />
                </div>
                <h3>Développeur·se front-end</h3>
                <p className={s.paperSubtitle}>
                  CV adapté à une offre d’alternance · exemple
                </p>
                <div className={s.paperRule} />
                <h4>Ce que tu sais faire</h4>
                <div className={s.paperSkills}>
                  <span>React</span>
                  <span>TypeScript</span>
                  <span>Interfaces web</span>
                </div>
                <h4>Ce que tu as déjà construit</h4>
                <p>
                  Un projet étudiant, une expérience associative, une première
                  mission : tes réalisations méritent d’être mises en valeur.
                </p>
                <div className={s.paperLines} aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </div>
                <span className={s.paperFooter}>
                  Ton parcours. Tes mots. Ta candidature.
                </span>
              </div>
              <div className={s.documentSeal}>
                <Check size={18} />
                <span>
                  Adapté au poste.
                  <br />
                  <strong>Fidèle à ton profil.</strong>
                </span>
              </div>
            </div>
            <div className={s.documentCopy}>
              <h2 id="documents-title">
                L’IA fait le lien.
                <br />
                <em>Tu gardes la main.</em>
              </h2>
              <p>
                Une annonce n’attend pas une copie de toutes les autres
                candidatures. Mets en avant les bons projets et les bonnes
                compétences, avec un CV et une lettre préparés pour ce poste.
              </p>
              <ul>
                <li>
                  <Check size={18} /> Des documents adaptés à chaque offre
                </li>
                <li>
                  <Check size={18} /> Une version que tu peux relire et modifier
                </li>
                <li>
                  <Check size={18} /> Ton CV et ta lettre à télécharger
                </li>
              </ul>
              <Link href="/login" className={s.textLink}>
                Préparer ma candidature <ArrowRight size={19} />
              </Link>
            </div>
          </div>
        </section>

        <section
          className={`${s.wrap} ${s.followSection}`}
          data-reveal="tracking"
          aria-labelledby="follow-title"
        >
          <div>
            <h2 id="follow-title">
              Chaque piste
              <br />
              <em>a sa suite.</em>
            </h2>
            <span className={s.coming}>À venir · suivi enrichi</span>
            <p>
              Un espace pour garder le fil de tes candidatures, de la première
              offre repérée à la réponse. Le suivi complet et les rappels sont
              en préparation.
            </p>
            <a className={s.textLink} href="#questions">
              Comprendre ce qui est disponible <ArrowRight size={18} />
            </a>
          </div>
          <div
            className={s.trackingPreview}
            aria-label="Aperçu du futur suivi, non interactif"
          >
            <div className={s.trackingHeader}>
              Ta recherche, en un coup d’œil <span>APERÇU</span>
            </div>
            {[
              { name: "Une offre qui te parle", state: "Repérée" },
              { name: "Ton CV et ta lettre", state: "À préparer" },
              { name: "Le début d’une conversation", state: "À suivre" },
            ].map((row, i) => (
              <div className={s.trackingRow} key={row.state}>
                <span className={s.trackingDot} data-step={i} />
                <span>{row.name}</span>
                <small>{row.state}</small>
              </div>
            ))}
            <p>Un aperçu de la suite. Pas encore le tableau final.</p>
          </div>
        </section>

        <section
          id="questions"
          className={`${s.wrap} ${s.faq}`}
          aria-labelledby="faq-title"
        >
          <h2 id="faq-title">
            Avant de
            <br />
            <em>te lancer.</em>
          </h2>
          <div className={s.faqItems}>
            {[
              {
                q: "LeBonTaf, c’est pour qui ?",
                a: "Pour les étudiants à la recherche d’un stage ou d’une alternance en France, dans l’informatique, le numérique ou la bureautique. Le catalogue contient également des CDD.",
              },
              {
                q: "Qu’est-ce que l’IA fait pour moi ?",
                a: "Elle aide à rapprocher les offres de ton profil et à préparer un CV et une lettre adaptés à chaque poste. Relis toujours les documents : tu peux les corriger avant de les utiliser.",
              },
              {
                q: "Est-ce que LeBonTaf postule à ma place ?",
                a: "Tu gardes la main : LeBonTaf prépare tes documents, puis c’est toi qui envoies ta candidature. Aucun envoi automatique n’est déclenché.",
              },
              {
                q: "Le suivi des candidatures est-il déjà complet ?",
                a: "Le suivi enrichi, les rappels et les relances sont encore en préparation. La recherche d’offres, l’import du CV et la préparation de documents sont déjà présents dans l’application.",
              },
            ].map(({ q, a }) => (
              <details key={q}>
                <summary>
                  {q}
                  <ChevronDown size={19} />
                </summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className={s.final} data-reveal="final">
          <div className={s.wrap}>
            <Declic className={s.finalMark} />
            <h2>
              Le prochain départ,
              <br />
              <em>c’est le tien.</em>
            </h2>
            <Link href="/login" className={s.primary}>
              Trouver mon bon taf <ArrowUpRight size={20} />
            </Link>
            <p>Un profil. Des possibilités. À toi de jouer.</p>
          </div>
        </section>
      </main>
      <footer className={`${s.wrap} ${s.footer}`}>
        <div>
          <Brand />
          <p>Le bon taf commence par toi.</p>
        </div>
        <nav aria-label="Informations légales">
          <Link href="/mentions-legales">Mentions légales</Link>
          <Link href="/confidentialite">Confidentialité</Link>
          <Link href="/conditions">Conditions d’utilisation</Link>
        </nav>
        <span>Fait pour les premiers pas.</span>
      </footer>
    </div>
  );
}
