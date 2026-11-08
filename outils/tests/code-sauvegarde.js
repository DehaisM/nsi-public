// Tests du code de sauvegarde, sans navigateur.
const path = require("path");
const { RACINE } = require("./commun.js");
const Code = require(path.join(RACINE, "docs-public", "entrainement", "code-sauvegarde.js"));
const assert = require("assert");

function aleatoire(n, proportion, sansAide) {
  const r = [];
  for (let i = 1; i <= n; i++) if (Math.random() < proportion) r.push({ numero: i, sansAide: Math.random() < sansAide });
  return r;
}
function verifier(reussites, serie) {
  const code = Code.creer(reussites, serie);
  const lu = Code.lire(code);
  assert(lu, "code illisible : " + code);
  assert.strictEqual(lu.reussites.size, reussites.length, code);
  for (const { numero, sansAide } of reussites) assert.strictEqual(lu.reussites.get(numero), sansAide, code);
  if (serie && serie.dernier) {
    assert.strictEqual(lu.dernier, serie.dernier);
    assert.strictEqual(lu.longueur, Math.min(serie.longueur, 255));
  } else {
    assert.strictEqual(lu.dernier, null);
  }
  return code;
}

// Aller-retour sur 20000 progressions au hasard
let n = 0;
for (let i = 0; i < 20000; i++) {
  const taille = 1 + Math.floor(Math.random() * 400);
  const serie = Math.random() < 0.5 ? { dernier: "2026-11-" + String(1 + Math.floor(Math.random() * 28)).padStart(2, "0"), longueur: Math.floor(Math.random() * 400) } : { dernier: null, longueur: 0 };
  verifier(aleatoire(taille, Math.random(), Math.random()), serie);
  n++;
}
console.log("ok    aller-retour : " + n + " progressions au hasard");

// Cas limites
for (const r of [[], [{ numero: 1, sansAide: true }], [{ numero: 1, sansAide: false }], [{ numero: 300, sansAide: true }], [{ numero: 1000, sansAide: false }]]) {
  verifier(r, { dernier: null, longueur: 0 });
  verifier(r, { dernier: "2026-11-07", longueur: 3 });
}
console.log("ok    cas limites");

// Fautes de frappe : chaque caractere remplace, sur des codes varies
let essais = 0, rates = 0;
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
for (let i = 0; i < 300; i++) {
  const nu = Code.creer(aleatoire(150, 0.3, 0.5), { dernier: "2026-11-07", longueur: 3 }).replace(/-/g, "");
  for (let p = 0; p < nu.length; p++) {
    const autre = ALPHABET[(ALPHABET.indexOf(nu[p]) + 1 + Math.floor(Math.random() * 31)) % 32];
    essais++;
    if (Code.lire(nu.slice(0, p) + autre + nu.slice(p + 1))) rates++;
  }
}
console.log((rates === 0 ? "ok    " : "ECHEC ") + "un caractere faux : " + rates + " non detectes sur " + essais);
let inv = 0, invRates = 0;
for (let i = 0; i < 300; i++) {
  const nu = Code.creer(aleatoire(150, 0.3, 0.5), { dernier: "2026-11-07", longueur: 3 }).replace(/-/g, "");
  for (let p = 0; p + 1 < nu.length; p++) {
    if (nu[p] === nu[p + 1]) continue;
    inv++;
    if (Code.lire(nu.slice(0, p) + nu[p + 1] + nu[p] + nu.slice(p + 2))) invRates++;
  }
}
console.log("      deux caracteres inverses : " + invRates + " non detectes sur " + inv);
assert.strictEqual(Code.lire(""), null);
assert.strictEqual(Code.lire("UUUU-UUUU"), null);

// Longueurs (moyennes), sans les tirets, pour une banque de 150 exercices
function moyenne(proportion, sansAide, taille) {
  let total = 0;
  for (let i = 0; i < 300; i++) total += Code.creer(aleatoire(taille, proportion, sansAide), { dernier: "2026-11-07", longueur: 3 }).replace(/-/g, "").length;
  return Math.round(total / 300);
}
console.log("\nlongueur moyenne du code, banque de 150 exercices :");
for (const [p, nom] of [[0.03, "5 exos faits"], [0.07, "10 exos"], [0.2, "30 exos"], [0.5, "75 exos"], [1, "tout fait"]]) {
  console.log("  " + nom.padEnd(14) + moyenne(p, 0.5, 150) + " caracteres");
}
const toutBon = rates === 0 && invRates === 0;
console.log(toutBon ? "\nTOUT EST OK" : "\nECHEC : des fautes de frappe ne sont pas détectées");
process.exit(toutBon ? 0 : 1);
