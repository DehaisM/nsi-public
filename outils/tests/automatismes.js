// Les automatismes : chaque competence se fait dans le navigateur, avec Python, jusqu'a etre acquise ;
// une erreur remet la serie a zero, une reponse mal ecrite ne compte pas, et le code de
// sauvegarde emporte les competences acquises.
const path = require("path");
const { URL_PAGE, chargerBanque, lancerNavigateur, dossierCaptures, verificateur } = require("./commun.js");
const verif = verificateur();
const IMG = dossierCaptures("automatismes");
const { competences } = chargerBanque();
const ACQUIS = 5;

(async () => {
  const b = await lancerNavigateur();
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const erreurs = [];
  p.on("pageerror", (e) => erreurs.push(e.message));

  const question = () => p.evaluate(() => document.getElementById("entr-app").entrQuestion);
  const serie = async () => Number((await p.locator(".entr-auto__serie").innerText()).match(/: (\d+)/)[1]);
  // Repond, puis attend le verdict (ou le message d'une reponse mal ecrite).
  async function repondre(texte) {
    await p.locator(".entr-auto .entr-champ--reponse").fill(texte);
    await p.keyboard.press("Enter");
    await p.waitForSelector(".entr-auto .entr-message", { timeout: 30000 });
    return p.locator(".entr-auto .entr-message").first().innerText();
  }
  async function suivante() {
    const avant = (await question()).enonce + (await question()).code;
    await p.keyboard.press("Enter"); // le bouton "Question suivante" a le focus
    await p.waitForFunction((a) => {
      const q = document.getElementById("entr-app").entrQuestion;
      return document.querySelector(".entr-auto .entr-champ--reponse:not([disabled])") && q && (q.enonce + q.code) !== a;
    }, avant, { timeout: 30000 }).catch(() => {});
  }

  await p.goto(URL_PAGE + "#/premiere");
  await p.waitForSelector(".entr-onglets");
  verif("Première : l'onglet Exercices d'abord, sans les automatismes", (await p.locator(".entr-automatismes").count()) === 0);
  await p.locator(".entr-onglet", { hasText: "Automatismes" }).click();
  await p.waitForSelector(".entr-automatismes");
  verif("onglet Automatismes : une tuile par compétence", (await p.locator(".entr-competence").count()) === competences.length, String(competences.length));
  const themes = [...new Set(competences.map((c) => c.theme))];
  verif("onglet Automatismes : un titre par thème", JSON.stringify(await p.locator(".entr-theme").allInnerTexts()) === JSON.stringify(themes));
  await p.reload();
  await p.waitForSelector(".entr-onglets");
  verif("l'onglet est retenu", (await p.locator(".entr-automatismes").count()) === 1);

  for (const c of competences) {
    await p.goto(URL_PAGE + "#/auto/" + c.id);
    await p.waitForSelector(".entr-auto .entr-champ--reponse", { timeout: 60000 });
    let message = "";
    for (let i = 0; i < ACQUIS; i++) {
      message = await repondre((await question()).reponse);
      if (!/Bonne réponse/.test(message)) break;
      if (i < ACQUIS - 1) await suivante();
    }
    verif(c.id + " : " + ACQUIS + " bonnes réponses, compétence acquise", /Compétence acquise/.test(message), message.slice(0, 160));
    if (c.id === "range") await p.screenshot({ path: path.join(IMG, "acquise.png"), fullPage: true });
  }

  // Une erreur remet la serie a zero ; une reponse mal ecrite ne compte pas.
  await p.goto(URL_PAGE + "#/auto/division");
  await p.waitForSelector(".entr-auto .entr-champ--reponse", { timeout: 60000 });
  await repondre((await question()).reponse);
  await suivante();
  const avant = await serie();
  const mal = await repondre("abc");
  verif("réponse mal écrite : un conseil, et la série ne bouge pas", /non comprise/.test(mal) && (await serie()) === avant, mal);
  const q = await question();
  const fausse = q.erreur ? "0" : "erreur";
  const verdict = await repondre(fausse);
  verif("mauvaise réponse : la bonne est donnée, et la série repart de 0", /pas la bonne/.test(verdict) && verdict.includes(q.reponse) && (await serie()) === 0, verdict.slice(0, 120));
  await p.screenshot({ path: path.join(IMG, "erreur.png"), fullPage: true });

  // L'accueil, puis le code de sauvegarde sur un autre appareil.
  await p.goto(URL_PAGE + "#/");
  await p.waitForSelector(".entr-automatismes");
  verif("accueil : toutes les compétences acquises", (await p.locator(".entr-competence--acquise").count()) === competences.length);
  await p.locator(".entr-automatismes").screenshot({ path: path.join(IMG, "accueil.png") });
  const code = await p.locator(".entr-code-sauvegarde").innerText();
  const autre = await (await b.newContext({ viewport: { width: 375, height: 700 }, isMobile: true, hasTouch: true })).newPage();
  await autre.goto(URL_PAGE + "#/reprise/" + code);
  await autre.waitForSelector(".entr-onglets");
  await autre.goto(URL_PAGE + "#/automatismes");
  await autre.waitForSelector(".entr-automatismes");
  verif("code de sauvegarde : les compétences acquises suivent", (await autre.locator(".entr-competence--acquise").count()) === competences.length, code);
  await autre.screenshot({ path: path.join(IMG, "telephone-onglet.png"), fullPage: true });
  await autre.goto(URL_PAGE + "#/auto/fonctions");
  await autre.waitForSelector(".entr-auto .entr-champ--reponse", { timeout: 60000 });
  verif("téléphone : pas de débordement", (await autre.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0);
  await autre.screenshot({ path: path.join(IMG, "telephone.png"), fullPage: true });

  await p.locator(".entr-niveaux button", { hasText: "Seconde" }).click();
  verif("pas d'automatismes en Seconde", (await p.locator(".entr-automatismes").count()) === 0);

  console.log("erreurs de page : " + (erreurs.length ? erreurs.join(" | ") : "aucune"));
  verif("aucune erreur de page", erreurs.length === 0);
  verif.verdict();
  await b.close();
})().catch((e) => { console.error(String(e).slice(0, 700)); process.exit(1); });
