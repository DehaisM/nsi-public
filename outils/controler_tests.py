"""Controle de qualite des tests des exercices.

Pour chaque exercice, on abime la solution de petites facons (un < devient <=, une
constante change de 1, un + devient -...). Si un code abime reussit quand meme tous les
tests, ces tests laissent passer une erreur : c'est un exercice a revoir.
Certains codes abimes restent justes (commencer une factorielle a 2, par exemple) :
il faut donc relire la liste, pas viser zero. Chaque code abime tourne dans son propre
processus, car il peut boucler a l'infini.

Utilisation, depuis la racine du site : python outils/controler_tests.py
"""
import ast
import copy
import json
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import yaml

sys.stdout.reconfigure(encoding="utf-8")
base = Path(__file__).resolve().parent.parent / "docs-public" / "entrainement"

ENFANT = """
import importlib.util, json, sys
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location("correcteur", sys.argv[1])
c = importlib.util.module_from_spec(spec); spec.loader.exec_module(c)
d = json.load(sys.stdin)
r = c.executer_programme(d["exo"], d["code"])
sys.__stdout__.write("OUI" if r["reussi"] else "NON")
"""

ECHANGES = {ast.Lt: ast.LtE, ast.LtE: ast.Lt, ast.Gt: ast.GtE, ast.GtE: ast.Gt, ast.Eq: ast.NotEq, ast.NotEq: ast.Eq}
OPERATEURS = {ast.Add: ast.Sub, ast.Sub: ast.Add, ast.Mult: ast.Add, ast.FloorDiv: ast.Mod, ast.Mod: ast.FloorDiv, ast.Div: ast.Mult}


def mutants(code):
    arbre = ast.parse(code)
    n = sum(1 for _ in ast.walk(arbre))
    vus = set()
    for rang in range(n):
        for variante in range(2):
            copie = copy.deepcopy(arbre)
            noeud = list(ast.walk(copie))[rang]
            if isinstance(noeud, ast.Compare) and type(noeud.ops[0]) in ECHANGES and variante == 0:
                noeud.ops[0] = ECHANGES[type(noeud.ops[0])]()
            elif isinstance(noeud, ast.BinOp) and type(noeud.op) in OPERATEURS and variante == 0:
                noeud.op = OPERATEURS[type(noeud.op)]()
            elif isinstance(noeud, ast.BoolOp) and variante == 0:
                noeud.op = ast.Or() if isinstance(noeud.op, ast.And) else ast.And()
            elif isinstance(noeud, ast.Constant) and isinstance(noeud.value, bool):
                if variante == 1:
                    continue
                noeud.value = not noeud.value
            elif isinstance(noeud, ast.Constant) and type(noeud.value) in (int, float):
                noeud.value = noeud.value + (1 if variante == 0 else -1)
            else:
                continue
            texte = ast.unparse(copie)
            if texte not in vus:
                vus.add(texte)
                yield texte


def passe(travail):
    exo, code = travail
    try:
        r = subprocess.run(
            [sys.executable, "-c", ENFANT, str(base / "correcteur.py")],
            input=json.dumps({"exo": exo, "code": code}), capture_output=True, text=True, encoding="utf-8", timeout=3,
        )
    except subprocess.TimeoutExpired:
        return False
    return r.stdout.strip() == "OUI"


index = yaml.safe_load((base / "exercices" / "notions.yml").read_text(encoding="utf-8"))
travaux = []
for notion in index["notions"]:
    contenu = yaml.safe_load((base / "exercices" / (notion["id"] + ".yml")).read_text(encoding="utf-8"))
    for exo in contenu["exercices"]:
        if exo["type"] == "code":
            travaux.extend((exo, code) for code in mutants(exo["solution"]))

with ThreadPoolExecutor(8) as pool:
    resultats = list(pool.map(passe, travaux))

survivants = 0
for (exo, code), ok in zip(travaux, resultats):
    if ok:
        survivants += 1
        reference = ast.unparse(ast.parse(exo["solution"])).splitlines()
        differences = [l.strip() for l, r in zip(code.splitlines(), reference) if l != r]
        print(f"{exo['id']:<22} {' | '.join(differences)}")
print(f"\n{len(travaux)} codes abîmés, {survivants} passent les tests")
