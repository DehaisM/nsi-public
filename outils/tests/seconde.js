// Scenario d'un eleve de Seconde : choix du niveau, questions, serie de revision, changement d'appareil.
const attendu = require("./calcul-attendu.js");
const path = require("path");
const { URL_PAGE, SITE, chargerBanque, lancerNavigateur, dossierCaptures, verificateur } = require("./commun.js");
const IMG = dossierCaptures("seconde");

const verif = verificateur();
const texte = (p) => p.locator("#entr-app").innerText();

(async () => {
  const banque = chargerBanque();
  const nbSeconde = banque.duNiveau("seconde").length;
  const nbPremiere = banque.duNiveau("premiere").length;
  const b = await lancerNavigateur();
  const c = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await c.newPage();
  const erreurs = [];
  p.on("pageerror", (e) => erreurs.push(e.message));

  // Premiere visite : le choix du niveau
  await p.goto(URL_PAGE);
  await p.waitForSelector(".entr-choix-niveau");
  verif("premiere visite : choix du niveau", (await p.locator(".entr-choix-niveau button").count()) === 2);
  await p.screenshot({ path: path.join(IMG, "1-choix.png") });
  await p.locator(".entr-choix-niveau button", { hasText: "Seconde" }).click();
  await p.waitForSelector(".entr-bilan");
  let t = await texte(p);
  verif("accueil Seconde : un point par question", (await p.locator(".entr-reseau .entr-arret").count()) === nbSeconde);
  verif("accueil Seconde : 2 chapitres, pas de Python", /Internet, chapitre 1/.test(t) && !/Boucles for/.test(t));
  verif("accueil Seconde : mots adaptés", /Question du jour/i.test(t) && /Questions par chapitre/.test(t) && t.includes("0 question réussie sur " + nbSeconde), t.match(/\d+ question[^.]*/)?.[0]);
  await p.screenshot({ path: path.join(IMG, "2-accueil.png"), fullPage: true });
  await p.reload();
  await p.waitForSelector(".entr-bilan");
  verif("le niveau est retenu", /Questions par chapitre/.test(await texte(p)));

  // Une question a choix
  await p.goto(URL_PAGE + "#/exo/role-routeur");
  await p.waitForSelector(".entr-choix__bouton");
  verif("question : pas d'éditeur Python", (await p.locator(".CodeMirror").count()) === 0);
  verif("question : le chapitre en surtitre", (await p.locator(".entr-surtitre").innerText()) === "Internet, chapitre 1");
  await p.locator(".entr-choix__bouton:not([data-bonne])").first().click();
  verif("mauvais choix : on peut réessayer", /Essayer encore/.test(await texte(p)));
  await p.locator(".entr-choix__bouton[data-bonne]").click();
  t = await texte(p);
  verif("bon choix : explication et passage du cours", /Bonne réponse/.test(t) && /À relire dans le cours : Chapitre 1/.test(t));
  await p.screenshot({ path: path.join(IMG, "3-qcm.png"), fullPage: true });

  // Une question avec image
  await p.goto(URL_PAGE + "#/exo/filius-numero-3");
  await p.waitForSelector(".entr-figure img");
  verif("image affichée", await p.waitForFunction(() => { const i = document.querySelector(".entr-figure img"); return i.complete && i.naturalWidth > 500; }, null, { timeout: 30000 }).then(() => true, () => false));
  await p.locator(".entr-choix__bouton[data-bonne]").click();
  await p.screenshot({ path: path.join(IMG, "4-image.png"), fullPage: true });

  // Une reponse courte
  await p.goto(URL_PAGE + "#/exo/adresse-reseau-26");
  await p.waitForSelector(".entr-champ--reponse");
  verif("réponse courte : indication dans la case", (await p.locator(".entr-champ--reponse").getAttribute("placeholder")) === "Quatre nombres séparés par des points");
  for (const essai of ["10.0.0.200", "10.0.0.0"]) {
    await p.locator(".entr-champ--reponse").fill(essai);
    await p.keyboard.press("Enter");
  }
  verif("deux erreurs : voir la réponse proposé", (await p.locator("button", { hasText: "Voir la réponse" }).count()) === 1);
  await p.locator(".entr-champ--reponse").fill(" 10.0.0.192 ");
  await p.keyboard.press("Enter");
  verif("réponse juste, espaces tolérés", /Bonne réponse/.test(await texte(p)));
  await p.screenshot({ path: path.join(IMG, "5-reponse.png"), fullPage: true });
  await p.goto(URL_PAGE + "#/exo/ipv4-octets");
  await p.waitForSelector(".entr-champ--reponse");
  await p.locator(".entr-champ--reponse").fill("Quatre");
  await p.keyboard.press("Enter");
  verif("réponse en toutes lettres et majuscule acceptée", /Bonne réponse/.test(await texte(p)));
  await p.goto(URL_PAGE + "#/exo/arpanet-1969");
  await p.waitForSelector(".entr-champ--reponse");
  await p.locator(".entr-champ--reponse").fill("5");
  await p.keyboard.press("Enter");
  await p.locator(".entr-champ--reponse").fill("6");
  await p.keyboard.press("Enter");
  await p.locator("button", { hasText: "Voir la réponse" }).click();
  t = await texte(p);
  verif("voir la réponse : réponse et explication, non comptée", /Bonne réponse : 4/.test(t));

  // Une serie limitee au chapitre 2
  await p.goto(URL_PAGE + "#/");
  await p.waitForSelector(".entr-bilan");
  const bilanSeconde = await p.locator(".entr-bilan").innerText();
  verif("bilan : 4 réussies dont 2 du premier coup", bilanSeconde.includes("4 questions réussies sur " + nbSeconde + ", dont 2 du premier coup"), bilanSeconde);
  await p.locator(".entr-filtre", { hasText: "Internet, chapitre 2" }).click();
  await p.locator("button", { hasText: "Série de 10 questions" }).click();
  await p.waitForSelector(".entr-surtitre");
  const chapitres = new Set();
  let juste = 0;
  for (let i = 0; i < 10; i++) {
    const sur = await p.locator(".entr-surtitre").innerText();
    verif("série : question " + (i + 1) + " sur 10", sur.startsWith("Question " + (i + 1) + " sur 10"), sur);
    chapitres.add(sur.split(", ").slice(1).join(", "));
    const reussir = i % 3 !== 0;
    if (await p.locator(".entr-choix__bouton").count()) {
      await p.locator(reussir ? ".entr-choix__bouton[data-bonne]" : ".entr-choix__bouton:not([data-bonne])").first().click();
      verif("série : choix verrouillés après une réponse", (await p.locator(".entr-choix__bouton:not(:disabled)").count()) === 0);
    } else {
      const banqueQ = await p.evaluate(async (titre) => {
        const lire = async (n) => jsyaml.load(await (await fetch("exercices/" + n + ".yml")).text());
        return (await lire("internet-2")).exercices.find((e) => e.titre === titre);
      }, await p.locator(".entr-titre").innerText());
      const bonne = banqueQ.type === "generateur"
        ? attendu(banqueQ.generateur, await p.locator(".entr-enonce").innerText())
        : banqueQ.reponses[0];
      await p.locator(".entr-champ--reponse").fill(reussir ? String(bonne) : "faux");
      await p.keyboard.press("Enter");
      verif("série : une seule réponse", await p.locator(".entr-champ--reponse").isDisabled());
    }
    if (reussir) juste++;
    if (i === 0) await p.screenshot({ path: path.join(IMG, "6-serie.png"), fullPage: true });
    await p.locator("button", { hasText: i < 9 ? "Question suivante" : "Voir le score" }).click();
  }
  verif("série : uniquement le chapitre 2", chapitres.size === 1 && chapitres.has("Internet, chapitre 2"), [...chapitres].join(" | "));
  t = await texte(p);
  verif("score affiché", new RegExp("Score : " + juste + " sur 10").test(t), t.match(/Score[^\n]*/)?.[0]);
  verif("questions ratées rappelées", (await p.locator(".entr-rate").count()) === 10 - juste);
  await p.screenshot({ path: path.join(IMG, "7-score.png"), fullPage: true });
  const refaire = await p.locator(".entr-rate a", { hasText: "Refaire" }).first().getAttribute("href");
  await p.locator("button", { hasText: "Nouvelle série" }).click();
  verif("nouvelle série : repart à la question 1", (await p.locator(".entr-surtitre").innerText()).startsWith("Question 1 sur 10"));
  await p.goto(URL_PAGE + refaire);
  await p.waitForSelector(".entr-titre");
  verif("refaire une question ratée", (await p.locator(".entr-retour").innerText()).includes("Toutes les questions"));

  // Le code de sauvegarde, vers un appareil neuf
  await p.goto(URL_PAGE + "#/");
  await p.waitForSelector(".entr-code-sauvegarde");
  const code = await p.locator(".entr-code-sauvegarde").innerText();
  const bilanAvant = (await p.locator(".entr-bilan").innerText()).match(/^\d+/)[0];
  const neuf = await (await b.newContext({ viewport: { width: 375, height: 700 } })).newPage();
  await neuf.goto(URL_PAGE + "#/reprise/" + code);
  await neuf.waitForSelector(".entr-bilan");
  const bilanApres = await neuf.locator(".entr-bilan").innerText();
  verif("appareil neuf : le lien retrouve la Seconde", /question/.test(bilanApres) && bilanApres.startsWith(bilanAvant + " "), bilanApres);
  verif("téléphone : pas de débordement", (await neuf.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0);
  await neuf.screenshot({ path: path.join(IMG, "8-tel.png"), fullPage: true });
  await neuf.goto(URL_PAGE + "#/exo/filius-nombre-routeurs");
  await neuf.waitForSelector(".entr-figure img");
  verif("téléphone, question à image : pas de débordement", (await neuf.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0);
  await neuf.screenshot({ path: path.join(IMG, "9-tel-image.png"), fullPage: true });

  // Le passage a la Premiere, et le lien direct depuis la page Seconde GT
  await p.goto(URL_PAGE + "#/");
  await p.locator(".entr-niveaux button", { hasText: "Première NSI" }).click();
  t = await texte(p);
  verif("Première : les exercices de Python", (await p.locator(".entr-reseau .entr-arret").count()) === nbPremiere && /Exo du jour/i.test(t));
  verif("Première : pas de série", (await p.locator("button", { hasText: "Série de" }).count()) === 0);
  await p.goto(SITE + "SNT/");
  await p.locator(".md-content a[href*='seconde']").click();
  await p.waitForSelector(".entr-bilan");
  verif("lien de la page Seconde GT : ouvre la Seconde", /Questions par chapitre/.test(await texte(p)));

  // Mode sombre
  await p.evaluate(() => document.body.setAttribute("data-md-color-scheme", "slate"));
  await p.goto(URL_PAGE + "#/exo/adresse-valide");
  await p.waitForSelector(".entr-choix__bouton");
  await p.evaluate(() => document.body.setAttribute("data-md-color-scheme", "slate"));
  await p.locator(".entr-choix__bouton:not([data-bonne])").first().click();
  await p.locator(".entr-choix__bouton[data-bonne]").click();
  await p.screenshot({ path: path.join(IMG, "10-sombre.png"), fullPage: true });

  console.log("\nerreurs de page : " + (erreurs.length ? erreurs.join(" | ") : "aucune"));
  verif.verdict();
  await b.close();
})().catch((e) => { console.error(String(e).slice(0, 900)); process.exit(1); });
