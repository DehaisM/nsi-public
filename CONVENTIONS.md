# Conventions du site

## Principe : une année = un contenu

- L'**année en cours** vit dans `docs-public/SNT/`, `docs-public/1NSI/`, `docs-public/TNSI/`.
  En début d'année ces dossiers ne contiennent qu'un `index.md` quasi vide ; on les
  remplit au fil de l'année.
- Les **années écoulées** sont figées dans `docs-public/archives/AAAA-BBBB/` et
  accessibles par l'onglet « Années précédentes ».

```
docs-public/
  index.md
  assets/                     # logo, images globales
  styles/site.css
  SNT/  1NSI/  TNSI/          # ANNÉE EN COURS (sigles en MAJUSCULES, URLs stables)
    index.md                  # sommaire du niveau ; sous-dossiers créés au besoin
  archives/
    index.md                  # page « Années précédentes »
    2025-2026/                # une année figée : arborescence telle qu'elle était
      index.md
      SNT/  1NSI/  TNSI/
  echecs/                     # hors nav (règle not_in_nav)
```

## Quand on ajoute du contenu à un niveau

Structure recommandée sous `SNT/`, `1NSI/`, `TNSI/` :

```
<niveau>/
  index.md
  <theme>/                    # nom court, minuscules, sans accents (python, donnees, algo...)
    index.md                  # voir modele/theme-index.md
    cours/                    # PDF de cours (+ corrigés)
    tp/                       # TP / activités
    exercices/                # fiches d'exercices (si besoin)
    evaluations/              # interros, DS (si besoin)
  tp/  projet/  pratique/     # rubriques transverses (si besoin)
```

## Documents PDF

Les cours restent des PDF (générés depuis LaTeX pour l'impression). Deux façons
de les proposer — modèle prêt à copier : `modele/bloc-cours-pdf.md`.

**Par défaut : liens « Voir / télécharger ».** Simple, léger, mobile-friendly,
idéal quand une page regroupe plusieurs documents.

```markdown
## Titre du document

_Courte description._

[Voir le document](cours/01-titre.pdf){ .md-button .md-button--primary target=_blank }
[télécharger](cours/01-titre.pdf){ download }
```

**Optionnel : visionneuse intégrée** (bloc `<details>` + `<object>`), pour UN
document mis en avant qu'on veut lire sans quitter la page. Style dans
`.pdf-embed` / `.pdf-actions` / `details.pdf-chapter` (`docs-public/styles/site.css`).
C'est du HTML brut : le laisser en colonne 0 (pas indenté sous une admonition).

Dans les deux cas :

- PDF dans le sous-dossier `cours/` (ou à côté de l'`index.md` de la page).
- Chemins **relatifs à l'`index.md` qui contient le bloc** — l'`index.md` est servi
  à la racine de son dossier, donc `cours/NN-titre.pdf` ou `fichier.pdf` résout bien.

## Nommage

- **Dossiers sous un niveau** : minuscules, sans accents, courts (`cours`, `tp`, `donnees`).
- **Niveaux** : `SNT`, `1NSI`, `TNSI` (majuscules — ne pas changer, les URLs sont partagées).
- **Fichiers PDF** : `NN-titre-court.pdf`, corrigé = `NN-titre-court-corrige.pdf`
  (ex. `01-decouverte-du-web.pdf`, `01-decouverte-du-web-corrige.pdf`).

## Codes Capytale

Un code Capytale ouvre une activité via l'URL de partage
`https://capytale2.ac-paris.fr/web/c/<code>` (l'élève choisit ensuite sa
connexion). On écrit donc les codes en **liens cliquables**, le texte du lien
restant le code (l'élève peut cliquer *ou* le recopier dans Capytale).

Toujours dans un bloc admonition, format unique :

```markdown
## Activités Capytale

!!! note "Activités Capytale"
    - **TP 1** Variables et affectation : [b871-8540542](https://capytale2.ac-paris.fr/web/c/b871-8540542)
    - **TP 5** Fonctions : [e052-7137642](https://capytale2.ac-paris.fr/web/c/e052-7137642) · corrigé [3084-7638265](https://capytale2.ac-paris.fr/web/c/3084-7638265)
```

Modèle prêt à copier : `modele/bloc-capytale.md`.

## Navigation

- La nav est déclarée à la main dans `mkdocs.yml` : Accueil, Seconde GT, Première NSI,
  Terminale NSI, Entraînement, Années précédentes.
- Les pages sous `archives/**` et `echecs/**` ne sont pas dans la nav (règle `not_in_nav`) ;
  on y accède par les liens des pages d'index (ou l'URL directe pour le club d'échecs).
- Quand on ajoute des pages à un niveau, les déclarer dans `nav:` sous le niveau concerné.
- `mkdocs build --strict` doit passer sans warning (c'est ce que vérifie la CI).

## Style du site

Tout le style est dans `docs-public/styles/site.css` : vert sapin, police Overpass, jaune
réservé aux signaux (onglet actif, bouton principal de l'Entraînement). Pour changer une
couleur, modifier les variables en haut du fichier (une série pour le mode clair, une pour
le mode sombre).

**Les sommaires se dessinent tout seuls.** Un titre `##` ou `###` qui ne contient qu'un lien
devient une station sur une ligne, et le paragraphe juste en dessous sa description :

```markdown
### [Thématique 1 : Internet](internet/index.md)
Fonctionnement d'Internet
```

Un titre normal, ou un lien placé au milieu d'un texte, reste affiché normalement.

## Page Entraînement

Exercices de Python à faire en autonomie, dans `docs-public/entrainement/`. Python tourne dans
le navigateur de l'élève : il n'y a ni compte ni serveur, et la progression reste dans son
navigateur. Un code de sauvegarde permet de la reprendre sur un autre appareil.

Comme tout s'exécute chez l'élève, les solutions sont lisibles par un élève curieux : cette
page sert à s'entraîner, pas à noter.

Pour ajouter un exercice :

1. L'ajouter dans le fichier de sa notion, `docs-public/entrainement/exercices/<notion>.yml`.
   Le format est expliqué en haut de `exercices/notions.yml`, qui liste les notions. Ajouter une
   notion à cette liste, avec son fichier, crée une nouvelle ligne. Une étiquette facultative,
   par exemple `tags: [maths]`, prépare de futurs filtres.
2. Lui donner le prochain `numero` libre. **Ne jamais changer ni réutiliser le numéro d'un
   exercice existant** : les codes de sauvegarde des élèves s'appuient dessus.
3. Lancer `python outils/verifier_exercices.py`, qui contrôle les champs, que la solution
   réussit les tests, que le code de départ ne les réussit pas, et que la solution n'utilise que
   ce que les élèves ont vu. Il affiche le prochain numéro libre. La CI le lance aussi : une
   erreur dans la banque bloque le déploiement.
4. Après un lot d'exercices, lancer `python outils/controler_tests.py`, qui abîme les solutions
   et liste les erreurs que les tests laissent passer. Certains codes de la liste restent justes :
   c'est une liste à relire, pas à vider.

**Quand une nouvelle notion est traitée en classe**, la déclarer en haut de
`outils/verifier_exercices.py` : l'ajouter à `NOTIONS_VUES`, ainsi que ses nouvelles fonctions
et méthodes. Par exemple, ajouter `"tuples"` lève l'interdiction des tuples. Il faut aussi lui
donner une entrée dans `AVANT_LA_NOTION`.

Chaque exercice affiche un lien "Signaler un problème", qui ouvre un mail vers l'adresse
`ADRESSE_SIGNALEMENT` de `entrainement.js`.

Pour envoyer un élève directement sur un exercice, utiliser le lien
`https://nsi.mdehais.fr/entrainement/#/exo/<id>`.

## Passage à une nouvelle année scolaire

La page Entraînement n'est pas concernée : elle reste en place d'une année sur l'autre.

`outils/nouvelle-annee.ps1 -AnneeEcoulee 2026-2027` (Windows) ou
`outils/nouvelle-annee.sh 2026-2027`. Le script :

1. déplace `SNT/ 1NSI/ TNSI/` vers `docs-public/archives/<année écoulée>/` ;
2. recrée les 3 `index.md` de niveau quasi vides depuis `modele/niveau-index.md`.

Étapes manuelles ensuite :

- ajouter l'entrée de l'année dans la section `Années précédentes` de `mkdocs.yml` ;
- créer `docs-public/archives/<année>/index.md` (copier une année existante) ;
- ajouter la ligne correspondante dans `docs-public/archives/index.md` ;
- `mkdocs build --strict` puis commit.
