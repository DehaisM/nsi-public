# Tests de la page Entraînement

Ces tests jouent un élève dans un vrai navigateur : ils ouvrent la page, font des exercices,
répondent juste ou faux, changent d'appareil avec le code de sauvegarde, et vérifient ce
qui s'affiche. Ils complètent `outils/verifier_exercices.py`, qui contrôle la banque sans
navigateur.

## Installation, une seule fois

Il faut Node.js et Microsoft Edge (déjà présent sous Windows). Depuis ce dossier :

```
npm install
```

`playwright-core` est figé en version 1.40.1, la dernière qui fonctionne avec Node.js 16.
Aucun navigateur n'est téléchargé : les tests pilotent Edge.

## Lancer les tests

1. Dans un premier terminal, à la racine du site, lancer le site en local :
   `mkdocs serve -a 127.0.0.1:8123`
2. Dans un second terminal, à la racine du site :

| Commande | Ce qu'elle fait | Durée |
|---|---|---|
| `node outils/tests/lancer.js` | tous les tests | une dizaine de minutes |
| `node outils/tests/lancer.js rapide` | tous sauf le passage complet de la banque | deux à trois minutes |
| `node outils/tests/lancer.js en-ligne` | contrôle du site publié, après un déploiement | une minute |

Chaque fichier peut aussi se lancer seul, par exemple `node outils/tests/seconde.js`.

Options, par variables d'environnement :

- `SITE=https://nsi.mdehais.fr/` pour tester une autre adresse que le serveur local ;
- `NAVIGATEUR=chrome` pour utiliser Chrome au lieu d'Edge ;
- `VOIR=1` pour voir la fenêtre du navigateur pendant le test.

## Les tests

| Fichier | Ce qu'il vérifie |
|---|---|
| `code-sauvegarde.js` | le format du code de sauvegarde, sur des milliers de progressions, et la détection des fautes de frappe |
| `premiere.js` | un élève de Première : filtres, tirage, erreurs de Python expliquées, boucle infinie arrêtée, aides, prédictions |
| `changer-appareil.js` | le passage d'un appareil à l'autre avec le code et avec le lien, sans rien perdre |
| `seconde.js` | un élève de Seconde : choix du niveau, QCM, réponses courtes, série et score |
| `hasard.js` | les questions tirées au hasard : la réponse attendue est recalculée par une autre méthode (`calcul-attendu.js`) |
| `filtre-maths.js` | le filtre Maths |
| `banque.js` | chaque exercice : la solution est acceptée, le code de départ refusé, les mauvaises réponses refusées |
| `en-ligne.js` | le site publié : pages, PDF, couleurs, exercices, Python et code de sauvegarde |

Les captures d'écran prises pendant les tests vont dans `captures/`, qui n'est pas suivi par
Git : on peut les ouvrir pour vérifier l'affichage.

Les tests s'appuient sur quelques exercices précis, par leur identifiant (`tarif-cinema`,
`role-routeur`...). Ne pas les supprimer, ou adapter les tests.
