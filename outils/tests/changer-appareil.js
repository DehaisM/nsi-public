// Changement d'appareil : chaque contexte de navigateur joue un appareil different.
// Les scenarios Premiere : le niveau est deja choisi, comme pour un eleve de Premiere.
const PREMIERE = () => {
  try {
    const e = JSON.parse(localStorage.getItem("nsi-entrainement") || "{}");
    if (!e.niveau) { e.niveau = "premiere"; localStorage.setItem("nsi-entrainement", JSON.stringify(e)); }
  } catch (erreur) {}
};
const path = require("path");
const { URL_PAGE, SITE, RACINE, chargerBanque, lancerNavigateur, dossierCaptures } = require("./commun.js");
const IMG = dossierCaptures();

let echecs = 0;
function verif(nom, ok, detail) {
  console.log((ok ? "ok    " : "ECHEC ") + nom + (detail ? "  -> " + detail : ""));
  if (!ok) echecs++;
}

const SOLUTIONS = {
  "tarif-cinema": "def tarif(age):\n    if age < 14:\n        return 5\n    return 9",
  "rendre-la-monnaie": "def monnaie(prix, paye):\n    if paye >= prix:\n        return paye - prix\n    return 0",
  "colonne-grille": "def colonne(grille, j):\n    return [l[j] for l in grille]",
};

async function reussir(page, id, avecAide) {
  await page.goto(URL_PAGE + "#/exo/" + id);
  await page.waitForSelector(".CodeMirror");
  if (avecAide) await page.locator("button", { hasText: "Une aide" }).click();
  await page.evaluate((c) => document.querySelector(".CodeMirror").CodeMirror.setValue(c), SOLUTIONS[id]);
  await page.locator("button", { hasText: "Vérifier" }).click();
  await page.waitForSelector(".entr-message--reussi", { timeout: 90000 });
}
async function accueil(page) {
  await page.goto(URL_PAGE + "#/");
  await page.waitForSelector(".entr-bilan");
}
const bilan = (page) => page.locator(".entr-bilan").innerText();
const lireLeCode = (page) => page.locator(".entr-code-sauvegarde").innerText();
async function saisir(page, code) {
  await page.locator(".entr-champ").fill(code);
  await page.locator(".entr-reprise button").click();
  await page.waitForSelector(".entr-bilan");
}
async function appareil(navigateur, options) {
  const contexte = await navigateur.newContext(Object.assign({ viewport: { width: 1280, height: 900 } }, options || {}));
  await contexte.addInitScript(PREMIERE);
  const page = await contexte.newPage();
  page.on("pageerror", (e) => { console.log("ERREUR PAGE " + e.message); echecs++; });
  return page;
}
const message = (page) => page.locator("#entr-app .entr-message").innerText();

(async () => {
  const nbPremiere = chargerBanque().duNiveau("premiere").length;
  const navigateur = await lancerNavigateur();

  const pc = await appareil(navigateur);
  await accueil(pc);
  verif("sans progression : pas de code, mais on peut en saisir un",
    (await pc.locator(".entr-code-sauvegarde").count()) === 0 && (await pc.locator(".entr-champ").count()) === 1);

  await reussir(pc, "tarif-cinema", false);
  await reussir(pc, "colonne-grille", true);
  await accueil(pc);
  const code = await lireLeCode(pc);
  console.log("      code apres 2 exos : " + code);
  await pc.locator(".entr-sauvegarde").scrollIntoViewIfNeeded();
  await pc.screenshot({ path: path.join(IMG, "10-sauvegarde.png"), fullPage: true });

  // Telephone tout neuf : le code recree la progression
  const tel = await appareil(navigateur, { viewport: { width: 375, height: 700 } });
  await accueil(tel);
  verif("telephone : part de zero", /^0 exo réussi/.test(await bilan(tel)), await bilan(tel));
  await saisir(tel, code);
  let b = await bilan(tel);
  verif("code saisi : exos et badge recuperes", /2 exos réussis/.test(b) && /1 sans aide/.test(b), b);
  verif("code saisi : serie recuperee", /1 jour de suite/.test(b));
  verif("code saisi : message", /2 exos réussis en plus/.test(await message(tel)), await message(tel));
  await tel.locator(".entr-ligne__titre", { hasText: "Conditions" }).click();
  await tel.locator(".entr-ligne__titre", { hasText: "Grilles" }).click();
  verif("le bon badge sur le bon exo", await tel.evaluate(() => {
    const ligne = (t) => [...document.querySelectorAll(".entr-stations > li")].find((l) => l.textContent.includes(t)).textContent;
    return /sans aide/.test(ligne("Le tarif du cinéma")) && !/sans aide/.test(ligne("Une colonne de la grille")) && [...document.querySelectorAll(".entr-stations > li")].find((l) => l.textContent.includes("Une colonne de la grille")).classList.contains("entr-station--faite");
  }));
  await tel.screenshot({ path: path.join(IMG, "11-sauvegarde-tel.png"), fullPage: true });
  await tel.reload();
  await tel.waitForSelector(".entr-bilan");
  verif("recuperation gardee apres rechargement", /2 exos réussis/.test(await bilan(tel)));

  // Fusion : le telephone avance de son cote, puis reprend le code du PC : rien n'est perdu
  await reussir(tel, "rendre-la-monnaie", false);
  await accueil(tel);
  await saisir(tel, code);
  b = await bilan(tel);
  verif("fusion : rien de perdu sur le telephone", /3 exos réussis/.test(b) && /2 sans aide/.test(b), b);
  verif("code deja connu : message clair", /aucun exo de plus/.test(await message(tel)), await message(tel));
  const codeTel = await lireLeCode(tel);
  await accueil(pc);
  await saisir(pc, codeTel);
  verif("aller-retour : le PC recupere l'exo fait sur le telephone", /3 exos réussis/.test(await bilan(pc)), await bilan(pc));
  verif("PC et telephone ont le meme code a la fin", (await lireLeCode(pc)) === codeTel);

  // Recopie a la main
  const neuf1 = await appareil(navigateur);
  await accueil(neuf1);
  await saisir(neuf1, "  " + code.toLowerCase().replace(/-/g, " ") + " ");
  verif("minuscules et espaces acceptes", /2 exos réussis/.test(await bilan(neuf1)));

  // Confusions O/0 et I/L/1 : le 0 et le 1 du code sont retapes en lettres
  const neuf2 = await appareil(navigateur);
  await accueil(neuf2);
  await saisir(neuf2, code.replace(/0/g, "O").replace(/1/g, "l"));
  verif("confusions O/0 et l/1 tolerees", /2 exos réussis/.test(await bilan(neuf2)));

  // Fautes de frappe : chaque caractere change un par un doit etre refuse (ou sans effet nuisible)
  const neuf3 = await appareil(navigateur);
  await accueil(neuf3);
  const nu = code.replace(/-/g, "");
  let refuses = 0;
  for (let i = 0; i < nu.length; i++) {
    const remplacant = nu[i] === "A" ? "B" : "A";
    await saisir(neuf3, nu.slice(0, i) + remplacant + nu.slice(i + 1));
    if (/pas valide/.test(await message(neuf3))) refuses++;
  }
  verif("une faute de frappe est detectee", refuses === nu.length, refuses + "/" + nu.length + " refusees");
  verif("les fautes n'ont rien ajoute", /^0 exo réussi/.test(await bilan(neuf3)), await bilan(neuf3));
  for (const mauvais of ["", "bonjour", "UUUU-UUUU", "A"]) {
    await saisir(neuf3, mauvais);
    verif("code invalide refuse : '" + mauvais + "'", /pas valide/.test(await message(neuf3)));
  }

  // Lien
  const neuf4 = await appareil(navigateur);
  await neuf4.goto(URL_PAGE + "#/reprise/" + code);
  await neuf4.waitForSelector(".entr-bilan");
  verif("lien : progression recuperee", /2 exos réussis/.test(await bilan(neuf4)), await bilan(neuf4));
  verif("lien : l'adresse est nettoyee", (await neuf4.evaluate(() => location.hash)) === "#/");
  await neuf4.goto(URL_PAGE + "#/reprise/PASBON");
  await neuf4.waitForSelector(".entr-bilan");
  verif("lien invalide : message d'erreur", /pas valide/.test(await message(neuf4)));

  // Bouton copier
  const contexteCopie = await navigateur.newContext({ permissions: ["clipboard-read", "clipboard-write"] });
  await contexteCopie.addInitScript(PREMIERE);
  const copie = await contexteCopie.newPage();
  await copie.goto(URL_PAGE + "#/reprise/" + code);
  await copie.waitForSelector(".entr-code-sauvegarde");
  await copie.locator("button", { hasText: "Copier le lien" }).click();
  await copie.waitForTimeout(200);
  const presse = await copie.evaluate(() => navigator.clipboard.readText());
  verif("copier le lien", presse === URL_PAGE + "#/reprise/" + code, presse);

  // Serie : on garde la plus recente, jamais de recul
  const serie = await appareil(navigateur);
  await serie.goto(URL_PAGE);
  await serie.evaluate(() => localStorage.setItem("nsi-entrainement", JSON.stringify({
    exos: { "tarif-cinema": { reussi: true, sansAide: true, aides: 0, code: null } },
    serie: { dernier: new Date().toLocaleDateString("sv"), longueur: 6 }, notions: [], difficultes: [],
  })));
  await accueil(serie);
  await serie.reload();
  await serie.waitForSelector(".entr-bilan");
  const codeLongue = await lireLeCode(serie);
  await saisir(serie, code);
  verif("serie : la plus longue du jour est gardee", /6 jours de suite/.test(await bilan(serie)), await bilan(serie));
  await saisir(tel, codeLongue);
  verif("serie : recuperee sur un autre appareil", /6 jours de suite/.test(await bilan(tel)), await bilan(tel));

  // Code rempli : tous les exercices reussis sans aide
  const plein = await appareil(navigateur);
  await plein.goto(URL_PAGE);
  await plein.waitForSelector(".entr-bilan");
  const ids = await plein.locator(".entr-reseau .entr-arret").evaluateAll((l) => l.map((a) => a.getAttribute("href").replace("#/exo/", "")));
  await plein.evaluate((liste) => {
    const exos = {};
    for (const id of liste) exos[id] = { reussi: true, sansAide: true, aides: 0, code: null };
    localStorage.setItem("nsi-entrainement", JSON.stringify({ exos, serie: { dernier: new Date().toLocaleDateString("sv"), longueur: 300 }, notions: [], difficultes: [] }));
  }, ids);
  await plein.reload();
  await plein.waitForSelector(".entr-bilan");
  const codePlein = await lireLeCode(plein);
  console.log("      code avec les 15 exos reussis : " + codePlein + " (" + codePlein.replace(/-/g, "").length + " caracteres)");
  const neuf5 = await appareil(navigateur);
  await accueil(neuf5);
  await saisir(neuf5, codePlein);
  b = await bilan(neuf5);
  verif("code plein : tout est recupere", b.includes(nbPremiere + " exos réussis") && b.includes(nbPremiere + " sans aide") && /255 jours de suite/.test(b), b);

  // Debordement au telephone
  const deborde = await tel.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  verif("telephone : pas de debordement", deborde <= 0, deborde + " px");

  console.log(echecs ? "\n" + echecs + " ECHEC(S)" : "\nTOUT EST OK");
  await navigateur.close();
})().catch((e) => { console.error(String(e).slice(0, 800)); process.exit(1); });
