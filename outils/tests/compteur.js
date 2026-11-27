// Le compteur anonyme, sur le site publie : la page envoie les bons signaux, et rien qui
// identifie un eleve. Les signaux sont interceptes et jamais transmis a GoatCounter : ce test
// ne fausse pas les statistiques.
const { lancerNavigateur, verificateur } = require("./commun.js");
const verif = verificateur();
const BASE = (process.env.SITE || "https://nsi.mdehais.fr/").replace(/\/?$/, "/");

(async () => {
  const b = await lancerNavigateur();
  const c = await b.newContext();
  // Comme un vrai eleve : un navigateur qui n'est pas pilote par un test.
  await c.addInitScript(() => Object.defineProperty(navigator, "webdriver", { get: () => false }));
  const envoyes = [];
  await c.route("https://*.goatcounter.com/**", (route) => {
    envoyes.push(new URL(route.request().url()));
    route.fulfill({ status: 200, body: "" });
  });
  const p = await c.newPage();
  await p.goto(BASE + "entrainement/?v=" + Date.now() + "#/exo/role-routeur");
  await p.waitForSelector(".entr-choix__bouton");
  await p.locator(".entr-choix__bouton[data-bonne]").click();
  // Une deuxieme reussite du meme exercice ne compte pas.
  await p.goto(BASE + "entrainement/#/");
  await p.goto(BASE + "entrainement/#/exo/role-routeur");
  await p.waitForSelector(".entr-choix__bouton");
  await p.locator(".entr-choix__bouton[data-bonne]").click();
  await p.goto(BASE + "entrainement/#/");
  await p.waitForSelector(".entr-note");

  const chemins = envoyes.map((u) => u.searchParams.get("p"));
  verif("signaux : ouvert, réussi, ouvert", JSON.stringify(chemins) === JSON.stringify(
    ["/ouvert/seconde/role-routeur", "/reussi/seconde/role-routeur", "/ouvert/seconde/role-routeur"]), chemins.join(" | "));
  const parametres = new Set(envoyes.flatMap((u) => [...u.searchParams.keys()]));
  verif("rien d'autre que le chemin, le titre et l'anti-cache", [...parametres].every((k) => ["e", "p", "t", "rnd"].includes(k)), [...parametres].join(", "));
  verif("la note prévient les élèves", /compte de façon anonyme/.test(await p.locator(".entr-note").innerText()));
  verif.verdict();
  await b.close();
})().catch((e) => { console.error(String(e).slice(0, 700)); process.exit(1); });
