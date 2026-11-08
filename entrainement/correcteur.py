"""Correcteur des exercices d'entrainement.

Ce fichier tourne dans le navigateur (Pyodide) et sur l'ordinateur du prof
(outils/verifier_exercices.py) : les deux utilisent donc exactement la meme
correction.

Point d'entree : corriger(exo_json, code) -> resultat en JSON.
"""
import ast
import contextlib
import json
import math
import traceback

FICHIER_ELEVE = "<ton code>"
TAILLE_MAX_SORTIE = 5000

CONSEILS = {
    "NameError": "Un nom n'existe pas : vérifier l'orthographe, ou que la variable est bien créée avant cette ligne.",
    "SyntaxError": "Python ne comprend pas cette ligne : vérifier les parenthèses, les guillemets et le : en fin de ligne.",
    "IndentationError": "Le décalage en début de ligne n'est pas bon : ce qui est dans un if, un for, un while ou un def doit être décalé.",
    "TabError": "Le décalage mélange des espaces et des tabulations : utiliser uniquement l'un des deux.",
    "IndexError": "Cet indice n'existe pas : une liste de longueur n a des indices de 0 à n-1.",
    "TypeError": "Cette opération n'est pas possible avec ces types de valeurs, par exemple un texte + un nombre.",
    "ZeroDivisionError": "Une division par zéro a lieu : vérifier la valeur du diviseur.",
    "KeyError": "Cette clé n'existe pas dans le dictionnaire.",
    "AttributeError": "Cette méthode n'existe pas pour ce type de valeur : vérifier l'orthographe, ou que la variable contient bien ce que l'on pense.",
    "ValueError": "La valeur donnée n'est pas utilisable ici, par exemple int(\"bonjour\").",
    "RecursionError": "Une fonction s'appelle elle-même sans jamais s'arrêter.",
    "UnboundLocalError": "Une variable est utilisée dans la fonction avant d'y recevoir une valeur.",
}


class SortieLimitee:
    """Recoit les print de l'eleve, en s'arretant au-dela d'une certaine taille."""

    def __init__(self):
        self.morceaux = []
        self.taille = 0

    def write(self, texte):
        if self.taille < TAILLE_MAX_SORTIE:
            self.morceaux.append(texte[: TAILLE_MAX_SORTIE - self.taille])
        self.taille += len(texte)
        return len(texte)

    def flush(self):
        pass

    def contenu(self):
        return "".join(self.morceaux)


def _input_interdit(*_args):
    raise RuntimeError(
        "input() n'est pas utilisable ici : les valeurs sont déjà données dans l'énoncé."
    )


def _decrire_erreur(erreur):
    """Transforme une exception en message lisible, avec la ligne du code de l'eleve."""
    nom = type(erreur).__name__
    ligne = None
    if isinstance(erreur, SyntaxError) and erreur.filename == FICHIER_ELEVE:
        ligne = erreur.lineno
        message = erreur.msg
    else:
        message = str(erreur)
        for cadre in traceback.extract_tb(erreur.__traceback__):
            if cadre.filename == FICHIER_ELEVE:
                ligne = cadre.lineno
    return {
        "type": nom,
        "ligne": ligne,
        "message": message,
        "conseil": CONSEILS.get(nom, ""),
    }


def _egal(a, b):
    """Egalite tolerante sur les flottants, mais True n'est pas 1."""
    if isinstance(a, bool) != isinstance(b, bool):
        return False
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return math.isclose(a, b, rel_tol=1e-9, abs_tol=1e-9)
    if isinstance(a, (list, tuple)) and isinstance(b, (list, tuple)):
        return (
            type(a) is type(b)
            and len(a) == len(b)
            and all(_egal(x, y) for x, y in zip(a, b))
        )
    return a == b


def _normaliser_sortie(texte):
    lignes = [ligne.rstrip() for ligne in texte.strip().splitlines()]
    return "\n".join(lignes)


def _chercher_interdit(arbre, interdits):
    """Renvoie le premier element interdit utilise dans le code, ou None."""
    for noeud in ast.walk(arbre):
        if isinstance(noeud, ast.Name) and noeud.id in interdits:
            return noeud.id
        if isinstance(noeud, ast.Attribute) and noeud.attr in interdits:
            return noeud.attr
        if isinstance(noeud, ast.While) and "while" in interdits:
            return "while"
        if isinstance(noeud, ast.Slice) and "[:]" in interdits:
            return "[:]"
        if isinstance(noeud, ast.Compare) and "in" in interdits:
            if any(isinstance(op, (ast.In, ast.NotIn)) for op in noeud.ops):
                return "in"
    return None


def _executer_test(test, espace, sortie):
    """Execute un test et renvoie son compte rendu."""
    cache = bool(test.get("cache"))
    libelle = test.get("libelle")

    if "sortie" in test:
        attendu = _normaliser_sortie(test["sortie"])
        obtenu = _normaliser_sortie(sortie)
        return {"ok": obtenu == attendu, "cache": cache, "libelle": libelle or "Ce que le programme affiche",
                "attendu": attendu, "obtenu": obtenu}

    attendu = eval(test["attendu"], {})
    compte_rendu = {"ok": False, "cache": cache, "libelle": libelle, "attendu": repr(attendu), "obtenu": None}

    if "variable" in test:
        nom = test["variable"]
        compte_rendu["libelle"] = libelle or nom
        if nom not in espace:
            compte_rendu["remarque"] = "La variable " + nom + " n'existe pas."
            return compte_rendu
        compte_rendu.update(ok=_egal(espace[nom], attendu), obtenu=repr(espace[nom]))
        return compte_rendu

    compte_rendu["libelle"] = libelle or test["appel"]
    try:
        obtenu = eval(test["appel"], espace)
    except Exception as erreur:
        compte_rendu["erreur"] = _decrire_erreur(erreur)
        return compte_rendu
    compte_rendu.update(ok=_egal(obtenu, attendu), obtenu=repr(obtenu))
    if obtenu is None and attendu is not None:
        compte_rendu["remarque"] = (
            "La fonction ne renvoie rien : un return est-il oublié ? "
            "Attention, print affiche une valeur mais ne la renvoie pas."
        )
    return compte_rendu


def executer_programme(exo, code):
    """Corrige le code de l'eleve pour un exercice. Renvoie un dictionnaire."""
    resultat = {"reussi": False, "sortie": "", "erreur": None, "tests": [], "alerte": None}

    if "___" in code:
        resultat["alerte"] = "Il reste des trous ___ à remplacer dans le code."
        return resultat

    try:
        arbre = ast.parse(code, filename=FICHIER_ELEVE)
    except SyntaxError as erreur:
        resultat["erreur"] = _decrire_erreur(erreur)
        return resultat

    interdits = exo.get("interdit") or []
    if interdits:
        trouve = _chercher_interdit(arbre, interdits)
        if trouve:
            resultat["alerte"] = "Cet exercice demande de ne pas utiliser " + trouve + "."
            return resultat

    espace = {"__name__": "__main__", "input": _input_interdit}
    sortie = SortieLimitee()
    with contextlib.redirect_stdout(sortie):
        try:
            exec(compile(arbre, FICHIER_ELEVE, "exec"), espace)
        except BaseException as erreur:
            if isinstance(erreur, (KeyboardInterrupt, GeneratorExit)):
                raise
            resultat["erreur"] = _decrire_erreur(erreur)
        if resultat["erreur"] is None:
            for test in exo.get("tests", []):
                resultat["tests"].append(_executer_test(test, espace, sortie.contenu()))

    resultat["sortie"] = sortie.contenu()
    if sortie.taille > TAILLE_MAX_SORTIE:
        resultat["sortie"] += "\n[affichage coupé : beaucoup trop de print]"
    resultat["reussi"] = (
        resultat["erreur"] is None
        and bool(resultat["tests"])
        and all(t["ok"] for t in resultat["tests"])
    )
    return resultat


def corriger(exo_json, code):
    """Point d'entree appele depuis le navigateur."""
    return json.dumps(executer_programme(json.loads(exo_json), code), ensure_ascii=False)
