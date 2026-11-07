"""Verifie la banque d'exercices de la page Entrainement.

Pour chaque exercice : les champs sont presents, la solution reussit tous les
tests, le code de depart ne les reussit pas, et la bonne reponse d'une
prediction est bien le premier choix.

Utilisation, depuis la racine du site : python outils/verifier_exercices.py
"""
import contextlib
import importlib.util
import io
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


def verifier(exo, notions):
    problemes = []
    genre = exo.get("type")
    if genre not in CHAMPS:
        return ["type inconnu : " + str(genre)]
    for champ in CHAMPS[genre] | {"titre", "notion", "niveaux", "difficulte", "duree"}:
        if champ not in exo:
            problemes.append("champ manquant : " + champ)
    if problemes:
        return problemes
    if exo["notion"] not in notions:
        problemes.append("notion inconnue : " + exo["notion"])
    if any(CARACTERES_PROSCRITS.search(t) for t in textes(exo)):
        problemes.append("tiret long ou guillemet chevron dans le texte")

    if genre == "prediction":
        sortie = io.StringIO()
        with contextlib.redirect_stdout(sortie):
            exec(exo["code"], {})
        attendu = sortie.getvalue().strip()
        if exo["choix"][0] != attendu:
            problemes.append("le code affiche " + repr(attendu) + ", pas le premier choix")
        if len(set(exo["choix"])) != len(exo["choix"]):
            problemes.append("deux choix identiques")
        return problemes

    if len(exo["aides"]) != 3:
        problemes.append("il faut 3 niveaux d'aide")
    solution = correcteur.executer_programme(exo, exo["solution"])
    if not solution["reussi"]:
        echecs = [t["libelle"] for t in solution["tests"] if not t["ok"]]
        problemes.append(
            "la solution échoue : " + str(solution["erreur"] or solution["alerte"] or echecs)
        )
    if correcteur.executer_programme(exo, exo["depart"])["reussi"]:
        problemes.append("le code de départ réussit déjà tous les tests")
    return problemes


def main():
    banque = yaml.safe_load((DOSSIER / "exercices.yml").read_text(encoding="utf-8"))
    notions = {n["id"] for n in banque["notions"]}
    vus = set()
    numeros = set()
    erreurs = 0
    for exo in banque["exercices"]:
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
        print(("ok      " if not problemes else "ERREUR  ") + exo["id"])
        for probleme in problemes:
            print("        " + probleme)
        erreurs += len(problemes)
    print(f"\n{len(banque['exercices'])} exercices, {erreurs} problème(s)")
    print(f"Prochain numero libre : {max(numeros, default=0) + 1}")
    sys.exit(1 if erreurs else 0)


if __name__ == "__main__":
    main()
