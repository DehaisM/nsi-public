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

sys.stdout.reconfigure(encoding="utf-8")
sys.dont_write_bytecode = True  # pas de __pycache__ dans le depot

from banque import DOSSIER, charger_banque  # noqa: E402

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


def abimer_compare(noeud):
    noeud.ops[0] = ECHANGES[type(noeud.ops[0])]()


def abimer_operateur(noeud):
    noeud.op = OPERATEURS[type(noeud.op)]()


def abimer_logique(noeud):
    noeud.op = ast.Or() if isinstance(noeud.op, ast.And) else ast.And()


def inverser(noeud):
    noeud.value = not noeud.value


def plus_un(noeud):
    noeud.value += 1


def moins_un(noeud):
    noeud.value -= 1


def abimages(noeud):
    """Les petites erreurs que l'on peut introduire sur ce noeud."""
    if isinstance(noeud, ast.Compare) and type(noeud.ops[0]) in ECHANGES:
        return [abimer_compare]
    if isinstance(noeud, ast.BinOp) and type(noeud.op) in OPERATEURS:
        return [abimer_operateur]
    if isinstance(noeud, ast.BoolOp):
        return [abimer_logique]
    if isinstance(noeud, ast.Constant) and isinstance(noeud.value, bool):
        return [inverser]
    if isinstance(noeud, ast.Constant) and type(noeud.value) in (int, float):
        return [plus_un, moins_un]
    return []


def mutants(code):
    """Les versions abimees du code, sans doublon. L'arbre n'est copie que pour les noeuds a abimer."""
    arbre = ast.parse(code)
    a_abimer = [(rang, abime) for rang, noeud in enumerate(ast.walk(arbre)) for abime in abimages(noeud)]
    vus = set()
    for rang, abime in a_abimer:
        copie = copy.deepcopy(arbre)
        abime(list(ast.walk(copie))[rang])
        texte = ast.unparse(copie)
        if texte not in vus:
            vus.add(texte)
            yield texte


def passe(travail):
    exo, code = travail
    try:
        r = subprocess.run(
            [sys.executable, "-c", ENFANT, str(DOSSIER / "correcteur.py")],
            input=json.dumps({"exo": exo, "code": code}), capture_output=True, text=True, encoding="utf-8", timeout=3,
        )
    except subprocess.TimeoutExpired:
        return False
    return r.stdout.strip() == "OUI"


_, exercices = charger_banque()
travaux = [(exo, code) for exo in exercices if exo["type"] == "code" for code in mutants(exo["solution"])]

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
