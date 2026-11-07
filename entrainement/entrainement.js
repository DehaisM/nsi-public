// Page Entrainement : le reseau des exercices, leur tirage, l'editeur, la correction et la progression.
// La progression reste dans le navigateur de l'eleve : rien n'est envoye nulle part.
(function () {
  "use strict";

  const racine = document.getElementById("entr-app");
  const CLE = "nsi-entrainement";
  const DELAI_MAX_MS = 5000;
  const DIFFICULTES = { 1: "Facile", 2: "Moyen", 3: "Corsé" };
  const NOMS_AIDES = ["Aide 1", "Aide 2", "Aide 3"];
  const ADRESSE_SIGNALEMENT = "mathias-romain.dehais@ac-normandie.fr";


  let banque = null;
  let etat = chargerEtat();
  let messageAccueil = null;
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
    return { exos: {}, serie: { dernier: null, longueur: 0 }, notions: [], difficultes: [], ouvertes: [] };
  }

  function chargerEtat() {
    try {
      return Object.assign(etatVide(), JSON.parse(localStorage.getItem(CLE)) || {});
    } catch (erreur) {
      return etatVide();
    }
  }

  function sauver() {
    try {
      localStorage.setItem(CLE, JSON.stringify(etat));
    } catch (erreur) {
      // Navigation privee ou stockage bloque : la page marche, sans memoire.
    }
  }

  function suivi(id) {
    if (!etat.exos[id]) etat.exos[id] = { reussi: false, sansAide: false, aides: 0, code: null };
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

  // --- Tirage --------------------------------------------------------------

  function exercicesFiltres() {
    return banque.exercices.filter((exo) =>
      (etat.notions.length === 0 || etat.notions.includes(exo.notion)) &&
      (etat.difficultes.length === 0 || etat.difficultes.includes(exo.difficulte))
    );
  }

  // Tire d'abord parmi les exercices pas encore reussis.
  function tirer(idActuel) {
    const candidats = exercicesFiltres().filter((exo) => exo.id !== idActuel);
    const nouveaux = candidats.filter((exo) => !suivi(exo.id).reussi);
    const reserve = nouveaux.length ? nouveaux : candidats;
    return reserve.length ? reserve[Math.floor(Math.random() * reserve.length)] : null;
  }

  // Le meme pour tous les eleves un jour donne, calcule a partir de la date.
  function exoDuJour() {
    let empreinte = 2166136261;
    for (const c of dateLocale()) {
      empreinte = Math.imul(empreinte ^ c.charCodeAt(0), 16777619);
    }
    return banque.exercices[(empreinte >>> 0) % banque.exercices.length];
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

  function afficherAccueil() {
    const conteneur = el("div", { class: "entr-accueil" });
    const titre = document.querySelector(".md-content h1");
    if (titre) titre.hidden = false;
    const serie = serieEnCours();
    const jour = exoDuJour();
    const jourFait = suivi(jour.id).reussi;
    const reussis = banque.exercices.filter((e) => suivi(e.id).reussi).length;
    const sansAide = banque.exercices.filter((e) => suivi(e.id).sansAide).length;

    if (messageAccueil) {
      conteneur.append(el("p", {
        class: "entr-message entr-message--" + messageAccueil.genre,
        role: "status",
      }, messageAccueil.texte));
      messageAccueil = null;
    }

    conteneur.append(
      el("p", { class: "entr-intro" }, "Des exercices de Python, à faire quand on veut, en quelques minutes."),
      el("div", { class: "entr-jour" },
        el("div", {},
          el("p", { class: "entr-jour__surtitre" }, "Exo du jour"),
          el("button", { class: "entr-jour__titre", onclick: () => allerA(jour) },
            jour.titre + (jourFait ? " ✓" : ""))
        ),
        el("button", {
          class: "entr-bouton entr-bouton--signal",
          onclick() {
            const exo = tirer();
            if (exo) allerA(exo);
          },
          disabled: exercicesFiltres().length === 0,
        }, "Un exo au hasard")
      ),
      blocFiltres(),
      el("p", { class: "entr-bilan" },
        reussis + " exo" + (reussis > 1 ? "s" : "") + " réussi" + (reussis > 1 ? "s" : "") + " sur " + banque.exercices.length,
        sansAide > 0 ? ", dont " + sansAide + " sans aide" : "",
        ". ",
        serie > 0 ? serie + (serie > 1 ? " jours de suite. " : " jour de suite. ") : null,
        el("button", {
          class: "entr-lien",
          onclick: () => document.querySelector(".entr-sauvegarde").scrollIntoView({ behavior: "smooth" }),
        }, "Changer d'appareil")
      )
    );

    conteneur.append(...blocReseau());

    conteneur.append(blocSauvegarde(reussis));

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
      el("div", { class: "entr-puces" }, banque.notions
        .filter((notion) => banque.exercices.some((e) => e.notion === notion.id))
        .map((notion) => puce("entr-filtre", notion.nom, etat.notions, notion.id, couleurLigne(notion.id)))),
      el("div", { class: "entr-puces" }, Object.entries(DIFFICULTES).map(([valeur, nom]) =>
        puce("entr-filtre entr-filtre--neutre", nom, etat.difficultes, Number(valeur))))
    );
  }

  // Une rangee d'arrets : un point par exercice, plein quand il est reussi.
  function rangee(exos, ici) {
    const filtres = exercicesFiltres();
    return el("div", { class: "entr-rangee" }, exos.map((exo) => {
      const classes = ["entr-arret"];
      if (suivi(exo.id).reussi) classes.push("entr-arret--fait");
      if (exo === ici) classes.push("entr-arret--ici");
      if (!ici && !filtres.includes(exo)) classes.push("entr-arret--hors");
      return el("a", { href: "#/exo/" + exo.id, class: classes.join(" "), title: exo.titre, "aria-label": exo.titre });
    }));
  }

  function blocReseau() {
    const filtres = exercicesFiltres();
    const lignes = el("div", { class: "entr-reseau" });
    banque.notions.forEach((notion, i) => {
      const exos = banque.exercices.filter((e) => e.notion === notion.id);
      if (exos.length === 0) return;
      const faits = exos.filter((e) => suivi(e.id).reussi).length;
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
            const s = suivi(exo.id);
            return el("li", { class: (s.reussi ? "entr-station--faite " : "") + (filtres.includes(exo) ? "" : "entr-station--hors") },
              el("a", { href: "#/exo/" + exo.id },
                el("span", { class: "entr-station__nom" }, exo.titre),
                s.sansAide ? el("span", { class: "entr-badge" }, "sans aide") : null,
                el("span", { class: "entr-station__infos" }, DIFFICULTES[exo.difficulte].toLowerCase() + ", " + exo.duree + " min")));
          }))
          : rangee(exos, null)
      ));
    });
    return [
      el("h2", {}, "Exercices par notion"),
      el("p", { class: "entr-consigne" }, "Chaque point est un exercice, plein quand il est réussi. Ouvrir une notion pour voir leurs titres."),
      lignes,
    ];
  }

  function couleurLigne(idNotion) {
    return "--ligne: var(--ligne-" + (banque.notions.findIndex((n) => n.id === idNotion) % 10 + 1) + ")";
  }

  function lienSignalement(exo) {
    const sujet = "Entraînement, exercice " + exo.numero + " : " + exo.titre;
    return el("p", { class: "entr-signaler" },
      el("a", { href: "mailto:" + ADRESSE_SIGNALEMENT + "?subject=" + encodeURIComponent(sujet) },
        "Signaler un problème sur cet exercice"));
  }

  function nomNotion(id) {
    return banque.notions.find((n) => n.id === id).nom;
  }

  // --- Page d'un exercice --------------------------------------------------

  function enTete(exo) {
    return [
      el("p", { class: "entr-retour" }, el("a", { href: "#/" }, "← Tous les exercices")),
      el("div", { class: "entr-trajet", style: couleurLigne(exo.notion) },
        rangee(banque.exercices.filter((e) => e.notion === exo.notion), exo)),
      el("p", { class: "entr-surtitre" }, "Exercice " + exo.numero),
      el("h1", { class: "entr-titre" }, exo.titre),
      el("p", { class: "entr-infos" },
        nomNotion(exo.notion) + ", " + DIFFICULTES[exo.difficulte].toLowerCase() + ", environ " + exo.duree + " min"),
    ];
  }

  function suite(exo) {
    return el("div", { class: "entr-actions" },
      el("button", {
        class: "entr-bouton entr-bouton--fort",
        onclick() {
          const prochain = tirer(exo.id);
          if (prochain) allerA(prochain);
          else location.hash = "#/";
        },
      }, "Exo suivant"),
      el("a", { class: "entr-bouton", href: "#/" }, "Retour à la liste")
    );
  }

  function afficherPrediction(exo) {
    let erreurs = 0;
    const bloc = el("div", {});
    const retour = el("div", { "aria-live": "polite" });
    const bonne = exo.choix[0];
    const choix = el("div", { class: "entr-choix" }, melanger(exo.choix).map((texte) =>
      el("button", {
        class: "entr-choix__bouton",
        onclick(evenement) {
          const bouton = evenement.currentTarget;
          if (texte !== bonne) {
            erreurs += 1;
            bouton.disabled = true;
            bouton.classList.add("entr-choix__bouton--faux");
            retour.replaceChildren(el("p", { class: "entr-message entr-message--alerte" },
              "Ce n'est pas la bonne réponse. Suivre le programme ligne par ligne, en notant la valeur des variables."));
            return;
          }
          noterReussite(exo.id, erreurs === 0);
          bouton.classList.add("entr-choix__bouton--juste");
          for (const b of choix.querySelectorAll("button")) b.disabled = true;
          retour.replaceChildren(
            el("div", { class: "entr-message entr-message--reussi" },
              el("strong", {}, "Bonne réponse"),
              el("div", { html: enHtml(exo.explication) })),
            suite(exo)
          );
        },
      }, el("span", { class: "entr-choix__case" }), el("code", {}, texte))
    ));
    bloc.append(
      ...enTete(exo),
      el("div", { class: "entr-enonce", html: enHtml(exo.enonce) }),
      el("pre", { class: "entr-code entr-papier" }, el("code", {}, exo.code.trimEnd())),
      choix,
      retour,
      lienSignalement(exo)
    );
    racine.replaceChildren(bloc);
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
    let aidesOuvertes = s.aides;
    let ligneMarquee = null;
    let editeur = null;

    const verifier = el("button", { class: "entr-bouton entr-bouton--fort", onclick: lancer }, "Vérifier");
    const boutonAide = el("button", { class: "entr-bouton", onclick: ouvrirAide });

    function majAides() {
      zoneAides.replaceChildren(...exo.aides.slice(0, aidesOuvertes).map((aide, i) =>
        el("div", { class: "entr-aide" },
          el("p", {}, NOMS_AIDES[i]),
          el("pre", { class: "entr-code" }, el("code", {}, aide.trimEnd())))
      ));
      boutonAide.textContent = "Une aide ("  + aidesOuvertes + "/" + exo.aides.length + ")";
      boutonAide.disabled = aidesOuvertes >= exo.aides.length;
    }

    function ouvrirAide() {
      aidesOuvertes += 1;
      s.aides = aidesOuvertes;
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
        resultat.replaceChildren(el("p", { class: "entr-message entr-message--erreur" },
          "Python n'a pas pu se charger. Vérifier la connexion, puis recharger la page."));
        verifier.textContent = "Vérifier";
        return;
      }
      verifier.disabled = false;
      verifier.textContent = "Vérifier";
      if (r.tropLong) {
        resultat.replaceChildren(el("p", { class: "entr-message entr-message--erreur" },
          "Le programme ne s'arrête pas : une boucle while dont la condition reste toujours vraie ? Il a été arrêté au bout de 5 secondes."));
        return;
      }
      if (r.erreur) marquerLigne(r.erreur.ligne);
      if (r.reussi) noterReussite(exo.id, aidesOuvertes === 0);
      resultat.replaceChildren(...compteRendu(exo, r, aidesOuvertes === 0));
      resultat.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    const recommencer = el("button", {
      class: "entr-lien",
      onclick() {
        if (!confirm("Repartir du code de départ et refermer les aides ?")) return;
        editeur.setValue(codeDepart(exo));
        aidesOuvertes = 0;
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
      el("div", { class: "entr-enonce", html: enHtml(exo.enonce) }),
      zoneEditeur,
      el("div", { class: "entr-commandes" }, verifier, boutonAide, recommencer, statut),
      zoneAides,
      resultat,
      lienSignalement(exo)
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
      sauver();
    });
    placerCurseur();
    majAides();

    moteur.preparer((etatMoteur) => {
      const textes = {
        chargement: "Python se prépare (quelques secondes la première fois)...",
        pret: "Python est prêt",
        echec: "Python n'a pas pu se charger. Vérifier la connexion, puis recharger la page.",
      };
      statut.textContent = textes[etatMoteur];
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
      const solution = el("pre", { class: "entr-code entr-papier", hidden: true }, el("code", {}, exo.solution.trimEnd()));
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
          el("div", {}, "Attendu : ", el("code", { class: "entr-valeur" }, t.attendu)),
          t.obtenu !== null ? el("div", {}, "Obtenu : ", el("code", { class: "entr-valeur" }, t.obtenu)) : null
        );
      }
      if (t.remarque) details.append(el("div", { class: "entr-remarque" }, t.remarque));
      ligne.append(details);
    }
    return ligne;
  }

  // --- Navigation ----------------------------------------------------------

  function afficher() {
    const reprise = location.hash.match(/^#\/reprise\/([\w-]+)$/);
    if (reprise) {
      appliquerCode(reprise[1]);
      history.replaceState(null, "", "#/");
    }
    const route = location.hash.match(/^#\/exo\/([\w-]+)$/);
    const exo = route && banque.exercices.find((e) => e.id === route[1]);
    if (!exo) {
      afficherAccueil();
      return;
    }
    const titre = document.querySelector(".md-content h1");
    if (titre) titre.hidden = true;
    if (exo.type === "prediction") afficherPrediction(exo);
    else afficherCode(exo);
    window.scrollTo(0, 0);
  }

  async function demarrer() {
    try {
      if (!window.jsyaml || !window.CodeMirror) throw new Error("composants absents");
      const lire = async (nom) => {
        const reponse = await fetch("exercices/" + nom + ".yml");
        if (!reponse.ok) throw new Error(nom + " introuvable");
        return jsyaml.load(await reponse.text());
      };
      const { notions } = await lire("notions");
      const lots = await Promise.all(notions.map((notion) => lire(notion.id)));
      banque = { notions, exercices: lots.flatMap((lot) => lot.exercices) };
    } catch (erreur) {
      racine.replaceChildren(el("p", { class: "entr-message entr-message--erreur" },
        "La page n'a pas pu se charger. Vérifier la connexion, puis recharger."));
      return;
    }
    window.addEventListener("hashchange", afficher);
    afficher();
  }

  demarrer();
})();
