// Controle du site reellement en ligne : chaque page repond, l'Entrainement fonctionne.
const path = require("path");
const { RACINE, chargerBanque, lancerNavigateur, dossierCaptures } = require("./commun.js");
// Ce test vise le site publie, sauf si SITE indique une autre adresse.
const BASE = (process.env.SITE || "https://nsi.mdehais.fr/").replace(/\/?$/, "/");
const IMG = dossierCaptures("en-ligne");
let echecs = 0;
const verif = (nom, ok, detail) => { console.log((ok ? "ok    " : "ECHEC ") + nom + (detail ? "  -> " + detail : "")); if (!ok) echecs++; };

(async () => {
  const nbPremiere = chargerBanque().duNiveau("premiere").length;
  const b = await lancerNavigateur();
  const c = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await c.newPage();
  const pannes = [];
  p.on("pageerror", (e) => pannes.push("pageerror : " + e.message));
  p.on("response", (r) => { if (r.status() >= 400) pannes.push(r.status() + " " + r.url()); });
  p.on("requestfailed", (r) => pannes.push("requete : " + r.url()));

  for (const adresse of ["", "SNT/", "SNT/introduction/", "SNT/internet/", "SNT/donnees/", "1NSI/", "1NSI/python/", "1NSI/types-construits/", "TNSI/", "archives/", "archives/2025-2026/", "echecs/"]) {
    const r = await p.goto(BASE + adresse + "?v=" + Date.now(), { waitUntil: "load" });
    verif("page /" + adresse, r.ok(), String(r.status()));
  }
  const pdf = await c.request.get(BASE + "SNT/introduction/thematique0.pdf");
  verif("un PDF existant repond", pdf.ok(), String(pdf.status()));

  await p.goto(BASE, { waitUntil: "load" });
  const couleur = await p.evaluate(() => getComputedStyle(document.querySelector(".md-header")).backgroundColor);
  verif("bandeau vert sapin", couleur === "rgb(18, 53, 42)", couleur);
  verif("logo d'origine", (await p.locator(".md-header__button.md-logo img").getAttribute("src")).includes("logo3.png"));
  verif("plus de mention Made with", !(await p.locator("body").innerText()).includes("Made with"));
  await p.screenshot({ path: path.join(IMG, "accueil.png") });

  await p.goto(BASE + "entrainement/?v=" + Date.now() + "#/premiere", { waitUntil: "load" });
  await p.waitForSelector(".entr-bilan", { timeout: 30000 });
  const n = await p.locator(".entr-reseau .entr-arret").count();
  verif("Entrainement : exercices affiches", n === nbPremiere, n + " points sur " + nbPremiere);
  await p.screenshot({ path: path.join(IMG, "entrainement.png"), fullPage: true });

  // Un vrai exercice, avec Python telecharge depuis Internet
  await p.goto(BASE + "entrainement/#/exo/tarif-cinema");
  await p.waitForSelector(".CodeMirror");
  const t0 = Date.now();
  await p.evaluate(() => document.querySelector(".CodeMirror").CodeMirror.setValue("def tarif(age):\n    if age < 14:\n        return 5\n    return 9"));
  await p.locator("#entr-app .entr-commandes button").first().click();
  await p.waitForSelector(".entr-message--reussi", { timeout: 90000 });
  verif("Python tourne et corrige en ligne", true, (Date.now() - t0) + " ms");
  await p.screenshot({ path: path.join(IMG, "exercice.png"), fullPage: true });

  // Le code de sauvegarde, d'un appareil a l'autre
  await p.goto(BASE + "entrainement/#/");
  await p.reload();
  await p.waitForSelector(".entr-code-sauvegarde");
  const code = await p.locator(".entr-code-sauvegarde").innerText();
  const autre = await (await b.newContext()).newPage();
  await autre.goto(BASE + "entrainement/#/reprise/" + code);
  await autre.waitForSelector(".entr-bilan");
  verif("code de sauvegarde sur un autre appareil", /1 exo réussi/.test(await autre.locator(".entr-bilan").innerText()), code);

  const tel = await (await b.newContext({ viewport: { width: 375, height: 700 }, hasTouch: true, isMobile: true })).newPage();
  await tel.goto(BASE + "entrainement/#/premiere");
  await tel.waitForSelector(".entr-bilan");
  verif("largeur telephone : pas de debordement", (await tel.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0);

  const utiles = pannes.filter((x) => !x.includes("?v="));
  console.log("\npannes : " + (pannes.length ? "\n" + [...new Set(pannes)].join("\n") : "aucune"));
  console.log(echecs ? echecs + " ECHEC(S)" : "TOUT EST OK");
  await b.close();
})().catch((e) => { console.error(String(e).slice(0, 700)); process.exit(1); });
