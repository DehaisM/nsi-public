// Lance les tests de la page Entrainement les uns apres les autres, et resume le resultat.
//
//   node outils/tests/lancer.js            tous les tests, sur le serveur local
//   node outils/tests/lancer.js rapide     sans le passage complet de la banque (plusieurs minutes)
//   node outils/tests/lancer.js en-ligne   le controle du site publie
const { spawnSync } = require("child_process");
const path = require("path");

const TESTS = {
  "code-sauvegarde.js": "Code de sauvegarde (sans navigateur)",
  "premiere.js": "Un élève de Première",
  "changer-appareil.js": "Changer d'appareil",
  "seconde.js": "Un élève de Seconde",
  "hasard.js": "Les questions tirées au hasard",
  "filtre-maths.js": "Le filtre Maths",
  "banque.js": "Chaque exercice et chaque question de la banque",
};

const mode = process.argv[2] || "tout";
let liste = Object.keys(TESTS);
if (mode === "rapide") liste = liste.filter((t) => t !== "banque.js");
if (mode === "en-ligne") liste = ["en-ligne.js"];
TESTS["en-ligne.js"] = "Le site publié";

let echecs = 0;
for (const fichier of liste) {
  const debut = Date.now();
  const r = spawnSync(process.execPath, [path.join(__dirname, fichier)], { encoding: "utf8", env: process.env });
  const sortie = (r.stdout || "") + (r.stderr || "");
  const reussi = r.status === 0 && /TOUT EST OK/.test(sortie);
  const duree = Math.round((Date.now() - debut) / 1000) + " s";
  console.log((reussi ? "ok      " : "ECHEC   ") + TESTS[fichier] + " (" + duree + ")");
  if (!reussi) {
    echecs++;
    const lignes = sortie.split("\n").filter((l) => /ECHEC|Error|erreur/i.test(l) && !/^ok/.test(l));
    for (const l of (lignes.length ? lignes : sortie.split("\n").slice(-6)).slice(0, 8)) console.log("        " + l.slice(0, 200));
  }
}
console.log(echecs ? "\n" + echecs + " test(s) en échec" : "\nTout est bon.");
process.exit(echecs ? 1 : 0);
