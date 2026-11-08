// Les questions tirees au hasard, dans le navigateur : bonne reponse acceptee, mauvaise refusee,
// nouvelles valeurs, serie, bilan et signalement.
const path = require("path");
const attendu = require("./calcul-attendu.js");
const { URL_PAGE, SITE, RACINE, chargerBanque, lancerNavigateur, dossierCaptures } = require("./commun.js");
const IMG = dossierCaptures("hasard");
const TOURS = Number(process.env.TOURS || 25);

let echecs = 0;
const vus = [];
function verif(nom, ok, detail) {
  if (!ok) { console.log("ECHEC " + nom + (detail ? "  -> " + detail : "")); echecs++; }
  vus.push(nom);
}

(async () => {
  const b = await lancerNavigateur();
  const c = await b.newContext({ viewport: { width: 1280, height: 900 } });
  await c.addInitScript(() => { if (!localStorage.getItem("nsi-entrainement")) localStorage.setItem("nsi-entrainement", JSON.stringify({ niveau: "seconde" })); });
  const p = await c.newPage();
  const erreurs = [];
  p.on("pageerror", (e) => erreurs.push(e.message));
  await p.goto(URL_PAGE + "#/seconde");
  await p.waitForSelector(".entr-bilan");
  const exos = await p.evaluate(async () => jsyaml.load(await (await fetch("exercices/internet-2.yml")).text()).exercices.filter((e) => e.type === "generateur"));
  const attendus = chargerBanque().exercices.filter((e) => e.type === "generateur").length;
  verif("tous les générateurs de la banque", exos.length === attendus && attendus > 0, exos.length + " sur " + attendus);

  const enonce = () => p.locator(".entr-enonce").innerText();
  const repondre = async (texte) => {
    await p.locator(".entr-champ--reponse").fill(texte);
    await p.keyboard.press("Enter");
    return p.locator("#entr-app").innerText();
  };

  let questions = 0;
  for (const exo of exos) {
    await p.goto(URL_PAGE + "#/exo/" + exo.id);
    await p.waitForSelector(".entr-champ--reponse");
    const infos = await p.locator(".entr-infos").innerText();
    verif(exo.id + " : mention du hasard", /valeurs tirées au hasard/.test(infos), infos);
    const textes = new Set();
    for (let i = 0; i < TOURS; i++) {
      const e = await enonce();
      textes.add(e);
      const bonne = attendu(exo.generateur, e);
      questions++;
      if (i % 5 === 0) {
        const t = await repondre("0.0.0.1");
        verif(exo.id + " : mauvaise réponse refusée", /pas la bonne réponse/.test(t));
      }
      const t = await repondre(i % 2 ? " " + bonne + " " : bonne);
      verif(exo.id + " : bonne réponse acceptée", /Bonne réponse/.test(t), e + " / attendu " + bonne);
      verif(exo.id + " : l'explication donne la réponse", t.includes(bonne), bonne);
      if (i === 0) {
        const mail = decodeURIComponent(await p.locator(".entr-signaler a").getAttribute("href"));
        verif(exo.id + " : les valeurs dans le signalement", /\(valeurs : .+\)/.test(mail), mail);
        await p.screenshot({ path: path.join(IMG, exo.generateur + ".png"), fullPage: true });
      }
      await p.locator("button", { hasText: "Nouvelles valeurs" }).click();
      await p.waitForSelector(".entr-champ--reponse:not([disabled])");
    }
    verif(exo.id + " : les valeurs changent", textes.size >= Math.min(5, TOURS), textes.size + " énoncés différents sur " + TOURS);
  }

  // Une serie avec des questions tirees au hasard : le bilan garde les valeurs de la serie
  await p.goto(URL_PAGE + "#/");
  await p.waitForSelector(".entr-bilan");
  let avecHasard = false;
  for (let essai = 0; essai < 6 && !avecHasard; essai++) {
    await p.goto(URL_PAGE + "#/");
    await p.waitForSelector(".entr-bilan");
    await p.locator("button", { hasText: "Série de 10 questions" }).click();
    await p.waitForSelector(".entr-surtitre");
    const ratees = [];
    for (let i = 0; i < 10; i++) {
      const titre = await p.locator(".entr-titre").innerText();
      if (await p.locator(".entr-choix__bouton").count()) {
        await p.locator(".entr-choix__bouton[data-bonne]").click();
      } else if (titre.startsWith("Au hasard")) {
        avecHasard = true;
        const gen = exos.find((e) => e.titre === titre).generateur;
        const e = await enonce();
        ratees.push(attendu(gen, e));
        await repondre("faux");
      } else {
        await repondre("bonne réponse inconnue");
        ratees.push(null);
      }
      await p.locator("button", { hasText: i < 9 ? "Question suivante" : "Voir le score" }).click();
    }
    if (avecHasard) {
      const bilan = await p.locator("#entr-app").innerText();
      for (const r of ratees.filter(Boolean)) verif("bilan : la réponse de la série est rappelée", bilan.includes("Bonne réponse : " + r), r);
      await p.screenshot({ path: path.join(IMG, "bilan.png"), fullPage: true });
    }
  }
  verif("une série a contenu une question tirée au hasard", avecHasard);

  console.log(questions + " questions tirées au hasard faites, " + vus.length + " vérifications");
  console.log("erreurs de page : " + (erreurs.length ? erreurs.join(" | ") : "aucune"));
  console.log(echecs ? echecs + " ECHEC(S)" : "TOUT EST OK");
  await b.close();
})().catch((e) => { console.error(String(e).slice(0, 900)); process.exit(1); });
