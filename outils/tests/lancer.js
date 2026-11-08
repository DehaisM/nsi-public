// Lance les tests de la page Entrainement les uns apres les autres, et resume le resultat.
//
//   node outils/tests/lancer.js            tous les tests, sur le serveur local
//   node outils/tests/lancer.js rapide     sans le passage complet de la banque (plusieurs minutes)
//   node outils/tests/lancer.js en-ligne   le controle du site publie
const { spawnSync } = require("child_process");
const path = require("path");

const TESTS = {
  "code-sauvegarde.js": { titre: "Code de sauvegarde (sans navigateur)", modes: ["tout", "rapide"] },
  "premiere.js": { titre: "Un élève de Première", modes: ["tout", "rapide"] },
  "changer-appareil.js": { titre: "Changer d'appareil", modes: ["tout", "rapide"] },
  "seconde.js": { titre: "Un élève de Seconde", modes: ["tout", "rapide"] },
  "hasard.js": { titre: "Les questions tirées au hasard", modes: ["tout", "rapide"] },
  "filtre-maths.js": { titre: "Le filtre Maths", modes: ["tout", "rapide"] },
  "banque.js": { titre: "Chaque exercice et chaque question de la banque", modes: ["tout"] },
  "en-ligne.js": { titre: "Le site publié", modes: ["en-ligne"] },
};

const mode = process.argv[2] || "tout";
const liste = Object.keys(TESTS).filter((fichier) => TESTS[fichier].modes.includes(mode));
if (!liste.length) {
  console.log("Mode inconnu : " + mode + " (tout, rapide ou en-ligne)");
  process.exit(1);
}

let echecs = 0;
for (const fichier of liste) {
  const debut = Date.now();
  const r = spawnSync(process.execPath, [path.join(__dirname, fichier)], { encoding: "utf8", env: process.env });
  const sortie = (r.stdout || "") + (r.stderr || "");
  const reussi = r.status === 0 && /TOUT EST OK/.test(sortie);
  const duree = Math.round((Date.now() - debut) / 1000) + " s";
  console.log((reussi ? "ok      " : "ECHEC   ") + TESTS[fichier].titre + " (" + duree + ")");
  if (!reussi) {
    echecs++;
    const lignes = sortie.split("\n").filter((l) => /ECHEC|Error|erreur/i.test(l) && !/^ok/.test(l));
    for (const l of (lignes.length ? lignes : sortie.split("\n").slice(-6)).slice(0, 8)) console.log("        " + l.slice(0, 200));
  }
}
console.log(echecs ? "\n" + echecs + " test(s) en échec" : "\nTout est bon.");
process.exit(echecs ? 1 : 0);
