// Outils communs aux tests de la page Entrainement.
//
// Les nombres attendus (exercices par niveau, par notion...) sont lus dans la banque
// docs-public/entrainement/exercices : ajouter des exercices ne demande pas de modifier les tests.
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");

const RACINE = path.resolve(__dirname, "..", "..");
const jsyaml = require(path.join(RACINE, "docs-public", "entrainement", "vendor", "js-yaml.min.js"));

// Le site teste : le serveur local par defaut, ou une autre adresse avec SITE=...
const SITE = (process.env.SITE || "http://127.0.0.1:8123/").replace(/\/?$/, "/");
const URL_PAGE = SITE + "entrainement/";

function chargerBanque() {
  const dossier = path.join(RACINE, "docs-public", "entrainement", "exercices");
  const lire = (nom) => jsyaml.load(fs.readFileSync(path.join(dossier, nom + ".yml"), "utf8"));
  const { notions } = lire("notions");
  const exercices = notions.flatMap((n) => lire(n.id).exercices);
  const niveauDe = (notion) => notion.niveau || "premiere";
  return {
    notions,
    exercices,
    duNiveau: (niveau) => exercices.filter((e) => niveauDe(notions.find((n) => n.id === e.notion)) === niveau),
    notionsDuNiveau: (niveau) => notions.filter((n) => niveauDe(n) === niveau && exercices.some((e) => e.notion === n.id)),
    deLaNotion: (id) => exercices.filter((e) => e.notion === id),
  };
}

// Edge par defaut (present sur Windows) ; NAVIGATEUR=chrome pour Chrome, VOIR=1 pour voir la fenetre.
function lancerNavigateur() {
  return chromium.launch({ channel: process.env.NAVIGATEUR || "msedge", headless: !process.env.VOIR });
}

// verif(nom, ok, detail) affiche ok ou ECHEC et compte les echecs ; verif.verdict() conclut par
// "TOUT EST OK", la phrase que lancer.js attend. Discret : seuls les echecs s'affichent.
function verificateur({ discret = false } = {}) {
  const verif = (nom, ok, detail) => {
    if (!ok || !discret) console.log((ok ? "ok    " : "ECHEC ") + nom + (detail ? "  -> " + detail : ""));
    if (!ok) verif.echecs++;
    verif.faites++;
  };
  verif.echecs = 0;
  verif.faites = 0;
  verif.verdict = () => console.log(verif.echecs ? "\n" + verif.echecs + " ECHEC(S)" : "\nTOUT EST OK");
  return verif;
}

function dossierCaptures(...sousDossiers) {
  const dossier = path.join(__dirname, "captures", ...sousDossiers);
  fs.mkdirSync(dossier, { recursive: true });
  return dossier;
}

module.exports = { RACINE, SITE, URL_PAGE, chargerBanque, lancerNavigateur, dossierCaptures, verificateur };
