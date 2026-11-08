// Fait chaque exercice de la banque dans le vrai navigateur, avec Pyodide :
// la solution doit etre acceptee, et le code de depart refuse.
const path = require("path");
const { URL_PAGE, chargerBanque, lancerNavigateur, dossierCaptures } = require("./commun.js");
const IMG = dossierCaptures("banque");

(async () => {
  const navigateur = await lancerNavigateur();
  const page = await (await navigateur.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const erreurs = [];
  page.on("pageerror", (e) => erreurs.push(e.message));
  await page.goto(URL_PAGE + "#/premiere");
  await page.waitForSelector(".entr-bilan");
  const exos = chargerBanque().exercices;

  const attendreFin = () => page.waitForFunction(() => {
    const b = document.querySelector("#entr-app .entr-commandes button");
    return b && b.textContent === "Vérifier" && !b.disabled;
  }, null, { timeout: 90000 });
  const ecrire = (code) => page.evaluate((c) => document.querySelector(".CodeMirror").CodeMirror.setValue(c), code);
  const lancer = async () => {
    await page.evaluate(() => { document.querySelector(".entr-resultat").replaceChildren(); });
    await page.locator("#entr-app .entr-commandes button").first().click();
    await page.waitForSelector(".entr-resultat > *", { timeout: 90000 });
    await attendreFin();
    return page.locator(".entr-resultat").innerText();
  };

  let ok = 0, ko = 0;
  for (const exo of exos) {
    await page.goto(URL_PAGE + "#/exo/" + exo.id);
    await page.waitForSelector(".entr-titre");
    const problemes = [];
    if ((await page.locator(".entr-titre").innerText()) !== exo.titre) problemes.push("titre");
    if ((await page.locator(".entr-signaler a").getAttribute("href")).indexOf("mailto:") !== 0) problemes.push("signalement");
    // Du Markdown non converti, en dehors du code : des ** ou des ``` restes tels quels.
    const horsCode = await page.locator("#entr-app").evaluate((e) => {
      const copie = e.cloneNode(true);
      copie.querySelectorAll("code, pre").forEach((c) => c.remove());
      return copie.innerText;
    });
    if (/\*\*|```|`/.test(horsCode)) problemes.push("markdown mal rendu");
    if (exo.type === "prediction" || exo.type === "qcm") {
      const n = await page.locator(".entr-choix__bouton").count();
      if (n !== exo.choix.length) problemes.push("nombre de choix : " + n);
      await page.locator(".entr-choix__bouton:not([data-bonne])").first().click();
      if (!/pas la bonne réponse/.test(await page.locator("#entr-app").innerText())) problemes.push("mauvaise réponse acceptée");
      await page.locator(".entr-choix__bouton[data-bonne]").click();
      if (!/Bonne réponse/.test(await page.locator("#entr-app").innerText())) problemes.push("bonne réponse refusée");
      if (exo.image && !(await page.locator(".entr-figure img").evaluate((i) => i.complete && i.naturalWidth > 0))) problemes.push("image non chargée");
    } else if (exo.type === "generateur") {
      const bonne = require("./calcul-attendu.js")(exo.generateur, await page.locator(".entr-enonce").innerText());
      await page.locator(".entr-champ--reponse").fill(bonne);
      await page.locator(".entr-reponse button").click();
      if (!/Bonne réponse/.test(await page.locator("#entr-app").innerText())) problemes.push("réponse tirée au hasard refusée : " + bonne);
    } else if (exo.type === "reponse") {
      await page.locator(".entr-champ--reponse").fill("pas ça");
      await page.locator(".entr-reponse button").click();
      if (!/pas la bonne réponse/.test(await page.locator("#entr-app").innerText())) problemes.push("mauvaise réponse acceptée");
      for (const r of exo.reponses) {
        await page.goto(URL_PAGE + "#/");
        await page.goto(URL_PAGE + "#/exo/" + exo.id);
        await page.waitForFunction(() => document.querySelector(".entr-champ--reponse")?.value === "");
        await page.locator(".entr-champ--reponse").fill("  " + String(r).toUpperCase() + " ");
        await page.locator(".entr-reponse button").click();
        if (!/Bonne réponse/.test(await page.locator("#entr-app").innerText())) problemes.push("réponse acceptée refusée : " + r);
      }
    } else {
      await page.waitForSelector(".CodeMirror");
      await attendreFin();
      const depart = await lancer();
      if (/Réussi/.test(depart)) problemes.push("le départ est accepté");
      for (const [rang, solution] of [exo.solution, ...(exo.autres_solutions || [])].entries()) {
        await ecrire(solution);
        const r = await lancer();
        if (!/Réussi/.test(r)) problemes.push((rang ? "autre solution " + rang : "solution") + " refusée : " + r.slice(0, 200));
      }
      if (exo.aides.length !== 3) problemes.push("aides");
      for (let i = 0; i < 3; i++) await page.locator("#entr-app .entr-commandes button").nth(1).dispatchEvent("click");
      if ((await page.locator(".entr-aide").count()) !== 3) problemes.push("aides affichées : " + (await page.locator(".entr-aide").count()));
    }
    if (problemes.length) { ko++; console.log("ECHEC " + exo.id + " : " + problemes.join(" ; ")); } else ok++;
  }
  console.log(ok + " exercices corrects, " + ko + " en échec, sur " + exos.length);
  console.log("erreurs de page : " + (erreurs.length ? erreurs.join(" | ") : "aucune"));

  // Quelques captures pour relire
  const c = await navigateur.newContext({ viewport: { width: 1280, height: 900 } });
  await c.addInitScript(() => localStorage.setItem("nsi-entrainement", JSON.stringify({
    exos: { "tarif-cinema": { reussi: true, sansAide: true, aides: 0, code: null }, "doubler-trous": { reussi: true, sansAide: false, aides: 1, code: null }, "factorielle": { reussi: true, sansAide: true, aides: 0, code: null }, "predire-division": { reussi: true, sansAide: true, aides: 0, code: null } },
    serie: { dernier: new Date().toLocaleDateString("sv"), longueur: 2 }, notions: ["listes"], difficultes: [], ouvertes: ["for"],
  })));
  const p = await c.newPage();
  await p.goto(URL_PAGE);
  await p.waitForSelector(".entr-bilan");
  await p.waitForTimeout(400);
  await p.screenshot({ path: path.join(IMG, "accueil.png"), fullPage: true });
  await p.goto(URL_PAGE + "#/exo/suite-de-chiffres");
  await p.waitForSelector(".CodeMirror");
  await p.waitForTimeout(400);
  await p.screenshot({ path: path.join(IMG, "exo.png"), fullPage: true });
  await p.evaluate(() => document.body.setAttribute("data-md-color-scheme", "slate"));
  await p.goto(URL_PAGE + "#/");
  await p.waitForSelector(".entr-bilan");
  await p.evaluate(() => document.body.setAttribute("data-md-color-scheme", "slate"));
  await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(IMG, "accueil-sombre.png"), fullPage: true });
  const t = await navigateur.newPage({ viewport: { width: 375, height: 700 } });
  await t.goto(URL_PAGE + "#/premiere");
  await t.waitForSelector(".entr-bilan");
  await t.waitForTimeout(300);
  const deborde = await t.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  console.log("telephone : " + deborde + " px de debordement");
  await t.screenshot({ path: path.join(IMG, "tel.png"), fullPage: true });
  await navigateur.close();
  const toutBon = ko === 0 && erreurs.length === 0 && deborde <= 0;
  console.log(toutBon ? "TOUT EST OK" : "ECHEC");
  process.exit(toutBon ? 0 : 1);
})().catch((e) => { console.error(String(e).slice(0, 800)); process.exit(1); });
