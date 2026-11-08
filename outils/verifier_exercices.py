"""Verifie la banque d'exercices de la page Entrainement.

Pour chaque exercice :
- les champs sont presents et le numero est unique ;
- la solution, et les autres solutions proposees, reussissent tous les tests ;
- le code de depart ne les reussit pas ;
- la bonne reponse d'une prediction est bien le premier choix ;
- le code n'utilise que ce que les eleves ont vu (voir les listes ci-dessous) ;
- un QCM a des choix tous differents, et une reponse courte donne le resultat de son
  calcul quand il y en a un ;
- l'exercice est bien declare pour le niveau de sa notion.

Utilisation, depuis la racine du site : python outils/verifier_exercices.py
"""
import ast
import contextlib
import importlib.util
import io
import ipaddress
import math
import re
import sys
from pathlib import Path

import yaml

sys.stdout.reconfigure(encoding="utf-8")
sys.dont_write_bytecode = True  # pas de __pycache__ publie avec le site

DOSSIER = Path(__file__).resolve().parent.parent / "docs-public" / "entrainement"
CARACTERES_PROSCRITS = re.compile("[—–«»]")
CHAMPS = {
    "code": {"enonce", "depart", "aides", "solution", "tests"},
    "prediction": {"enonce", "code", "choix", "explication"},
    "qcm": {"enonce", "choix", "explication", "cours"},
    "reponse": {"enonce", "reponses", "explication", "cours"},
}
AVEC_DUREE = {"code", "prediction"}


def normaliser(texte):
    """Comme la page : sans espaces, en minuscules, avec un point decimal."""
    return re.sub(r"\s+", "", str(texte)).lower().replace(",", ".")

# Ce que les eleves ont vu en Premiere, releve dans les corriges des TP0.1 a TP1.2.
# A completer au fil de l'annee : ajouter "tuples" ici retire l'interdiction des tuples.
NOTIONS_VUES = {"variables", "conditions", "for", "while", "fonctions", "listes", "grilles"}
FONCTIONS_VUES = {"print", "len", "int", "float", "str", "type", "range", "list"}
METHODES_VUES = {"append", "pop", "insert", "index", "sqrt"}
MODULES_VUS = {"math"}

# Dans un exercice sur une notion, ce qui n'a pas encore ete introduit.
AVANT_LA_NOTION = {
    "variables": (ast.If, ast.For, ast.While, ast.FunctionDef, ast.List, ast.ListComp),
    "conditions": (ast.For, ast.While, ast.List, ast.ListComp),
    "for": (ast.While, ast.ListComp),
    "while": (ast.ListComp,),
    "fonctions": (ast.ListComp,),
    "listes": (),
    "grilles": (),
}
NOMS_DES_FORMES = {
    ast.If: "if", ast.For: "for", ast.While: "while", ast.FunctionDef: "def",
    ast.List: "une liste", ast.ListComp: "une liste en compréhension",
}

spec = importlib.util.spec_from_file_location("correcteur", DOSSIER / "correcteur.py")
correcteur = importlib.util.module_from_spec(spec)
spec.loader.exec_module(correcteur)


def textes(valeur):
    """Parcourt tous les textes contenus dans un exercice."""
    if isinstance(valeur, str):
        yield valeur
    elif isinstance(valeur, dict):
        for sous_valeur in valeur.values():
            yield from textes(sous_valeur)
    elif isinstance(valeur, list):
        for sous_valeur in valeur:
            yield from textes(sous_valeur)


def noms_definis(arbre):
    """Les noms que le code definit lui-meme : ses fonctions, leurs parametres, ses variables."""
    noms = set()
    for noeud in ast.walk(arbre):
        if isinstance(noeud, ast.FunctionDef):
            noms.add(noeud.name)
            noms.update(a.arg for a in noeud.args.args)
        elif isinstance(noeud, ast.Name) and isinstance(noeud.ctx, ast.Store):
            noms.add(noeud.id)
    return noms


def controler_notions(code, notion):
    """Renvoie ce que ce code utilise sans que les eleves l'aient vu."""
    arbre = ast.parse(code)
    definis = noms_definis(arbre)
    trouves = set()
    for noeud in ast.walk(arbre):
        if isinstance(noeud, AVANT_LA_NOTION.get(notion, ())):
            trouves.add(NOMS_DES_FORMES[type(noeud)] + " (pas encore vu dans cette notion)")
        if isinstance(noeud, ast.Call):
            if isinstance(noeud.func, ast.Name):
                if noeud.func.id not in FONCTIONS_VUES and noeud.func.id not in definis:
                    trouves.add(noeud.func.id + "()")
            elif isinstance(noeud.func, ast.Attribute) and noeud.func.attr not in METHODES_VUES:
                trouves.add("." + noeud.func.attr + "()")
        elif isinstance(noeud, ast.Dict) and "dictionnaires" not in NOTIONS_VUES:
            trouves.add("un dictionnaire")
        elif isinstance(noeud, ast.Import):
            trouves.update("import " + n.name for n in noeud.names if n.name not in MODULES_VUS)
        elif isinstance(noeud, ast.ImportFrom):
            trouves.add("from ... import")
        elif isinstance(noeud, (ast.Lambda, ast.Try, ast.ClassDef, ast.With, ast.GeneratorExp, ast.DictComp, ast.SetComp)):
            trouves.add(type(noeud).__name__)
    if "tuples" not in NOTIONS_VUES:
        # Seul l'echange a, b = b, a a ete vu : un tuple ne sert pas de valeur.
        for noeud in ast.walk(arbre):
            if isinstance(noeud, ast.Assign) and isinstance(noeud.targets[0], ast.Tuple):
                noeud.value._echange = True
                noeud.targets[0]._echange = True
        for noeud in ast.walk(arbre):
            if isinstance(noeud, ast.Tuple) and not getattr(noeud, "_echange", False):
                trouves.add("un tuple")
    return trouves


def verifier(exo, notions):
    problemes = []
    genre = exo.get("type")
    if genre not in CHAMPS:
        return ["type inconnu : " + str(genre)]
    communs = {"titre", "notion", "niveaux", "difficulte"} | ({"duree"} if genre in AVEC_DUREE else set())
    for champ in CHAMPS[genre] | communs:
        if champ not in exo:
            problemes.append("champ manquant : " + champ)
    if problemes:
        return problemes
    if exo["notion"] not in notions:
        return ["notion inconnue : " + exo["notion"]]
    if notions[exo["notion"]] not in exo["niveaux"]:
        problemes.append("niveaux ne contient pas " + notions[exo["notion"]] + ", le niveau de sa notion")
    if any(CARACTERES_PROSCRITS.search(t) for t in textes(exo)):
        problemes.append("tiret long ou guillemet chevron dans le texte")
    if exo.get("image") and not (DOSSIER / "images" / exo["image"]).is_file():
        problemes.append("image introuvable : images/" + exo["image"])

    if genre == "qcm":
        choix = exo["choix"]
        if not 3 <= len(choix) <= 5 or not all(isinstance(c, str) and c.strip() for c in choix):
            problemes.append("il faut de 3 à 5 choix, tous écrits sous forme de texte")
        elif len({normaliser(c) for c in choix}) != len(choix):
            problemes.append("deux choix identiques")
        return problemes

    if genre == "reponse":
        reponses = exo["reponses"]
        if not reponses or not all(isinstance(r, (str, int)) for r in reponses):
            return problemes + ["il faut au moins une réponse acceptée"]
        if "calcul" in exo:
            # Le calcul refait la question a partir de ses donnees : la reponse attendue doit en sortir.
            obtenu = eval(exo["calcul"], {"ipaddress": ipaddress, "math": math})
            if normaliser(obtenu) not in {normaliser(r) for r in reponses}:
                problemes.append(f"le calcul donne {obtenu!r}, absent des réponses acceptées")
        return problemes

    if genre == "prediction":
        sortie = io.StringIO()
        with contextlib.redirect_stdout(sortie):
            exec(exo["code"], {})
        attendu = sortie.getvalue().strip()
        if exo["choix"][0] != attendu:
            problemes.append("le code affiche " + repr(attendu) + ", pas le premier choix")
        if len(set(exo["choix"])) != len(exo["choix"]):
            problemes.append("deux choix identiques")
        for trouve in sorted(controler_notions(exo["code"], exo["notion"])):
            problemes.append("non vu par les élèves : " + trouve)
        return problemes

    if len(exo["aides"]) != 3:
        problemes.append("il faut 3 niveaux d'aide")
    solutions = [exo["solution"]] + list(exo.get("autres_solutions") or [])
    for rang, solution in enumerate(solutions):
        resultat = correcteur.executer_programme(exo, solution)
        if not resultat["reussi"]:
            echecs = [t["libelle"] for t in resultat["tests"] if not t["ok"]]
            nom = "la solution" if rang == 0 else f"l'autre solution {rang}"
            problemes.append(nom + " échoue : " + str(resultat["erreur"] or resultat["alerte"] or echecs))
    # Seule la solution principale doit s'en tenir a ce qui a ete vu : c'est elle que l'eleve lit.
    for trouve in sorted(controler_notions(exo["solution"], exo["notion"])):
        problemes.append("non vu par les élèves : " + trouve)
    if correcteur.executer_programme(exo, exo["depart"])["reussi"]:
        problemes.append("le code de départ réussit déjà tous les tests")
    return problemes


def charger_banque():
    index = yaml.safe_load((DOSSIER / "exercices" / "notions.yml").read_text(encoding="utf-8"))
    exercices = []
    for notion in index["notions"]:
        fichier = DOSSIER / "exercices" / (notion["id"] + ".yml")
        contenu = yaml.safe_load(fichier.read_text(encoding="utf-8"))
        for exo in contenu["exercices"]:
            if exo.get("notion") != notion["id"]:
                raise SystemExit(f"{fichier.name} : l'exercice {exo.get('id')} a pour notion {exo.get('notion')}")
            exercices.append(exo)
    return index["notions"], exercices


def main():
    notions_liste, exercices = charger_banque()
    notions = {n["id"]: n.get("niveau", "premiere") for n in notions_liste}
    vus = set()
    numeros = set()
    erreurs = 0
    for exo in exercices:
        problemes = verifier(exo, notions)
        if exo["id"] in vus:
            problemes.append("identifiant en double")
        vus.add(exo["id"])
        numero = exo.get("numero")
        if not isinstance(numero, int) or numero < 1:
            problemes.append("il faut un numero : un entier à partir de 1")
        elif numero in numeros:
            problemes.append(f"numero {numero} déjà utilisé")
        else:
            numeros.add(numero)
        if problemes:
            print("ERREUR  " + exo["id"])
            for probleme in problemes:
                print("        " + probleme)
        erreurs += len(problemes)

    print("\nnotion        exos  facile moyen corsé  à écrire  prédiction  qcm  réponse  maths")
    for notion in notions_liste:
        lot = [e for e in exercices if e["notion"] == notion["id"]]
        compte = lambda genre: sum(e.get("type") == genre for e in lot)  # noqa: E731
        print(
            f"{notion['id']:<13} {len(lot):>4}"
            + "".join(f"{sum(e.get('difficulte') == d for e in lot):>7}" for d in (1, 2, 3))
            + f"{compte('code'):>9}{compte('prediction'):>11}{compte('qcm'):>6}{compte('reponse'):>8}"
            + f"{sum('maths' in (e.get('tags') or []) for e in lot):>8}"
        )
    print(f"\n{len(exercices)} exercices, {erreurs} problème(s)")
    print(f"Prochain numero libre : {max(numeros, default=0) + 1}")
    sys.exit(1 if erreurs else 0)


if __name__ == "__main__":
    main()
