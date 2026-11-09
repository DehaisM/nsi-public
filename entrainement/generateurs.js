// Questions de calcul a valeurs tirees au hasard : a chaque essai, de nouvelles valeurs,
// et une explication refaite sur ces valeurs-la.
//
// Chaque generateur recoit une fonction de hasard (Math.random par defaut) et renvoie :
// enonce, indication, reponses (la premiere est affichee), explication, resume (les valeurs
// en bref, pour les messages du controle) et donnees (les valeurs, pour outils/controler_generateurs.py).
const Generateurs = (function () {
  "use strict";

  const PUISSANCES = [128, 64, 32, 16, 8, 4, 2, 1];
  const EXPOSANTS = "⁰¹²³⁴⁵⁶⁷⁸⁹";
  const ORDINAUX = ["premier", "deuxième", "troisième", "quatrième"];
  const TABLEAU = "le tableau des puissances de 2 (128, 64, 32, 16, 8, 4, 2, 1)";

  function entier(hasard, min, max) {
    return min + Math.floor(hasard() * (max - min + 1));
  }

  function binaire(n) {
    return n.toString(2).padStart(8, "0");
  }

  function puissance(k) {
    return "2" + String(k).split("").map((c) => EXPOSANTS[c]).join("");
  }

  // "a", "a et b", "a, b et c"
  function liste(mots) {
    return mots.length <= 1 ? mots.join("") : mots.slice(0, -1).join(", ") + " et " + mots[mots.length - 1];
  }

  function poids(n) {
    return PUISSANCES.filter((p) => n & p);
  }

  function adresse(hasard) {
    return [entier(hasard, 1, 223), entier(hasard, 0, 255), entier(hasard, 0, 255), entier(hasard, 0, 255)];
  }

  // De /8 a /30, et 3 fois sur 4 un masque qui tombe au milieu d'un octet, comme /26.
  function masque(hasard) {
    if (hasard() < 0.25) return [8, 16, 24][entier(hasard, 0, 2)];
    let m;
    do {
      m = entier(hasard, 9, 30);
    } while (m % 8 === 0);
    return m;
  }

  function adresseReseau(ip, m) {
    return ip.map((octet, i) => {
      const garde = Math.max(0, Math.min(8, m - 8 * i));
      return octet & ((0xff << (8 - garde)) & 0xff);
    });
  }

  const GENERATEURS = {
    "octet-vers-binaire"(hasard) {
      const n = entier(hasard, 1, 254);
      const p = poids(n);
      return {
        resume: String(n),
        donnees: { n },
        enonce: "Convertir le nombre " + n + " en binaire, sur 8 bits.",
        indication: "8 chiffres, 0 ou 1",
        reponses: [binaire(n)],
        explication: (p.length === 1
          ? n + " est une puissance de 2 : on place un seul 1, sous " + n + ", dans " + TABLEAU
          : n + " = " + p.join(" + ") + ". On place un 1 sous " + liste(p.map(String)) + " dans " + TABLEAU)
          + ", et un 0 ailleurs : on obtient `" + binaire(n) + "`.",
      };
    },

    "octet-vers-decimal"(hasard) {
      const n = entier(hasard, 1, 254);
      const p = poids(n);
      return {
        resume: binaire(n),
        donnees: { octet: binaire(n) },
        enonce: "Convertir l'octet `" + binaire(n) + "` en décimal.",
        indication: "Un nombre",
        reponses: [String(n)],
        explication: p.length === 1
          ? "Dans " + TABLEAU + ", le seul bit à 1 est sous " + n + " : l'octet vaut " + n + "."
          : "Dans " + TABLEAU + ", les bits à 1 sont sous " + liste(p.map(String)) + " : " + p.join(" + ") + " = " + n + ".",
      };
    },

    "adresse-vers-decimal"(hasard) {
      const ip = adresse(hasard);
      const enBinaire = ip.map(binaire).join(".");
      return {
        resume: enBinaire,
        donnees: { binaire: enBinaire },
        enonce: "Convertir en décimal pointé l'adresse IP suivante, donnée en binaire :\n\n`" + enBinaire + "`",
        indication: "Quatre nombres séparés par des points",
        reponses: [ip.join(".")],
        explication: "On convertit chaque octet séparément : " + liste(ip.map((o) => "`" + binaire(o) + "` vaut " + o))
          + ". L'adresse est donc " + ip.join(".") + ".",
      };
    },

    "adresse-vers-binaire"(hasard) {
      const ip = adresse(hasard);
      const enBinaire = ip.map(binaire).join(".");
      return {
        resume: ip.join("."),
        donnees: { adresse: ip.join(".") },
        enonce: "Convertir en binaire l'adresse IP `" + ip.join(".") + "`, octet par octet, en séparant les octets par des points.",
        indication: "Quatre groupes de 8 bits séparés par des points",
        reponses: [enBinaire],
        explication: "Chaque nombre s'écrit sur 8 bits : " + liste(ip.map((o) => o + " donne `" + binaire(o) + "`"))
          + ". L'adresse s'écrit donc `" + enBinaire + "`.",
      };
    },

    "bits-machine"(hasard) {
      const m = entier(hasard, 8, 30);
      return {
        resume: "/" + m,
        donnees: { masque: m },
        enonce: "Avec un masque `/" + m + "`, combien de bits reste-t-il pour la partie machine ?",
        indication: "Un nombre",
        reponses: [String(32 - m)],
        explication: "Une adresse IPv4 compte 32 bits. Le masque `/" + m + "` en réserve " + m
          + " au réseau : il en reste 32 - " + m + " = " + (32 - m) + " pour la machine.",
      };
    },

    // Une fois sur deux, le nombre de machines : on retire les deux adresses reservees.
    "nombre-adresses"(hasard) {
      const m = entier(hasard, 16, 30);
      const machines = hasard() < 0.5;
      const k = 32 - m;
      const total = Math.pow(2, k);
      const debut = "Il reste 32 - " + m + " = " + k + " bits pour la machine, donc " + puissance(k) + " = " + total + " adresses";
      if (!machines) {
        return {
          resume: "/" + m + " adresses",
          donnees: { masque: m, machines },
          enonce: "Combien d'adresses sont possibles dans un réseau `/" + m + "` ?",
          indication: "Un nombre",
          reponses: [String(total), "2^" + k],
          explication: debut + " possibles.",
        };
      }
      return {
        resume: "/" + m + " machines",
        donnees: { masque: m, machines },
        enonce: "Combien de machines peut-on connecter dans un réseau `/" + m + "` ?",
        indication: "Un nombre",
        reponses: [String(total - 2), "2^" + k + "-2"],
        explication: debut + ". On retire l'adresse réseau et l'adresse de diffusion, qui ne sont jamais données à une machine : "
          + total + " - 2 = " + (total - 2) + " machines.",
      };
    },

    "adresse-reseau"(hasard) {
      let ip;
      let m;
      let reseau;
      // On veut une partie machine non nulle : sinon, l'adresse est deja sa propre adresse reseau.
      do {
        ip = adresse(hasard);
        m = masque(hasard);
        reseau = adresseReseau(ip, m);
      } while (reseau.join(".") === ip.join("."));
      const k = Math.floor(m / 8);
      const r = m % 8;
      let explication;
      if (r === 0) {
        explication = "Avec `/" + m + "`, " + (k === 1 ? "le premier octet forme la partie réseau et reste identique" : "les " + k + " premiers octets forment la partie réseau et restent identiques")
          + ". Les autres octets appartiennent à la machine : tous leurs bits passent à 0.";
      } else {
        const avant = k === 0 ? "" : (k === 1 ? "Le premier octet reste identique. " : "Les " + k + " premiers octets restent identiques. ");
        const remplacement = 8 - r === 1 ? "on remplace le dernier par un 0" : "on remplace les " + (8 - r) + " autres par des 0";
        explication = avant + "Le `/" + m + "` tombe dans le " + ORDINAUX[k] + " octet : " + ip[k] + " s'écrit `" + binaire(ip[k]) + "`. "
          + "On garde " + (r === 1 ? "son premier bit" : "ses " + r + " premiers bits") + " (`" + binaire(ip[k]).slice(0, r) + "`) et " + remplacement
          + " : `" + binaire(reseau[k]) + "`, soit " + reseau[k] + "."
          + (k < 3 ? " Les octets suivants passent à 0." : "");
      }
      return {
        resume: ip.join(".") + "/" + m,
        donnees: { adresse: ip.join("."), masque: m },
        enonce: "Quelle est l'adresse réseau de `" + ip.join(".") + "/" + m + "` ?",
        indication: "Quatre nombres séparés par des points",
        reponses: [reseau.join(".")],
        explication: explication + " L'adresse réseau est donc " + reseau.join(".") + ".",
      };
    },
  };

  function tirer(nom, hasard) {
    if (!GENERATEURS[nom]) throw new Error("Générateur inconnu : " + nom);
    return GENERATEURS[nom](hasard || Math.random);
  }

  return { tirer, noms: Object.keys(GENERATEURS) };
})();

if (typeof module !== "undefined") module.exports = Generateurs;
