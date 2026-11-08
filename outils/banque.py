"""Ce que les outils de la page Entrainement ont en commun : ou est la banque, et comment la lire.

Utilise par verifier_exercices.py, controler_tests.py et controler_generateurs.py.
"""
import importlib.util
import re
from pathlib import Path

import yaml

DOSSIER = Path(__file__).resolve().parent.parent / "docs-public" / "entrainement"
# Tirets longs et guillemets chevrons, proscrits dans les textes de la banque.
CARACTERES_PROSCRITS = re.compile("[—–«»]")


def niveau_de(notion):
    """Le niveau d'une notion : premiere par defaut, comme sur la page."""
    return notion.get("niveau", "premiere")


def charger_banque():
    """Renvoie (notions, exercices), en controlant que chaque exercice est dans le fichier de sa notion."""
    index = yaml.safe_load((DOSSIER / "exercices" / "notions.yml").read_text(encoding="utf-8"))
    exercices = []
    for notion in index["notions"]:
        fichier = DOSSIER / "exercices" / (notion["id"] + ".yml")
        for exo in yaml.safe_load(fichier.read_text(encoding="utf-8"))["exercices"]:
            if exo.get("notion") != notion["id"]:
                raise SystemExit(f"{fichier.name} : l'exercice {exo.get('id')} a pour notion {exo.get('notion')}")
            exercices.append(exo)
    return index["notions"], exercices


def charger_correcteur():
    """Le correcteur de la page (correcteur.py), le meme que celui qui tourne dans le navigateur."""
    spec = importlib.util.spec_from_file_location("correcteur", DOSSIER / "correcteur.py")
    correcteur = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(correcteur)
    return correcteur
