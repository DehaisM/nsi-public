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

## Nommage

- **Dossiers sous un niveau** : minuscules, sans accents, courts (`cours`, `tp`, `donnees`).
- **Niveaux** : `SNT`, `1NSI`, `TNSI` (majuscules — ne pas changer, les URLs sont partagées).
- **Fichiers PDF** : `NN-titre-court.pdf`, corrigé = `NN-titre-court-corrige.pdf`
  (ex. `01-decouverte-du-web.pdf`, `01-decouverte-du-web-corrige.pdf`).

## Codes Capytale

Toujours dans un bloc admonition, format unique :

```markdown
## Activités Capytale

!!! note "Activités Capytale"
    - **TP 1** — Variables et affectation : `d745-6960372`
    - **TP 5** — Fonctions : `e052-7137642` — corrigé : `3084-7638265`
```

## Navigation

- La nav est déclarée à la main dans `mkdocs.yml` : Accueil, Seconde GT, Première NSI,
  Terminale NSI, Années précédentes.
- Les pages sous `archives/**` et `echecs/**` ne sont pas dans la nav (règle `not_in_nav`) ;
  on y accède par les liens des pages d'index (ou l'URL directe pour le club d'échecs).
- Quand on ajoute des pages à un niveau, les déclarer dans `nav:` sous le niveau concerné.
- `mkdocs build --strict` doit passer sans warning (c'est ce que vérifie la CI).

## Passage à une nouvelle année scolaire

`outils/nouvelle-annee.ps1 -AnneeEcoulee 2026-2027` (Windows) ou
`outils/nouvelle-annee.sh 2026-2027`. Le script :

1. déplace `SNT/ 1NSI/ TNSI/` vers `docs-public/archives/<année écoulée>/` ;
2. recrée les 3 `index.md` de niveau quasi vides depuis `modele/niveau-index.md`.

Étapes manuelles ensuite :

- ajouter l'entrée de l'année dans la section `Années précédentes` de `mkdocs.yml` ;
- créer `docs-public/archives/<année>/index.md` (copier une année existante) ;
- ajouter la ligne correspondante dans `docs-public/archives/index.md` ;
- `mkdocs build --strict` puis commit.
