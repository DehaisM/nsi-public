// Le filtre "Maths" : il ne garde que les exercices etiquetes, se combine aux autres filtres et se retient.
const path = require("path");
const { URL_PAGE, lancerNavigateur, dossierCaptures, verificateur } = require("./commun.js");
const verif = verificateur();

(async () => {
  const b = await lancerNavigateur();
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const erreurs = [];
  p.on("pageerror", (e) => erreurs.push(e.message));
  await p.goto(URL_PAGE + "#/premiere");
  await p.waitForSelector(".entr-bilan");
  const banque = await p.evaluate(async () => {
    const lire = async (n) => jsyaml.load(await (await fetch("exercices/" + n + ".yml")).text());
    const { notions } = await lire("notions");
    return (await Promise.all(notions.map((n) => lire(n.id)))).flatMap((l) => l.exercices).map((e) => ({ id: e.id, titre: e.titre, notion: e.notion, maths: (e.tags || []).includes("maths"), niveaux: e.niveaux }));
  });
  const premiere = banque.filter((e) => e.niveaux.includes("premiere"));
  const nbMaths = premiere.filter((e) => e.maths).length;
  // Le nombre d'exos retenus, affiche dans le bloc "Au hasard".
  const retenus = async () => Number((await p.locator(".entr-hasard__compte").innerText()).match(/^\d+/)?.[0] || 0);

  verif("le bouton Maths est là en Première", (await p.locator(".entr-filtre", { hasText: "Maths" }).count()) === 1);
  await p.locator(".entr-filtre", { hasText: "Maths" }).click();
  verif("filtre Maths : le bloc hasard compte les exos de maths", (await retenus()) === nbMaths, (await retenus()) + " sur " + nbMaths);
  await p.screenshot({ path: path.join(dossierCaptures(), "filtre-maths.png"), fullPage: true });
  for (let i = 0; i < 8; i++) {
    await p.goto(URL_PAGE + "#/");
    await p.waitForSelector(".entr-bilan");
    await p.locator("button", { hasText: "Un exo au hasard" }).click();
    await p.waitForSelector(".entr-titre");
    const titre = await p.locator(".entr-titre").innerText();
    verif("hasard " + (i + 1) + " : un exercice de maths", premiere.some((e) => e.titre === titre && e.maths), titre);
  }
  await p.goto(URL_PAGE + "#/");
  await p.reload();
  await p.waitForSelector(".entr-bilan");
  verif("le filtre est retenu", (await p.locator(".entr-filtre--etiquette").getAttribute("aria-pressed")) === "true");
  await p.locator(".entr-filtre", { hasText: "Tuples" }).click();
  const attendus = premiere.filter((e) => e.maths && e.notion === "tuples").length;
  verif("Maths et Tuples ensemble", (await retenus()) === attendus && attendus > 0, (await retenus()) + " sur " + attendus);
  await p.locator(".entr-filtre", { hasText: "Maths" }).click();
  await p.locator(".entr-filtre", { hasText: "Tuples" }).click();
  verif("sans filtre : tout revient", (await retenus()) === premiere.length);
  await p.locator(".entr-niveaux button", { hasText: "Seconde" }).click();
  verif("pas de bouton Maths en Seconde", (await p.locator(".entr-filtre", { hasText: "Maths" }).count()) === 0);
  console.log("erreurs de page : " + (erreurs.length ? erreurs.join(" | ") : "aucune"));
  verif.verdict();
  await b.close();
})().catch((e) => { console.error(String(e).slice(0, 700)); process.exit(1); });
