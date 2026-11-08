// Les scenarios Premiere : le niveau est deja choisi, comme pour un eleve de Premiere.
const PREMIERE = () => {
  try {
    const e = JSON.parse(localStorage.getItem("nsi-entrainement") || "{}");
    if (!e.niveau) { e.niveau = "premiere"; localStorage.setItem("nsi-entrainement", JSON.stringify(e)); }
  } catch (erreur) {}
};
const path = require("path");
const { URL_PAGE, chargerBanque, lancerNavigateur, dossierCaptures, verificateur } = require("./commun.js");
const IMG = dossierCaptures();

const verif = verificateur();

async function ecrire(page, code) {
  await page.evaluate((c) => document.querySelector(".CodeMirror").CodeMirror.setValue(c), code);
}
async function verifier(page) {
  await page.locator("button", { hasText: "Vérifier" }).click();
  await page.waitForFunction(() => {
    const b = [...document.querySelectorAll("button")].find((x) => /Vérifier|Vérification/.test(x.textContent));
    return b && b.textContent === "Vérifier" && !b.disabled;
  }, null, { timeout: 90000 });
  return page.locator(".entr-resultat").innerText();
}
async function ouvrir(page, id) {
  await page.goto(URL_PAGE + "#/exo/" + id);
  await page.waitForSelector(".entr-titre");
}

(async () => {
  const banque = chargerBanque();
  const premiere = banque.duNiveau("premiere");
  const nbNotions = banque.notionsDuNiveau("premiere").length;
  const nbGrilles = banque.deLaNotion("grilles").length;
  const nbListes = banque.deLaNotion("listes").length;
  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ viewport: { width: 1280, height: 900 } });
  await contexte.addInitScript(PREMIERE);
  const page = await contexte.newPage();
  const erreursConsole = [];
  page.on("pageerror", (e) => erreursConsole.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") erreursConsole.push("console: " + m.text()); });
  page.on("requestfailed", (r) => erreursConsole.push("requete: " + r.url()));

  // Accueil
  await page.goto(URL_PAGE);
  await page.waitForSelector(".entr-reseau");
  verif("accueil : une ligne par notion", (await page.locator(".entr-ligne__titre").count()) === nbNotions);
  verif("accueil : un point par exercice", (await page.locator(".entr-reseau .entr-arret").count()) === premiere.length);
  await page.screenshot({ path: path.join(IMG, "1-accueil.png"), fullPage: true });

  // Filtre + hasard
  await page.locator(".entr-filtre", { hasText: "Grilles" }).click();
  const titresGrilles = await page.locator(".entr-reseau .entr-arret:not(.entr-arret--hors)").evaluateAll((l) => l.map((a) => a.title));
  verif("filtre grilles", titresGrilles.length === nbGrilles, titresGrilles.length + " sur " + nbGrilles);
  await page.locator(".entr-ligne__titre", { hasText: "Listes" }).click();
  verif("ouvrir une ligne montre ses titres", (await page.locator(".entr-stations > li").count()) === nbListes);
  await page.reload();
  await page.waitForSelector(".entr-reseau");
  verif("la ligne reste ouverte apres rechargement", (await page.locator(".entr-stations > li").count()) === nbListes);
  await page.locator(".entr-ligne__titre", { hasText: "Listes" }).click();
  verif("refermer la ligne", (await page.locator(".entr-stations > li").count()) === 0);
  await page.locator("button", { hasText: "Un exo au hasard" }).click();
  await page.waitForSelector(".entr-titre");
  const tire = await page.locator(".entr-titre").innerText();
  verif("hasard respecte le filtre", titresGrilles.includes(tire), tire);
  await page.goto(URL_PAGE + "#/");
  await page.locator(".entr-filtre", { hasText: "Grilles" }).click();

  // Code de depart : la fonction ne renvoie rien
  await ouvrir(page, "tarif-cinema");
  const t0 = Date.now();
  let r = await verifier(page);
  console.log("      premier chargement + correction : " + (Date.now() - t0) + " ms");
  verif("depart : signale le return oublie", /return est-il oublié/.test(r));
  verif("depart : test cache non devoile", !/tarif\(13\)/.test(r));
  verif("depart : conseil affiche une seule fois", (r.match(/return est-il oublié/g) || []).length === 1);
  verif("depart : caches non annonces tant que les visibles echouent", !/caché/.test(r));
  await page.reload();
  await page.waitForSelector(".CodeMirror");
  verif("les ... sont selectionnes", await page.evaluate(() => document.querySelector(".CodeMirror").CodeMirror.getSelection()) === "...");
  await page.screenshot({ path: path.join(IMG, "2-echec.png"), fullPage: true });

  // Erreurs
  await ecrire(page, "def tarif(age)\n    return 5");
  r = await verifier(page);
  verif("erreur de syntaxe avec la ligne", /Ligne 1 : SyntaxError/.test(r), r.split("\n")[0]);
  verif("ligne surlignee", (await page.locator(".entr-ligne-erreur").count()) === 1);
  await ecrire(page, "def tarif(age):\n    return prix");
  r = await verifier(page);
  verif("NameError dans un appel", /NameError/.test(r) && /Ligne 2/.test(r));
  await ecrire(page, "age = input()\ndef tarif(a):\n    return 5");
  r = await verifier(page);
  verif("input() explique", /input\(\) n'est pas utilisable/.test(r));

  // Boucle infinie : arretee, puis Python repart
  await ecrire(page, "def tarif(age):\n    while True:\n        pass");
  const t1 = Date.now();
  r = await verifier(page);
  verif("boucle infinie arretee", /ne s'arrête pas/.test(r), (Date.now() - t1) + " ms");
  await ecrire(page, "while True:\n    print('spam')");
  r = await verifier(page);
  verif("boucle infinie avec print arretee", /ne s'arrête pas/.test(r));

  // Reussite sans aide apres la relance
  await ecrire(page, "def tarif(age):\n    if age < 14:\n        return 5\n    return 9");
  r = await verifier(page);
  verif("reussite apres relance", /Réussi/.test(r) && /sans aide/.test(r));
  verif("tests caches annonces", /tests cachés passent/.test(r));
  await page.screenshot({ path: path.join(IMG, "3-reussi.png"), fullPage: true });

  // Solution erronee sur le test cache
  await ouvrir(page, "tarif-cinema");
  await ecrire(page, "def tarif(age):\n    if age == 10:\n        return 5\n    return 9");
  r = await verifier(page);
  verif("test cache echoue sans se devoiler", /Un test caché échoue/.test(r) && !/tarif\(13\)/.test(r));

  // Trous, interdits
  await ouvrir(page, "doubler-trous");
  r = await verifier(page);
  verif("trous signales", /trous ___/.test(r));
  await ouvrir(page, "temperature-bug");
  await ecrire(page, "def plus_chaud(temperatures):\n    return max(temperatures)");
  r = await verifier(page);
  verif("interdit max", /ne pas utiliser max/.test(r));
  await ouvrir(page, "compte-a-rebours");
  await ecrire(page, "i = 5\nwhile i > 0:\n    print(i)\n    i = i - 1\nprint('Partez !')");
  r = await verifier(page);
  verif("interdit while", /ne pas utiliser while/.test(r));
  await ecrire(page, "for i in range(5, 0, -1):\n    print(i)\nprint('Partez !')");
  r = await verifier(page);
  verif("exo a sortie reussi", /Réussi/.test(r));

  // Aides : perd le badge, persiste, recommencer
  await ouvrir(page, "colonne-grille");
  await page.locator("button", { hasText: "Une aide" }).click();
  await page.locator("button", { hasText: "Une aide" }).click();
  verif("2 aides visibles", (await page.locator(".entr-aide").count()) === 2);
  await page.screenshot({ path: path.join(IMG, "4-aides.png"), fullPage: true });
  await ecrire(page, "def colonne(grille, j):\n    return [l[j] for l in grille]");
  await page.waitForTimeout(100);
  await page.reload();
  await page.waitForSelector(".CodeMirror");
  const garde = await page.evaluate(() => document.querySelector(".CodeMirror").CodeMirror.getValue());
  verif("code garde apres rechargement", garde.includes("return [l[j]"));
  verif("aides gardees apres rechargement", (await page.locator(".entr-aide").count()) === 2);
  r = await verifier(page);
  verif("reussi avec aide : pas de badge", /Réussi/.test(r) && !/sans aide/.test(r));

  // Prediction
  await ouvrir(page, "predire-alias");
  await page.locator(".entr-choix__bouton", { hasText: "Une erreur" }).click();
  verif("prediction fausse : on peut reessayer", /pas la bonne réponse/.test(await page.locator("#entr-app").innerText()));
  await page.locator(".entr-choix__bouton", { hasText: "[1, 2, 3]" }).click();
  verif("prediction juste : explication", /Bonne réponse/.test(await page.locator("#entr-app").innerText()));
  await page.screenshot({ path: path.join(IMG, "5-prediction.png"), fullPage: true });

  // Encore un : ne repropose pas un exo deja reussi
  await page.locator("button", { hasText: "Exo suivant" }).click();
  await page.waitForFunction(() => !location.hash.includes("predire-alias"));
  const suivant = await page.evaluate(() => location.hash.replace("#/exo/", ""));
  verif("encore un : exo pas encore reussi", !["tarif-cinema", "compte-a-rebours", "colonne-grille", "predire-alias"].includes(suivant), suivant);

  // Bilan sur l'accueil
  await page.goto(URL_PAGE + "#/");
  await page.waitForSelector(".entr-bilan");
  const bilan = await page.locator(".entr-bilan").innerText();
  verif("bilan", bilan.includes("4 exos réussis sur " + premiere.length) && /2 sans aide/.test(bilan) && /1 jour de suite/.test(bilan), bilan);
  await page.screenshot({ path: path.join(IMG, "6-accueil-progres.png"), fullPage: true });

  // Mode sombre
  await page.evaluate(() => document.body.setAttribute("data-md-color-scheme", "slate"));
  await page.screenshot({ path: path.join(IMG, "7-accueil-sombre.png"), fullPage: true });
  await ouvrir(page, "mention-bug");
  await page.evaluate(() => document.body.setAttribute("data-md-color-scheme", "slate"));
  r = await verifier(page);
  await page.screenshot({ path: path.join(IMG, "8-exo-sombre.png"), fullPage: true });

  // Telephone
  const tel = await navigateur.newContext({ viewport: { width: 375, height: 700 } });
  await tel.addInitScript(PREMIERE);
  const ptel = await tel.newPage();
  for (const [nom, adresse] of [["accueil", ""], ["exo", "#/exo/compter-bateaux"], ["prediction", "#/exo/predire-alias"]]) {
    await ptel.goto(URL_PAGE + adresse);
    await ptel.waitForSelector(nom === "accueil" ? ".entr-reseau" : ".entr-titre");
    const deborde = await ptel.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    verif("telephone " + nom + " : pas de debordement", deborde <= 0, deborde + " px");
    await ptel.screenshot({ path: path.join(IMG, "9-tel-" + nom + ".png"), fullPage: true });
  }

  console.log("\nerreurs navigateur : " + (erreursConsole.length ? "\n" + [...new Set(erreursConsole)].join("\n") : "aucune"));
  verif.verdict();
  await navigateur.close();
})().catch((e) => { console.error(e); process.exit(1); });
