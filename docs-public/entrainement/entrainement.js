// Page Entrainement : le reseau des exercices, leur tirage, l'editeur, la correction et la progression.
// La progression reste dans le navigateur de l'eleve : rien n'est envoye nulle part.
(function () {
  "use strict";

  const racine = document.getElementById("entr-app");
  const CLE = "nsi-entrainement";
  const DELAI_MAX_MS = 5000;
  const DIFFICULTES = { 1: "Facile", 2: "Moyen", 3: "Corsé" };
  const NOMS_AIDES = ["Aide 1", "Aide 2", "Aide 3"];
  const PYTHON_ABSENT = "Python n'a pas pu se charger. Vérifier la connexion, puis recharger la page.";
  const TAILLE_SERIE = 10;
  // Les etiquettes que l'on peut filtrer (champ tags des exercices), avec leur nom affiche.
  const ETIQUETTES = { maths: "Maths" };

  // Les mots de la page, selon le niveau choisi.
  const TEXTES = {
    seconde: {
      nom: "Seconde",
      intro: "Des questions sur le cours, pour réviser les notions de base avant les contrôles.",
      jour: "Question du jour",
      hasard: "Une question au hasard",
      lignes: "Questions par chapitre",
      consigne: "Chaque point est une question, plein quand elle est réussie. Ouvrir un chapitre pour voir ses questions.",
      une: "question", des: "questions", reussie: "réussie", premierCoup: "du premier coup",
      suivant: "Question suivante", retour: "← Toutes les questions",
      numeros: false, // pas de numero d'exercice, pas de badge "sans aide"
    },
    premiere: {
      nom: "Première NSI",
      intro: "Des exercices de Python, à faire quand on veut, en quelques minutes.",
      jour: "Exo du jour",
      hasard: "Un exo au hasard",
      lignes: "Exercices par notion",
      consigne: "Chaque point est un exercice, plein quand il est réussi. Ouvrir une notion pour voir leurs titres.",
      une: "exo", des: "exos", reussie: "réussi", premierCoup: "sans aide",
      suivant: "Exo suivant", retour: "← Tous les exercices",
      numeros: true,
    },
  };


  let banque = null;
  let etat = chargerEtat();
  let messageAccueil = null;
  let serieRevision = null;
  let sauvegardePrevue = null;
  const moteur = creerMoteur();

  // --- Outils --------------------------------------------------------------

  function el(balise, attributs, ...enfants) {
    const noeud = document.createElement(balise);
    for (const [nom, valeur] of Object.entries(attributs || {})) {
      if (nom === "onclick") noeud.addEventListener("click", valeur);
      else if (nom === "html") noeud.innerHTML = valeur;
      else if (valeur !== false && valeur !== null && valeur !== undefined) {
        noeud.setAttribute(nom, valeur === true ? "" : valeur);
      }
    }
    for (const enfant of enfants.flat()) {
      if (enfant !== null && enfant !== false && enfant !== undefined) noeud.append(enfant);
    }
    return noeud;
  }

  function echapper(texte) {
    return texte.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  function enLigne(texte) {
    return echapper(texte)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  }

  // Un petit Markdown : paragraphes, `code`, **gras** et blocs de code.
  function enHtml(texte) {
    return texte.trim().split(/\n\s*\n/).map((bloc) => {
      const code = bloc.match(/^```\w*\n([\s\S]*)\n```$/);
      return code ? "<pre><code>" + echapper(code[1]) + "</code></pre>" : "<p>" + enLigne(bloc) + "</p>";
    }).join("");
  }

  function dateLocale(decalage) {
    const d = new Date();
    d.setDate(d.getDate() + (decalage || 0));
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function melanger(liste) {
    const copie = liste.slice();
    for (let i = copie.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copie[i], copie[j]] = [copie[j], copie[i]];
    }
    return copie;
  }

  // --- Progression ---------------------------------------------------------

  function etatVide() {
    return { exos: {}, serie: { dernier: null, longueur: 0 }, notions: [], difficultes: [], ouvertes: [], niveau: null, etiquettes: [] };
  }

  function chargerEtat() {
    try {
      return Object.assign(etatVide(), JSON.parse(localStorage.getItem(CLE)) || {});
    } catch (erreur) {
      return etatVide();
    }
  }

  function sauver() {
    clearTimeout(sauvegardePrevue);
    sauvegardePrevue = null;
    try {
      localStorage.setItem(CLE, JSON.stringify(etat));
    } catch (erreur) {
      // Navigation privee ou stockage bloque : la page marche, sans memoire.
    }
  }

  // Pendant la frappe dans l'editeur, une seule sauvegarde apres une courte pause.
  function sauverBientot() {
    clearTimeout(sauvegardePrevue);
    sauvegardePrevue = setTimeout(sauver, 500);
  }

  const SUIVI_VIDE = Object.freeze({ reussi: false, sansAide: false, aides: 0, code: null });

  // Pour lire la progression d'un exercice, sans rien ajouter a l'etat.
  function lu(id) {
    return etat.exos[id] || SUIVI_VIDE;
  }

  // Pour la modifier : cree l'entree si besoin.
  function suivi(id) {
    if (!etat.exos[id]) etat.exos[id] = Object.assign({}, SUIVI_VIDE);
    return etat.exos[id];
  }

  function noterReussite(id, sansAide) {
    const s = suivi(id);
    s.reussi = true;
    if (sansAide) s.sansAide = true;
    const aujourdhui = dateLocale();
    if (etat.serie.dernier !== aujourdhui) {
      etat.serie.longueur = etat.serie.dernier === dateLocale(-1) ? etat.serie.longueur + 1 : 1;
      etat.serie.dernier = aujourdhui;
    }
    sauver();
  }

  function serieEnCours() {
    const encoreValide = etat.serie.dernier === dateLocale() || etat.serie.dernier === dateLocale(-1);
    return encoreValide ? etat.serie.longueur : 0;
  }

  // --- Code de sauvegarde --------------------------------------------------
  // Le format est dans code-sauvegarde.js.

  function creerCode() {
    const reussites = banque.exercices
      .filter((exo) => etat.exos[exo.id] && etat.exos[exo.id].reussi)
      .map((exo) => ({ numero: exo.numero, sansAide: etat.exos[exo.id].sansAide }));
    return CodeSauvegarde.creer(reussites, etat.serie);
  }

  // Ajoute le contenu d'un code a la progression, sans jamais rien retirer.
  // Renvoie le nombre d'exercices reussis gagnes sur cet appareil.
  function fusionner(contenu) {
    let gagnes = 0;
    for (const exo of banque.exercices) {
      if (!contenu.reussites.has(exo.numero)) continue;
      const s = suivi(exo.id);
      if (!s.reussi) gagnes += 1;
      s.reussi = true;
      if (contenu.reussites.get(exo.numero)) s.sansAide = true;
    }
    if (contenu.dernier) {
      const local = etat.serie;
      if (!local.dernier || contenu.dernier > local.dernier) {
        etat.serie = { dernier: contenu.dernier, longueur: contenu.longueur };
      } else if (contenu.dernier === local.dernier) {
        local.longueur = Math.max(local.longueur, contenu.longueur);
      }
    }
    sauver();
    return gagnes;
  }

  function appliquerCode(saisie) {
    const contenu = CodeSauvegarde.lire(saisie);
    if (!contenu) {
      messageAccueil = { genre: "erreur", texte: "Ce code n'est pas valide : vérifier qu'il n'y a pas de faute de frappe." };
      return;
    }
    const gagnes = fusionner(contenu);
    if (!etat.niveau) {
      // Sur un appareil neuf, le niveau se deduit des exercices recuperes.
      const recupere = banque.exercices.find((exo) => contenu.reussites.has(exo.numero));
      if (recupere) choisirNiveau(niveauDe(recupere.notion));
    }
    const texte = gagnes === 0
      ? "Code bien lu, mais il n'apporte aucun exo de plus sur cet appareil."
      : "Progression récupérée : " + gagnes + (gagnes > 1 ? " exos réussis en plus sur cet appareil." : " exo réussi en plus sur cet appareil.");
    messageAccueil = { genre: "reussi", texte };
  }

  function boutonCopier(libelle, texte) {
    return el("button", {
      class: "entr-bouton",
      async onclick(evenement) {
        const bouton = evenement.currentTarget;
        try {
          await navigator.clipboard.writeText(texte);
          bouton.textContent = "Copié !";
          setTimeout(() => { bouton.textContent = libelle; }, 1500);
        } catch (erreur) {
          window.prompt("Copier ce texte :", texte);
        }
      },
    }, libelle);
  }

  function blocSauvegarde(reussis) {
    const champ = el("input", {
      class: "entr-champ",
      type: "text",
      placeholder: "Code de l'autre appareil",
      "aria-label": "Code de sauvegarde de l'autre appareil",
      autocomplete: "off",
      autocapitalize: "characters",
      spellcheck: "false",
    });
    const formulaire = el("form", { class: "entr-reprise" },
      champ,
      el("button", { class: "entr-bouton", type: "submit" }, "Récupérer"));
    formulaire.addEventListener("submit", (evenement) => {
      evenement.preventDefault();
      appliquerCode(champ.value);
      afficher();
      window.scrollTo(0, 0);
    });

    const bloc = el("div", { class: "entr-sauvegarde" }, el("h2", {}, "Changer d'appareil"));
    if (reussis > 0) {
      const code = creerCode();
      const lien = location.origin + location.pathname + "#/reprise/" + code;
      bloc.append(
        el("p", {}, "Pour continuer ailleurs, noter ce code ou s'envoyer le lien :"),
        el("p", { class: "entr-code-sauvegarde" }, code),
        el("div", { class: "entr-actions" }, boutonCopier("Copier le code", code), boutonCopier("Copier le lien", lien)),
        el("p", { class: "entr-consigne" },
          "Ce code contient les exos réussis, les badges et la série à cet instant, mais pas le code en cours d'écriture. Après d'autres exos, il faut reprendre le nouveau code affiché ici.")
      );
    }
    bloc.append(
      el("p", {}, "Déjà un code ? Le saisir ici. Il s'ajoute à ce qui est déjà fait sur cet appareil, rien n'est effacé."),
      formulaire
    );
    return bloc;
  }

  // --- Niveaux -------------------------------------------------------------
  // Chaque notion appartient a un niveau (premiere par defaut). La page n'affiche
  // que les notions du niveau choisi ; la progression et le code de sauvegarde
  // couvrent tous les niveaux.

  function textes() {
    return TEXTES[etat.niveau] || TEXTES.premiere;
  }

  function niveauDe(notionOuId) {
    const notion = typeof notionOuId === "string" ? banque.notions.find((n) => n.id === notionOuId) : notionOuId;
    return notion.niveau || "premiere";
  }

  function notionsDuNiveau(niveau) {
    return banque.notions.filter((n) => niveauDe(n) === (niveau || etat.niveau));
  }

  function exercicesDuNiveau() {
    const ids = notionsDuNiveau().map((n) => n.id);
    return banque.exercices.filter((exo) => ids.includes(exo.notion));
  }

  function choisirNiveau(niveau) {
    etat.niveau = niveau;
    sauver();
  }

  // --- Tirage --------------------------------------------------------------

  function exercicesFiltres() {
    const actives = etat.notions.filter((id) => notionsDuNiveau().some((n) => n.id === id));
    return exercicesDuNiveau().filter((exo) =>
      (actives.length === 0 || actives.includes(exo.notion)) &&
      (etat.difficultes.length === 0 || etat.difficultes.includes(exo.difficulte)) &&
      (etat.etiquettes.length === 0 || (exo.tags || []).some((tag) => etat.etiquettes.includes(tag)))
    );
  }

  // Tire d'abord parmi les exercices pas encore reussis.
  function tirer(idActuel) {
    const candidats = exercicesFiltres().filter((exo) => exo.id !== idActuel);
    const nouveaux = candidats.filter((exo) => !lu(exo.id).reussi);
    const reserve = nouveaux.length ? nouveaux : candidats;
    return reserve.length ? reserve[Math.floor(Math.random() * reserve.length)] : null;
  }

  // Le meme pour tous les eleves un jour donne, calcule a partir de la date.
  function exoDuJour() {
    let empreinte = 2166136261;
    for (const c of dateLocale()) {
      empreinte = Math.imul(empreinte ^ c.charCodeAt(0), 16777619);
    }
    const exos = exercicesDuNiveau();
    return exos.length ? exos[(empreinte >>> 0) % exos.length] : null;
  }

  function allerA(exo) {
    location.hash = "#/exo/" + exo.id;
  }

  // --- Moteur Python -------------------------------------------------------

  function creerMoteur() {
    let worker = null;
    let attente = null;
    let pret = null;
    let auChangement = () => {};
    let numero = 0;

    function demarrer() {
      auChangement("chargement");
      worker = new Worker("worker.js");
      pret = new Promise((resoudre, rejeter) => {
        worker.onmessage = (evenement) => {
          const m = evenement.data;
          if (m.genre === "pret") {
            auChangement("pret");
            resoudre();
          } else if (m.genre === "echec") {
            auChangement("echec");
            rejeter(new Error(m.message));
          } else if (m.genre === "resultat" && attente && attente.numero === m.numero) {
            clearTimeout(attente.minuteur);
            attente.resoudre(m.resultat);
            attente = null;
          }
        };
        worker.onerror = (evenement) => {
          auChangement("echec");
          rejeter(new Error(evenement.message));
          if (attente) {
            clearTimeout(attente.minuteur);
            attente.rejeter(new Error(evenement.message));
            attente = null;
          }
        };
      });
      pret.catch(() => {});
    }

    return {
      preparer(rappel) {
        auChangement = rappel;
        if (!worker) demarrer();
        else pret.then(() => rappel("pret"), () => rappel("echec"));
      },
      async executer(exo, code) {
        await pret;
        return new Promise((resoudre, rejeter) => {
          numero += 1;
          const minuteur = setTimeout(() => {
            // Boucle infinie probable : on arrete Python et on en relance un.
            worker.terminate();
            attente = null;
            demarrer();
            resoudre({ tropLong: true });
          }, DELAI_MAX_MS);
          attente = { numero, resoudre, rejeter, minuteur };
          worker.postMessage({ numero, exo, code });
        });
      },
    };
  }

  // --- Accueil -------------------------------------------------------------

  function afficherChoixNiveau() {
    racine.replaceChildren(el("div", { class: "entr-choix-niveau" },
      el("p", { class: "entr-intro" }, "Choisir son niveau :"),
      el("div", { class: "entr-actions" }, Object.entries(TEXTES).map(([niveau, t]) =>
        el("button", {
          class: "entr-bouton entr-bouton--fort entr-bouton--grand",
          onclick() {
            choisirNiveau(niveau);
            afficher();
          },
        }, t.nom))),
      el("p", { class: "entr-consigne" }, "Ce choix est gardé sur cet appareil, et il se change à tout moment en haut de la page.")));
  }

  function blocNiveaux() {
    return el("div", { class: "entr-niveaux" },
      el("span", {}, "Niveau :"),
      Object.entries(TEXTES).map(([niveau, t]) => {
        const actif = etat.niveau === niveau;
        return el("button", {
          class: "entr-filtre entr-filtre--neutre" + (actif ? " entr-filtre--active" : ""),
          "aria-pressed": String(actif),
          onclick() {
            choisirNiveau(niveau);
            afficher();
          },
        }, t.nom);
      }));
  }

  function afficherAccueil() {
    serieRevision = null;
    const t = textes();
    const conteneur = el("div", {});
    const exos = exercicesDuNiveau();
    const filtres = new Set(exercicesFiltres());
    const serie = serieEnCours();
    const jour = exoDuJour();
    const reussis = exos.filter((e) => lu(e.id).reussi).length;
    const premierCoup = exos.filter((e) => lu(e.id).sansAide).length;
    const avecSerie = exos.some(estUneQuestion);

    if (messageAccueil) {
      conteneur.append(el("p", {
        class: "entr-message entr-message--" + messageAccueil.genre,
        role: "status",
      }, messageAccueil.texte));
      messageAccueil = null;
    }

    conteneur.append(blocNiveaux(), el("p", { class: "entr-intro" }, t.intro));

    if (exos.length === 0) {
      conteneur.append(el("p", { class: "entr-consigne" }, "Aucune question pour ce niveau pour l'instant."));
      racine.replaceChildren(conteneur);
      return;
    }

    const hasard = el("button", {
      class: "entr-bouton " + (avecSerie ? "entr-bouton--clair" : "entr-bouton--signal"),
      onclick() {
        const exo = tirer();
        if (exo) allerA(exo);
      },
      disabled: filtres.size === 0,
    }, t.hasard);
    const boutonSerie = avecSerie ? el("button", {
      class: "entr-bouton entr-bouton--signal",
      onclick: () => { location.hash = "#/serie"; },
      disabled: ![...filtres].some(estUneQuestion),
    }, "Série de " + TAILLE_SERIE + " questions") : null;

    conteneur.append(
      el("div", { class: "entr-jour" },
        el("div", {},
          el("p", { class: "entr-jour__surtitre" }, t.jour),
          el("button", { class: "entr-jour__titre", onclick: () => allerA(jour) },
            jour.titre + (lu(jour.id).reussi ? " ✓" : ""))
        ),
        el("div", { class: "entr-jour__boutons" }, boutonSerie, hasard)
      ),
      blocFiltres(),
      el("p", { class: "entr-bilan" },
        reussis + " " + (reussis > 1 ? t.des : t.une) + " " + t.reussie + (reussis > 1 ? "s" : "") + " sur " + exos.length,
        premierCoup > 0 ? ", dont " + premierCoup + " " + t.premierCoup : "",
        ". ",
        serie > 0 ? serie + (serie > 1 ? " jours de suite. " : " jour de suite. ") : null,
        el("button", {
          class: "entr-lien",
          onclick: () => document.querySelector(".entr-sauvegarde").scrollIntoView({ behavior: "smooth" }),
        }, "Changer d'appareil")
      )
    );

    conteneur.append(...blocReseau(filtres));

    const toutReussi = banque.exercices.filter((e) => lu(e.id).reussi).length;
    conteneur.append(blocSauvegarde(toutReussi));

    conteneur.append(el("p", { class: "entr-note" },
      "La progression est gardée dans ce navigateur, sur cet appareil. Rien n'est envoyé : personne d'autre ne la voit. ",
      el("button", {
        class: "entr-lien",
        onclick() {
          if (confirm("Effacer toute la progression sur cet appareil ?")) {
            etat = etatVide();
            sauver();
            afficher();
          }
        },
      }, "Tout effacer")
    ));

    racine.replaceChildren(conteneur);
  }

  function basculer(liste, valeur) {
    const i = liste.indexOf(valeur);
    if (i >= 0) liste.splice(i, 1);
    else liste.push(valeur);
  }

  function blocFiltres() {
    const puce = (classe, nom, liste, valeur, style) => {
      const actif = liste.includes(valeur);
      return el("button", {
        class: classe + (actif ? " " + classe + "--active" : ""),
        style,
        "aria-pressed": String(actif),
        onclick() {
          basculer(liste, valeur);
          sauver();
          afficher();
        },
      }, nom);
    };
    return el("div", { class: "entr-filtres" },
      el("p", {}, "Le hasard pioche dans :"),
      el("div", { class: "entr-puces" }, notionsDuNiveau()
        .filter((notion) => exercicesDe(notion.id).length > 0)
        .map((notion) => puce("entr-filtre", notion.nom, etat.notions, notion.id, couleurLigne(notion.id)))),
      el("div", { class: "entr-puces" },
        Object.entries(DIFFICULTES).map(([valeur, nom]) =>
          puce("entr-filtre entr-filtre--neutre", nom, etat.difficultes, Number(valeur))),
        // Une etiquette n'apparait que si le niveau a des exercices qui la portent.
        Object.entries(ETIQUETTES)
          .filter(([tag]) => exercicesDuNiveau().some((exo) => (exo.tags || []).includes(tag)))
          .map(([tag, nom]) => puce("entr-filtre entr-filtre--neutre entr-filtre--etiquette", nom, etat.etiquettes, tag)))
    );
  }

  function exercicesDe(idNotion) {
    return banque.exercices.filter((e) => e.notion === idNotion);
  }

  // Une rangee d'arrets : un point par exercice, plein quand il est reussi.
  // filtres (facultatif) : les exercices retenus par les filtres, les autres sont pales.
  function rangee(exos, ici, filtres) {
    return el("div", { class: "entr-rangee" }, exos.map((exo) => {
      const classes = ["entr-arret"];
      if (lu(exo.id).reussi) classes.push("entr-arret--fait");
      if (exo === ici) classes.push("entr-arret--ici");
      if (filtres && !filtres.has(exo)) classes.push("entr-arret--hors");
      return el("a", { href: "#/exo/" + exo.id, class: classes.join(" "), title: exo.titre, "aria-label": exo.titre });
    }));
  }

  function blocReseau(filtres) {
    const lignes = el("div", { class: "entr-reseau" });
    notionsDuNiveau().forEach((notion, i) => {
      const exos = exercicesDe(notion.id);
      if (exos.length === 0) return;
      const faits = exos.filter((e) => lu(e.id).reussi).length;
      const ouverte = etat.ouvertes.includes(notion.id);
      lignes.append(el("section", { class: "entr-ligne", style: couleurLigne(notion.id) },
        el("button", {
          class: "entr-ligne__titre",
          "aria-expanded": String(ouverte),
          onclick() {
            basculer(etat.ouvertes, notion.id);
            sauver();
            afficher();
          },
        },
          el("span", { class: "entr-ligne__num" }, String(i + 1)),
          el("span", {}, notion.nom),
          el("span", { class: "entr-ligne__compte" }, faits + " sur " + exos.length),
          el("span", { class: "entr-ligne__fleche", "aria-hidden": "true" }, ouverte ? "▲" : "▼")),
        ouverte
          ? el("ol", { class: "entr-stations" }, exos.map((exo) => {
            const s = lu(exo.id);
            return el("li", { class: (s.reussi ? "entr-station--faite " : "") + (filtres.has(exo) ? "" : "entr-station--hors") },
              el("a", { href: "#/exo/" + exo.id },
                el("span", { class: "entr-station__nom" }, exo.titre),
                s.sansAide && textes().numeros ? el("span", { class: "entr-badge" }, "sans aide") : null,
                el("span", { class: "entr-station__infos" }, infos(exo))));
          }))
          : rangee(exos, null, filtres)
      ));
    });
    return [
      el("h2", {}, textes().lignes),
      el("p", { class: "entr-consigne" }, textes().consigne),
      lignes,
    ];
  }

  function couleurLigne(idNotion) {
    const memeNiveau = notionsDuNiveau(niveauDe(idNotion));
    return "--ligne: var(--ligne-" + (memeNiveau.findIndex((n) => n.id === idNotion) % 10 + 1) + ")";
  }

  function nomNotion(id) {
    return banque.notions.find((n) => n.id === id).nom;
  }

  // --- Page d'un exercice --------------------------------------------------

  // "facile, 3 min" ; avantDuree permet d'ecrire "facile, environ 3 min".
  function infos(exo, avantDuree) {
    const morceaux = [DIFFICULTES[exo.difficulte].toLowerCase()];
    if (exo.type === "generateur") morceaux.push("valeurs tirées au hasard");
    else if (exo.duree) morceaux.push((avantDuree || "") + exo.duree + " min");
    return morceaux.join(", ");
  }

  function estUneQuestion(exo) {
    return exo.type === "qcm" || exo.type === "reponse" || exo.type === "generateur";
  }

  // Une question de calcul a valeurs tirees au hasard devient, a chaque affichage,
  // une question a reponse courte avec ses propres valeurs (voir generateurs.js).
  function preparer(exo) {
    if (exo.type !== "generateur") return exo;
    return Object.assign({}, exo, Generateurs.tirer(exo.generateur), { type: "reponse" });
  }

  function enTete(exo) {
    const t = TEXTES[niveauDe(exo.notion)];
    return [
      el("p", { class: "entr-retour" }, el("a", { href: "#/" }, t.retour)),
      el("div", { class: "entr-trajet", style: couleurLigne(exo.notion) }, rangee(exercicesDe(exo.notion), exo)),
      el("p", { class: "entr-surtitre" }, t.numeros ? "Exercice " + exo.numero : nomNotion(exo.notion)),
      el("h1", { class: "entr-titre" }, exo.titre),
      el("p", { class: "entr-infos" }, t.numeros ? nomNotion(exo.notion) + ", " + infos(exo, "environ ") : infos(exo)),
    ];
  }

  // Les boutons apres une reussite ; enPlus s'intercale avant "Retour a la liste".
  function suite(exo, ...enPlus) {
    return el("div", { class: "entr-actions" },
      el("button", {
        class: "entr-bouton entr-bouton--fort",
        onclick() {
          const prochain = tirer(exo.id);
          if (prochain) allerA(prochain);
          else location.hash = "#/";
        },
      }, textes().suivant),
      ...enPlus,
      el("a", { class: "entr-bouton", href: "#/" }, "Retour à la liste")
    );
  }

  // L'enonce d'une question, avec son image ou son code s'il y en a.
  function corps(exo) {
    return [
      el("div", { class: "entr-enonce", html: enHtml(exo.enonce) }),
      exo.image ? el("figure", { class: "entr-figure" },
        el("a", { href: "images/" + exo.image, target: "_blank", rel: "noopener" },
          el("img", { src: "images/" + exo.image, alt: exo.image_alt || "", loading: "lazy" })),
        el("figcaption", {}, "Toucher l'image pour l'agrandir.")) : null,
      exo.code ? el("pre", { class: "entr-code" }, el("code", {}, exo.code.trimEnd())) : null,
    ];
  }

  // La bonne reponse d'une question, en HTML, pour la rappeler apres une erreur.
  function bonneReponse(exo) {
    return exo.type === "reponse" ? echapper(String(exo.reponses[0])) : enLigne(exo.choix[0]);
  }

  // La partie a laquelle l'eleve repond : des choix, ou une case ou taper la reponse.
  function partieQuestion(exo, unSeulEssai, quandFini) {
    return (exo.type === "reponse" ? questionReponse : questionChoix)(exo, unSeulEssai, quandFini);
  }

  // attendue : la bonne reponse, en HTML deja echappe, quand il faut la rappeler.
  function explication(exo, titre, genre, attendue) {
    return el("div", { class: "entr-message entr-message--" + genre },
      titre ? el("strong", {}, titre) : null,
      attendue ? el("p", { class: "entr-attendue", html: "Bonne réponse : " + attendue }) : null,
      el("div", { html: enHtml(exo.explication) }),
      exo.cours ? el("p", { class: "entr-cours" }, "À relire dans le cours : " + exo.cours) : null);
  }

  // Une question a choix : prediction de code ou QCM. Avec unSeulEssai, la
  // premiere reponse est definitive (mode serie) ; sinon, on peut reessayer.
  function questionChoix(exo, unSeulEssai, quandFini) {
    let erreurs = 0;
    const retour = el("div", { "aria-live": "polite" });
    const bonne = exo.choix[0];
    const boutons = melanger(exo.choix).map((texte) => el("button", {
      class: "entr-choix__bouton",
      "data-bonne": texte === bonne ? "oui" : null,
      onclick(evenement) {
        const bouton = evenement.currentTarget;
        const juste = texte === bonne;
        if (!juste && !unSeulEssai) {
          erreurs += 1;
          bouton.disabled = true;
          bouton.classList.add("entr-choix__bouton--faux");
          retour.replaceChildren(el("p", { class: "entr-message entr-message--alerte" },
            exo.type === "prediction"
              ? "Ce n'est pas la bonne réponse. Suivre le programme ligne par ligne, en notant la valeur des variables."
              : "Ce n'est pas la bonne réponse. Essayer encore."));
          return;
        }
        if (!juste) bouton.classList.add("entr-choix__bouton--faux");
        for (const b of boutons) {
          b.disabled = true;
          if (b.dataset.bonne) b.classList.add("entr-choix__bouton--juste");
        }
        retour.replaceChildren(juste
          ? explication(exo, "Bonne réponse", "reussi")
          : explication(exo, "Ce n'est pas la bonne réponse", "erreur", bonneReponse(exo)));
        quandFini(juste, erreurs === 0, retour);
      },
    }, el("span", { class: "entr-choix__case" }),
    exo.type === "prediction" ? el("code", {}, texte) : el("span", { html: enLigne(texte) })));
    return [el("div", { class: "entr-choix" }, boutons), retour];
  }

  // Une reponse courte a taper : espaces, majuscules et virgule decimale sont toleres.
  function normaliser(texte) {
    return String(texte).trim().toLowerCase().replace(/\s+/g, "").replace(/,/g, ".");
  }

  function questionReponse(exo, unSeulEssai, quandFini) {
    let erreurs = 0;
    const retour = el("div", { "aria-live": "polite" });
    const champ = el("input", {
      class: "entr-champ entr-champ--reponse",
      type: "text",
      placeholder: exo.indication || "Réponse",
      "aria-label": "Réponse",
      autocomplete: "off",
      autocapitalize: "off",
      spellcheck: "false",
    });
    const valider = el("button", { class: "entr-bouton entr-bouton--fort", type: "submit" }, "Vérifier");
    const formulaire = el("form", { class: "entr-reponse" }, champ, valider);
    const finir = (juste, titre) => {
      champ.disabled = true;
      valider.disabled = true;
      retour.replaceChildren(juste
        ? explication(exo, titre, "reussi")
        : explication(exo, titre, "erreur", bonneReponse(exo)));
      quandFini(juste, erreurs === 0, retour);
    };
    formulaire.addEventListener("submit", (evenement) => {
      evenement.preventDefault();
      if (champ.value.trim() === "") return;
      if (exo.reponses.some((r) => normaliser(r) === normaliser(champ.value))) {
        finir(true, "Bonne réponse");
        return;
      }
      erreurs += 1;
      if (unSeulEssai) {
        finir(false, "Ce n'est pas la bonne réponse");
        return;
      }
      retour.replaceChildren(el("p", { class: "entr-message entr-message--alerte" },
        "Ce n'est pas la bonne réponse. Vérifier, puis réessayer. ",
        erreurs >= 2 ? el("button", {
          class: "entr-lien",
          type: "button",
          onclick: () => finir(false, "Réponse"),
        }, "Voir la réponse") : null));
    });
    return [formulaire, retour];
  }

  function afficherQuestion(exo) {
    const affiche = preparer(exo);
    racine.replaceChildren(el("div", {},
      ...enTete(exo),
      ...corps(affiche),
      ...partieQuestion(affiche, false, (juste, premierCoup, retour) => {
        if (juste) noterReussite(exo.id, premierCoup);
        const nouvellesValeurs = exo.type === "generateur" ? el("button", {
          class: "entr-bouton",
          onclick() {
            afficherQuestion(exo);
            window.scrollTo(0, 0);
          },
        }, "Nouvelles valeurs") : null;
        retour.append(suite(exo, nouvellesValeurs));
      })
    ));
  }

  // --- Mode serie ----------------------------------------------------------
  // Une serie de questions tirees au hasard parmi les filtres, une seule reponse
  // par question, puis le score et les questions ratees.

  function afficherSerie() {
    if (!serieRevision) {
      const exos = melanger(exercicesFiltres().filter(estUneQuestion)).slice(0, TAILLE_SERIE);
      // Les valeurs tirees au hasard sont fixees des le depart, et gardees pour le bilan.
      serieRevision = { exos, affiches: exos.map(preparer), index: 0, resultats: [] };
    }
    const s = serieRevision;
    if (s.exos.length === 0) {
      location.hash = "#/";
      return;
    }
    if (s.index >= s.exos.length) {
      afficherBilanSerie();
      return;
    }
    const exo = s.exos[s.index];
    const affiche = s.affiches[s.index];
    racine.replaceChildren(el("div", {},
      el("p", { class: "entr-retour" }, el("a", { href: "#/" }, "← Arrêter la série")),
      progressionSerie(),
      el("p", { class: "entr-surtitre" }, "Question " + (s.index + 1) + " sur " + s.exos.length + ", " + nomNotion(exo.notion)),
      el("h1", { class: "entr-titre" }, exo.titre),
      ...corps(affiche),
      ...partieQuestion(affiche, true, (juste, premierCoup, retour) => {
        if (juste) noterReussite(exo.id, premierCoup);
        s.resultats.push(juste);
        const derniere = s.index + 1 >= s.exos.length;
        const bouton = el("button", {
          class: "entr-bouton entr-bouton--fort",
          onclick() {
            s.index += 1;
            afficherSerie();
            window.scrollTo(0, 0);
          },
        }, derniere ? "Voir le score" : "Question suivante");
        retour.append(el("div", { class: "entr-actions" }, bouton));
        bouton.focus({ preventScroll: true });
      })
    ));
  }

  function progressionSerie() {
    const s = serieRevision;
    return el("div", { class: "entr-trajet", style: "--ligne: var(--nsi-ligne)" },
      el("div", { class: "entr-rangee" }, s.exos.map((_, i) => {
        const classes = ["entr-arret"];
        if (i < s.resultats.length) classes.push(s.resultats[i] ? "entr-arret--fait" : "entr-arret--rate");
        if (i === s.index) classes.push("entr-arret--ici");
        return el("span", { class: classes.join(" ") });
      })));
  }

  function afficherBilanSerie() {
    const s = serieRevision;
    const rates = s.affiches.filter((_, i) => !s.resultats[i]);
    const score = s.exos.length - rates.length;
    racine.replaceChildren(el("div", {},
      el("p", { class: "entr-retour" }, el("a", { href: "#/" }, "← Retour à la liste")),
      progressionSerie(),
      el("h1", { class: "entr-titre" }, "Score : " + score + " sur " + s.exos.length),
      el("p", {}, rates.length === 0
        ? "Toutes les réponses sont justes."
        : "Les questions ratées sont rappelées ci-dessous, avec leur explication."),
      rates.map((exo) => el("section", { class: "entr-rate" },
        el("h2", {}, exo.titre),
        el("div", { class: "entr-enonce", html: enHtml(exo.enonce) }),
        explication(exo, "", "rappel", bonneReponse(exo)),
        el("p", {}, el("a", { href: "#/exo/" + exo.id }, "Refaire cette question")))),
      el("div", { class: "entr-actions" },
        el("button", {
          class: "entr-bouton entr-bouton--fort",
          onclick() {
            serieRevision = null;
            afficherSerie();
            window.scrollTo(0, 0);
          },
        }, "Nouvelle série"),
        el("a", { class: "entr-bouton", href: "#/" }, "Retour à la liste"))
    ));
  }

  // Le code de depart, avec le curseur pret a ecrire a la suite.
  function codeDepart(exo) {
    const code = (exo.depart || "").trimEnd();
    return code === "" || code.endsWith("...") ? code : code + "\n";
  }

  function afficherCode(exo) {
    const s = suivi(exo.id);
    const statut = el("span", { class: "entr-statut" });
    const resultat = el("div", { class: "entr-resultat", "aria-live": "polite" });
    const zoneAides = el("div", { class: "entr-aides" });
    const zoneEditeur = el("div", { class: "entr-editeur" });
    let ligneMarquee = null;
    let editeur = null;

    const verifier = el("button", { class: "entr-bouton entr-bouton--fort", onclick: lancer }, "Vérifier");
    const boutonAide = el("button", { class: "entr-bouton", onclick: ouvrirAide });

    function majAides() {
      zoneAides.replaceChildren(...exo.aides.slice(0, s.aides).map((aide, i) =>
        el("div", { class: "entr-aide" },
          el("p", {}, NOMS_AIDES[i]),
          el("pre", { class: "entr-code" }, el("code", {}, aide.trimEnd())))
      ));
      boutonAide.textContent = "Une aide (" + s.aides + "/" + exo.aides.length + ")";
      boutonAide.disabled = s.aides >= exo.aides.length;
    }

    function ouvrirAide() {
      s.aides += 1;
      sauver();
      majAides();
    }

    // Si le code finit par ..., on le selectionne : il suffit de taper pour le remplacer.
    // Pas de focus sur telephone, pour ne pas ouvrir le clavier a l'arrivee sur la page.
    function placerCurseur() {
      const derniere = editeur.lineCount() - 1;
      const texte = editeur.getLine(derniere);
      if (texte.trim() === "...") {
        editeur.setSelection({ line: derniere, ch: texte.indexOf("...") }, { line: derniere, ch: texte.length });
      } else {
        editeur.setCursor(derniere, texte.length);
      }
      if (matchMedia("(pointer: fine)").matches) editeur.focus();
    }

    function marquerLigne(ligne) {
      if (ligneMarquee !== null) editeur.removeLineClass(ligneMarquee, "background", "entr-ligne-erreur");
      ligneMarquee = null;
      if (ligne && ligne <= editeur.lineCount()) {
        ligneMarquee = ligne - 1;
        editeur.addLineClass(ligneMarquee, "background", "entr-ligne-erreur");
      }
    }

    async function lancer() {
      verifier.disabled = true;
      verifier.textContent = "Vérification...";
      marquerLigne(null);
      let r;
      try {
        r = await moteur.executer(exo, editeur.getValue());
      } catch (erreur) {
        resultat.replaceChildren(el("p", { class: "entr-message entr-message--erreur" }, PYTHON_ABSENT));
        verifier.textContent = "Vérifier";
        return;
      }
      verifier.disabled = false;
      verifier.textContent = "Vérifier";
      if (r.tropLong) {
        resultat.replaceChildren(el("p", { class: "entr-message entr-message--erreur" },
          "Le programme ne s'arrête pas : une boucle while dont la condition reste toujours vraie ? Il a été arrêté au bout de " + DELAI_MAX_MS / 1000 + " secondes."));
        return;
      }
      if (r.erreur) marquerLigne(r.erreur.ligne);
      if (r.reussi) noterReussite(exo.id, s.aides === 0);
      resultat.replaceChildren(...compteRendu(exo, r, s.aides === 0));
      resultat.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    const recommencer = el("button", {
      class: "entr-lien",
      onclick() {
        if (!confirm("Repartir du code de départ et refermer les aides ?")) return;
        editeur.setValue(codeDepart(exo));
        s.aides = 0;
        s.code = null;
        sauver();
        majAides();
        resultat.replaceChildren();
        placerCurseur();
      },
    }, "Recommencer");

    const bloc = el("div", {},
      ...enTete(exo),
      ...corps(exo),
      zoneEditeur,
      el("div", { class: "entr-commandes" }, verifier, boutonAide, recommencer, statut),
      zoneAides,
      resultat
    );
    racine.replaceChildren(bloc);

    editeur = CodeMirror(zoneEditeur, {
      value: s.code !== null ? s.code : codeDepart(exo),
      mode: "python",
      lineNumbers: true,
      indentUnit: 4,
      tabSize: 4,
      viewportMargin: Infinity,
      extraKeys: {
        Tab: (cm) => cm.somethingSelected() ? cm.indentSelection("add") : cm.replaceSelection("    ", "end"),
        "Ctrl-Enter": lancer,
        "Cmd-Enter": lancer,
      },
    });
    editeur.on("change", () => {
      marquerLigne(null);
      s.code = editeur.getValue();
      sauverBientot();
    });
    placerCurseur();
    majAides();

    moteur.preparer((etatMoteur) => {
      const messages = {
        chargement: "Python se prépare (quelques secondes la première fois)...",
        pret: "Python est prêt",
        echec: PYTHON_ABSENT,
      };
      statut.textContent = messages[etatMoteur];
      statut.dataset.etat = etatMoteur;
    });
  }

  function compteRendu(exo, r, sansAide) {
    const blocs = [];

    if (r.reussi) {
      blocs.push(el("div", { class: "entr-message entr-message--reussi" },
        el("strong", {}, "Réussi"),
        sansAide ? el("span", { class: "entr-badge" }, "sans aide") : null));
    }
    if (r.alerte) blocs.push(el("p", { class: "entr-message entr-message--alerte" }, r.alerte));
    if (r.erreur) blocs.push(blocErreur(r.erreur));
    if (r.sortie) {
      blocs.push(el("p", { class: "entr-sous-titre" }, "Ce que le programme affiche"));
      blocs.push(el("pre", { class: "entr-code" }, el("code", {}, r.sortie)));
    }

    const visibles = r.tests.filter((t) => !t.cache);
    if (visibles.length) {
      const premierRate = visibles.find((t) => !t.ok);
      blocs.push(el("ul", { class: "entr-tests" }, visibles.map((t) => ligneTest(t, t === premierRate))));
    }
    const caches = r.tests.filter((t) => t.cache);
    if (caches.length && visibles.every((t) => t.ok) && !r.erreur && !r.alerte) {
      const rates = caches.filter((t) => !t.ok).length;
      let message = "✓ Les tests cachés passent aussi.";
      if (rates === 1) message = "✗ Un test caché échoue : penser aux cas particuliers.";
      if (rates > 1) message = "✗ " + rates + " tests cachés échouent : penser aux cas particuliers.";
      blocs.push(el("p", { class: "entr-caches entr-caches--" + (rates ? "ko" : "ok") }, message));
    }

    if (r.reussi) {
      const solution = el("pre", { class: "entr-code", hidden: true }, el("code", {}, exo.solution.trimEnd()));
      blocs.push(el("div", { class: "entr-solution" },
        el("button", { class: "entr-lien", onclick: () => { solution.hidden = !solution.hidden; } },
          "Comparer avec une solution possible"),
        solution));
      blocs.push(suite(exo));
    }
    return blocs;
  }

  function blocErreur(erreur) {
    return el("div", { class: "entr-message entr-message--erreur" },
      el("strong", {}, (erreur.ligne ? "Ligne " + erreur.ligne + " : " : "") + erreur.type),
      erreur.conseil ? el("p", {}, erreur.conseil) : null,
      el("p", { class: "entr-brut" }, erreur.message));
  }

  // Un seul test detaille a la fois : on corrige un probleme, puis on reverifie.
  function ligneTest(t, detailler) {
    const ligne = el("li", { class: t.ok ? "entr-test--ok" : "entr-test--ko" },
      el("span", { class: "entr-test__marque" }, t.ok ? "✓" : "✗"),
      el("code", {}, t.libelle));
    if (detailler) {
      const details = el("div", { class: "entr-test__details" });
      if (t.erreur) {
        details.append(blocErreur(t.erreur));
      } else {
        details.append(
          el("div", {}, "Attendu : ", el("code", {}, t.attendu)),
          t.obtenu !== null ? el("div", {}, "Obtenu : ", el("code", {}, t.obtenu)) : null
        );
      }
      if (t.remarque) details.append(el("div", { class: "entr-remarque" }, t.remarque));
      ligne.append(details);
    }
    return ligne;
  }

  // --- Navigation ----------------------------------------------------------

  function afficher() {
    if (sauvegardePrevue) sauver();
    const reprise = location.hash.match(/^#\/reprise\/([\w-]+)$/);
    if (reprise) {
      appliquerCode(reprise[1]);
      history.replaceState(null, "", "#/");
    }
    const niveau = location.hash.match(new RegExp("^#/(" + Object.keys(TEXTES).join("|") + ")$"));
    if (niveau) {
      choisirNiveau(niveau[1]);
      history.replaceState(null, "", "#/");
    }
    const route = location.hash.match(/^#\/exo\/([\w-]+)$/);
    const exo = route && banque.exercices.find((e) => e.id === route[1]);
    // Un lien direct vers une question place la page sur son niveau.
    if (exo && etat.niveau !== niveauDe(exo.notion)) choisirNiveau(niveauDe(exo.notion));
    const serie = !exo && etat.niveau && location.hash === "#/serie";
    // Le grand titre de la page s'efface devant celui d'une question ou d'une serie.
    const titre = document.querySelector(".md-content h1");
    if (titre) titre.hidden = Boolean(exo || serie);
    if (exo && exo.type === "code") afficherCode(exo);
    else if (exo) afficherQuestion(exo);
    else if (!etat.niveau) afficherChoixNiveau();
    else if (serie) afficherSerie();
    else afficherAccueil();
    if (exo || serie) window.scrollTo(0, 0);
  }

  async function demarrer() {
    try {
      if (!window.jsyaml || !window.CodeMirror || typeof Generateurs === "undefined") throw new Error("composants absents");
      const lire = async (nom) => {
        const reponse = await fetch("exercices/" + nom + ".yml");
        if (!reponse.ok) throw new Error(nom + " introuvable");
        return jsyaml.load(await reponse.text());
      };
      const { notions } = await lire("notions");
      const lots = await Promise.all(notions.map((notion) => lire(notion.id)));
      banque = { notions, exercices: lots.flatMap((lot) => lot.exercices) };
      // Avant les niveaux, la page ne servait qu'a la Premiere : on garde ce choix
      // pour les eleves qui ont deja une progression.
      if (!etat.niveau && Object.values(etat.exos).some((s) => s.reussi)) choisirNiveau("premiere");
    } catch (erreur) {
      racine.replaceChildren(el("p", { class: "entr-message entr-message--erreur" },
        "La page n'a pas pu se charger. Vérifier la connexion, puis recharger."));
      return;
    }
    window.addEventListener("hashchange", afficher);
    // Une sauvegarde encore en attente (frappe en cours) est faite avant de quitter la page.
    // Seulement celle-la : sauver sans raison ecraserait ce qu'un autre onglet a pu enregistrer.
    const sauverSiPrevu = () => { if (sauvegardePrevue) sauver(); };
    window.addEventListener("pagehide", sauverSiPrevu);
    document.addEventListener("visibilitychange", () => { if (document.hidden) sauverSiPrevu(); });
    afficher();
  }

  demarrer();
})();
