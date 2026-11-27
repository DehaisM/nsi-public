"""Automatismes : des questions courtes, tirees au hasard, une competence a la fois.

Ce fichier tourne dans le navigateur (Pyodide) et sur l'ordinateur du prof
(outils/controler_automatismes.py, qui tire des milliers de questions pour les controler).

La bonne reponse n'est jamais ecrite a la main : Python execute le code affiche a l'eleve
et calcule lui-meme ce qu'il vaut. Seules les explications sont redigees ici.

Point d'entree : automatisme(demande_json) -> reponse en JSON.
  {"faire": "tirer", "competence": "range", "graine": 123}         -> une question
  {"faire": "verifier", "question": {...}, "reponse": "[3, 7, 11]"} -> le verdict
"""
import ast
import contextlib
import io
import json
import random
import re

MOTS = ["python", "clavier", "reseau", "souris", "boucle", "routeur", "ecran",
        "variable", "fonction", "tableau", "serveur", "message"]
MOTS_NON_NOMBRES = ["douze", "vingt", "trois", "cent"]


# --- Ecriture des valeurs, comme dans le cours (guillemets doubles) ------------

def ecrire(valeur):
    if isinstance(valeur, bool):
        return repr(valeur)
    if isinstance(valeur, str):
        return '"' + valeur + '"'
    if isinstance(valeur, list):
        return "[" + ", ".join(ecrire(v) for v in valeur) + "]"
    if isinstance(valeur, tuple):
        return "(" + ", ".join(ecrire(v) for v in valeur) + ("," if len(valeur) == 1 else "") + ")"
    return repr(valeur)


def _suite(valeurs):
    """1, 4 et 7"""
    textes = [ecrire(v) for v in valeurs]
    return textes[0] if len(textes) == 1 else ", ".join(textes[:-1]) + " et " + textes[-1]


def _rang(n):
    return "1re" if n == 1 else str(n) + "e"


class _Erreur:
    """Ce que vaut une expression quand Python s'arrete sur une erreur."""


ERREUR = _Erreur()


def calculer(code, expression):
    espace = {}
    try:
        with contextlib.redirect_stdout(io.StringIO()):  # les print du code affiche ne servent pas ici
            if code:
                exec(code, espace)
            return eval(expression, espace)
    except Exception:
        return ERREUR


def _question(enonce, indication, code, expression, explication):
    valeur = calculer(code, expression)
    erreur = valeur is ERREUR
    return {
        "genre": "valeur",
        "enonce": enonce,
        "indication": indication,
        "code": code,
        "expression": expression,
        "erreur": erreur,
        "attendu": None if erreur else ecrire(valeur),
        "reponse": "erreur" if erreur else ecrire(valeur),
        "explication": explication(None if erreur else valeur),
    }


# --- range -------------------------------------------------------------------

def _un_range(h, vide_possible=True):
    forme = h.choice(["n", "ab", "abp", "abp", "neg"])
    if forme == "n":
        return (h.randint(2, 7),)
    if forme == "ab":
        a = h.randint(0, 6)
        if vide_possible and h.random() < 0.08:
            return (a + h.randint(1, 4), a)
        return (a, a + h.randint(2, 6))
    if forme == "abp":
        p = h.randint(2, 4)
        a = h.randint(0, 6)
        b = a + p * h.randint(2, 4) + h.choice([0, 0, 1, p - 1])
        return (a, b, p)
    p = -h.randint(1, 3)
    a = h.randint(6, 15)
    b = a + p * h.randint(2, 4) - h.choice([0, 0, 1])
    return (a, b, p)


def _texte_range(args):
    return "range(" + ", ".join(str(x) for x in args) + ")"


def _decrire_range(args):
    valeurs = list(range(*args))
    if len(args) == 1:
        debut = f"`range({args[0]})` va de 0 à {args[0]} - 1"
    elif len(args) == 2:
        debut = f"`range({args[0]}, {args[1]})` va de {args[0]} à {args[1]} - 1"
        if not valeurs:
            return debut + f" : comme {args[0]} n'est pas plus petit que {args[1]}, il ne donne aucune valeur"
    elif args[2] > 0:
        debut = f"`{_texte_range(args)}` part de {args[0]} et avance de {args[2]} en {args[2]}, en s'arrêtant avant {args[1]}"
    else:
        debut = f"`{_texte_range(args)}` part de {args[0]} et recule de {-args[2]} en {-args[2]}, en s'arrêtant avant {args[1]}"
    return debut + " : " + _suite(valeurs)


def q_range(h):
    sorte = h.choice(["valeurs", "valeurs", "tours", "derniere", "trouver", "trouver"])
    if sorte == "valeurs":
        args = _un_range(h)
        return _question(
            f"Que contient `list({_texte_range(args)})` ?", "Une liste, avec ses crochets", "",
            f"list({_texte_range(args)})",
            lambda v: _decrire_range(args) + (f". La liste est donc `{ecrire(v)}`." if v else ". La liste est donc vide : `[]`."))
    if sorte == "tours":
        if h.random() < 0.5:
            a = h.randint(0, 20)
            args = (a, a + h.randint(3, 40)) if h.random() < 0.7 else (h.randint(5, 30),)
        else:
            args = _un_range(h, vide_possible=False)
        code = f"for i in {_texte_range(args)}:\n    print(i)"
        n = len(range(*args))
        if len(args) == 1:
            expl = f"`range({args[0]})` donne {args[0]} valeurs, de 0 à {args[0] - 1} : la boucle fait {n} tours."
        elif len(args) == 2:
            expl = f"`range({args[0]}, {args[1]})` donne {args[1]} - {args[0]} = {n} valeurs, de {args[0]} à {args[1] - 1} : la boucle fait {n} tours."
        else:
            expl = _decrire_range(args) + f". Cela fait {n} valeurs, donc {n} tours."
        return _question("Combien de nombres ce programme affiche-t-il ?", "Un nombre", code,
                         f"len({_texte_range(args)})", lambda v: expl)
    if sorte == "derniere":
        args = _un_range(h, vide_possible=False)
        code = f"for i in {_texte_range(args)}:\n    print(i)"
        return _question("Quel est le dernier nombre affiché par ce programme ?", "Un nombre", code,
                         f"list({_texte_range(args)})[-1]",
                         lambda v: _decrire_range(args) + f". Le dernier est donc {v}.")
    # trouver le range qui donne des valeurs
    while True:
        args = _un_range(h, vide_possible=False)
        valeurs = list(range(*args))
        if len(valeurs) >= 2:
            break
    debut, pas = valeurs[0], valeurs[1] - valeurs[0]
    fin = valeurs[-1] + pas
    if pas == 1:
        canon = f"range({fin})" if debut == 0 else f"range({debut}, {fin})"
    else:
        canon = f"range({debut}, {fin}, {pas})"
    expl = f"On part de {debut}, on avance de {pas}"
    expl += f", et il faut s'arrêter juste après {valeurs[-1]} : `{canon}` convient."
    if abs(pas) > 1:
        autre = f"range({debut}, {fin - 1 if pas > 0 else fin + 1}, {pas})"
        expl += f" D'autres fins marchent aussi, comme `{autre}`."
    return {
        "genre": "range",
        "enonce": "Écrire un `range` qui donne exactement ces valeurs, dans cet ordre : " + _suite(valeurs) + ".",
        "indication": "Un range, par exemple range(1, 5)",
        "code": "",
        "valeurs": valeurs,
        "erreur": False,
        "attendu": ecrire(valeurs),
        "reponse": canon,
        "explication": expl,
    }


# --- Division entiere et reste -----------------------------------------------

def q_division(h):
    sorte = h.choice(["quotient", "reste", "reste", "pair", "unites", "dizaines"])
    if sorte in ("quotient", "reste"):
        b = h.randint(2, 9)
        a = h.randint(10, 99)
        q, r = divmod(a, b)
        base = f"{a} = {b} × {q} + {r}, avec {r} plus petit que {b}"
        if sorte == "quotient":
            return _question(f"Que vaut `{a} // {b}` ?", "Un nombre", "", f"{a} // {b}",
                             lambda v: base + f" : `{a} // {b}` est le quotient, {v}.")
        return _question(f"Que vaut `{a} % {b}` ?", "Un nombre", "", f"{a} % {b}",
                         lambda v: base + f" : `{a} % {b}` est le reste, {v}.")
    if sorte == "pair":
        n = h.randint(10, 99)
        return _question(f"Que vaut `{n} % 2` ?", "Un nombre", "", f"{n} % 2",
                         lambda v: f"Le reste de la division par 2 vaut 0 pour un nombre pair, et 1 pour un nombre impair. {n} est {'pair' if v == 0 else 'impair'} : `{n} % 2` vaut {v}.")
    n = h.randint(100, 9999)
    if sorte == "unites":
        return _question(f"Que vaut `{n} % 10` ?", "Un nombre", "", f"{n} % 10",
                         lambda v: f"Le reste de la division par 10 est le chiffre des unités : `{n} % 10` vaut {v}.")
    return _question(f"Que vaut `{n} // 10` ?", "Un nombre", "", f"{n} // 10",
                     lambda v: f"La division entière par 10 retire le chiffre des unités : `{n} // 10` vaut {v}.")


# --- Indices -----------------------------------------------------------------

def _liste_au_hasard(h, n_min=4, n_max=7, maxi=50):
    return h.sample(range(1, maxi), h.randint(n_min, n_max))


def q_indices(h):
    sur_mot = h.random() < 0.5
    sorte = h.choice(["positif", "positif", "negatif", "negatif", "erreur"])
    if sur_mot:
        mot = h.choice(MOTS)
        code, nom, n = f'mot = "{mot}"', "mot", len(mot)
        indication = "Une lettre avec ses guillemets, ou erreur"
    else:
        valeurs = _liste_au_hasard(h)
        code, nom, n = "L = " + ecrire(valeurs), "L", len(valeurs)
        indication = "Un nombre, ou erreur"
    if sorte == "positif":
        k = h.randint(0, n - 1)
        expression = f"{nom}[{k}]"
        expl = lambda v: f"Les indices commencent à 0 : `{expression}` est l'élément en {_rang(k + 1)} position, {ecrire(v)}."
    elif sorte == "negatif":
        k = h.randint(1, min(3, n))
        expression = f"{nom}[-{k}]"
        expl = lambda v: f"Les indices négatifs partent de la fin : -1 est le dernier élément, -2 l'avant-dernier... `{expression}` vaut donc {ecrire(v)}."
    else:
        k = n if h.random() < 0.7 else -(n + 1)
        expression = f"{nom}[{k}]"
        sorte_elements = "lettres" if sur_mot else "éléments"
        expl = lambda v: f"`{nom}` a {n} {sorte_elements}, d'indices 0 à {n - 1} (ou -1 à -{n}) : l'indice {k} n'existe pas, et Python s'arrête sur une erreur (IndexError)."
    return _question(f"Que vaut `{expression}` ?", indication, code, expression, expl)


# --- Conditions --------------------------------------------------------------

_OPERATEURS = ["<", ">", "<=", ">=", "==", "!="]


def _comparaison(h, a, b):
    """Une comparaison simple sur a et b, et sa phrase d'explication."""
    gauche = h.choice(["a", "b", "a", "b", "a + b", "a % 2"])
    op = h.choice(_OPERATEURS)
    if gauche == "a % 2":
        droite = h.choice([0, 1])
        op = h.choice(["==", "!="])
    elif h.random() < 0.4:
        droite = "b" if gauche == "a" else "a" if gauche == "b" else h.randint(5, 30)
    else:
        droite = h.randint(0, 20)
    texte = f"{gauche} {op} {droite}"
    espace = {"a": a, "b": b}
    valeur = eval(texte, espace)
    gv, dv = eval(gauche, espace), eval(str(droite), espace)
    phrase = f"`{texte}` : {gv} {op} {dv} est {'vrai' if valeur else 'faux'}"
    return texte, valeur, phrase


def q_conditions(h):
    a, b = h.randint(0, 20), h.randint(0, 20)
    if h.random() < 0.15:
        b = a
    code = f"a = {a}\nb = {b}"
    forme = h.choice(["simple", "and", "and", "or", "or", "not"])
    t1, v1, p1 = _comparaison(h, a, b)
    if forme == "simple":
        return _question(f"Que vaut `{t1}` ?", "True ou False", code, t1, lambda v: p1 + f", donc {v}.")
    if forme == "not":
        expression = f"not ({t1})"
        return _question(f"Que vaut `{expression}` ?", "True ou False", code, expression,
                         lambda v: p1 + f", et `not` inverse le résultat : {v}.")
    t2, v2, p2 = _comparaison(h, a, b)
    expression = f"{t1} {forme} {t2}"
    if forme == "and":
        regle = "avec `and`, il faut que les deux soient vraies"
    else:
        regle = "avec `or`, il suffit qu'une des deux soit vraie"
    return _question(f"Que vaut `{expression}` ?", "True ou False", code, expression,
                     lambda v: p1 + " ; " + p2 + " ; " + regle + f" : {v}.")


# --- Conversions -------------------------------------------------------------

def q_conversions(h):
    n, m = h.randint(2, 40), h.randint(2, 9)
    sorte = h.choice(["int_plus", "str_plus", "texte_nombre", "repete", "int_fois", "longueur",
                      "str_str", "colle_int", "pas_un_nombre"])
    indication = "Un nombre, un texte avec ses guillemets, ou erreur"
    if sorte == "int_plus":
        e = f'int("{n}") + {m}'
        expl = lambda v: f'`int("{n}")` transforme le texte "{n}" en nombre : {n} + {m} = {v}.'
    elif sorte == "str_plus":
        e = f'str({n}) + "{m}"'
        expl = lambda v: f'`str({n})` donne le texte "{n}", et `+` colle deux textes : {ecrire(v)}.'
    elif sorte == "texte_nombre":
        e = f'"{n}" + {m}'
        expl = lambda v: f'On ne peut pas additionner un texte ("{n}") et un nombre ({m}) : Python s\'arrête sur une erreur (TypeError).'
    elif sorte == "repete":
        motif = h.choice(["ab", "x", "-", "ha", "o"])
        k = h.randint(2, 4)
        e = f'"{motif}" * {k}'
        expl = lambda v: f'Multiplier un texte par {k} le répète {k} fois : {ecrire(v)}.'
    elif sorte == "int_fois":
        e = f'int("{n}") * {m}'
        expl = lambda v: f'`int("{n}")` donne le nombre {n} : {n} × {m} = {v}.'
    elif sorte == "longueur":
        n = h.randint(5, 99999)
        e = f"len(str({n}))"
        expl = lambda v: f'`str({n})` donne le texte "{n}", qui contient {v} caractères.'
    elif sorte == "str_str":
        e = f"str({n}) + str({m})"
        expl = lambda v: f'Les deux nombres deviennent des textes, que `+` colle : {ecrire(v)}.'
    elif sorte == "colle_int":
        e = f'int("{n}" + "{m}")'
        expl = lambda v: f'`"{n}" + "{m}"` colle les textes : "{n}{m}", que `int` transforme en nombre : {v}.'
    else:
        mot = h.choice(MOTS_NON_NOMBRES)
        e = f'int("{mot}")'
        expl = lambda v: f'Le texte "{mot}" n\'est pas écrit avec des chiffres : `int` ne peut pas le transformer, et Python s\'arrête sur une erreur (ValueError).'
    return _question(f"Que vaut `{e}` ?", indication, "", e, expl)


# --- Petites boucles ---------------------------------------------------------

def q_boucles(h):
    sorte = h.choice(["somme", "compteur", "double", "lettres", "envers", "maximum", "plus_grands"])
    if sorte == "somme":
        a = h.randint(0, 5)
        b = a + h.randint(2, 5)
        code = f"s = 0\nfor i in range({a}, {b}):\n    s = s + i"
        valeurs = list(range(a, b))
        return _question("Que vaut `s` après ce programme ?", "Un nombre", code, "s",
                         lambda v: f"i prend les valeurs {_suite(valeurs)}, qui s'ajoutent à s : {' + '.join(map(str, valeurs))} = {v}.")
    if sorte == "compteur":
        n, k = h.randint(3, 8), h.randint(2, 5)
        code = f"c = 0\nfor i in range({n}):\n    c = c + {k}"
        return _question("Que vaut `c` après ce programme ?", "Un nombre", code, "c",
                         lambda v: f"La boucle fait {n} tours, et ajoute {k} à c à chaque tour : {n} × {k} = {v}.")
    if sorte == "double":
        n = h.randint(2, 6)
        code = f"p = 1\nfor i in range({n}):\n    p = p * 2"
        etapes = [2 ** (i + 1) for i in range(n)]
        return _question("Que vaut `p` après ce programme ?", "Un nombre", code, "p",
                         lambda v: f"p double à chaque tour : il vaut {_suite(etapes)}. Après {n} tours, p vaut {v}.")
    if sorte == "lettres":
        mot = h.choice(MOTS)
        lettre = h.choice(sorted(set(mot)))
        code = f'n = 0\nfor c in "{mot}":\n    if c == "{lettre}":\n        n = n + 1'
        return _question("Que vaut `n` après ce programme ?", "Un nombre", code, "n",
                         lambda v: f'La boucle parcourt les lettres de "{mot}" et compte celles qui valent "{lettre}" : il y en a {v}.')
    if sorte == "envers":
        mot = h.choice(MOTS[:7])
        code = f't = ""\nfor c in "{mot}":\n    t = c + t'
        return _question("Que vaut `t` après ce programme ?", "Un texte, avec ses guillemets", code, "t",
                         lambda v: f"Chaque lettre est placée devant celles d'avant : le mot se retrouve à l'envers, {ecrire(v)}.")
    valeurs = _liste_au_hasard(h, 4, 6, 40)
    if sorte == "maximum":
        code = "L = " + ecrire(valeurs) + "\nm = L[0]\nfor v in L:\n    if v > m:\n        m = v"
        return _question("Que vaut `m` après ce programme ?", "Un nombre", code, "m",
                         lambda r: f"m retient la plus grande valeur rencontrée pendant le parcours : à la fin, m vaut {r}.")
    seuil = h.randint(10, 30)
    code = "L = " + ecrire(valeurs) + f"\nn = 0\nfor v in L:\n    if v > {seuil}:\n        n = n + 1"
    grands = [v for v in valeurs if v > seuil]
    return _question("Que vaut `n` après ce programme ?", "Un nombre", code, "n",
                     lambda r: (f"Les valeurs plus grandes que {seuil} sont {_suite(grands)} : n vaut {r}."
                                if grands else f"Aucune valeur n'est plus grande que {seuil} : n vaut {r}."))


# --- Grilles -----------------------------------------------------------------

def _ecrire_grille(grille):
    lignes = [ecrire(ligne) for ligne in grille]
    return "G = [" + (",\n     ".join(lignes)) + "]"


def q_grilles(h):
    n, m = h.randint(2, 4), h.randint(2, 4)
    grille = [[h.randint(0, 9) for _ in range(m)] for _ in range(n)]
    code = _ecrire_grille(grille)
    sorte = h.choice(["case", "case", "case", "lignes", "colonnes", "ligne", "derniere", "erreur"])
    indication = "Un nombre, une liste, ou erreur"
    if sorte == "case":
        i, j = h.randint(0, n - 1), h.randint(0, m - 1)
        e = f"G[{i}][{j}]"
        expl = lambda v: f"`G[{i}]` est la ligne d'indice {i}, `{ecrire(grille[i])}` ; son élément d'indice {j} vaut {v}."
    elif sorte == "lignes":
        e = "len(G)"
        expl = lambda v: f"`len(G)` compte les lignes de la grille : {v}."
    elif sorte == "colonnes":
        e = "len(G[0])"
        expl = lambda v: f"`G[0]` est la première ligne, et `len(G[0])` compte ses cases : c'est le nombre de colonnes, {v}."
    elif sorte == "ligne":
        i = h.randint(0, n - 1)
        e = f"G[{i}]"
        expl = lambda v: f"Avec un seul indice, on obtient une ligne entière : `G[{i}]` vaut `{ecrire(v)}`."
    elif sorte == "derniere":
        j = h.randint(0, m - 1)
        e = f"G[-1][{j}]"
        expl = lambda v: f"`G[-1]` est la dernière ligne, `{ecrire(grille[-1])}` ; son élément d'indice {j} vaut {v}."
    else:
        i = h.randint(0, n - 1)
        if h.random() < 0.5:
            e = f"G[{i}][{m}]"
            expl = lambda v: f"Chaque ligne a {m} cases, d'indices 0 à {m - 1} : `G[{i}][{m}]` n'existe pas, et Python s'arrête sur une erreur (IndexError)."
        else:
            e = f"G[{n}][0]"
            expl = lambda v: f"La grille a {n} lignes, d'indices 0 à {n - 1} : `G[{n}]` n'existe pas, et Python s'arrête sur une erreur (IndexError)."
    return _question(f"Que vaut `{e}` ?", indication, code, e, expl)


# --- Tuples ------------------------------------------------------------------

def q_tuples(h):
    sorte = h.choice(["indice", "longueur", "depaqueter", "echange", "division", "modifier", "remplacer", "point"])
    indication = "Un nombre, un tuple avec ses parenthèses, ou erreur"
    if sorte == "indice":
        t = tuple(_liste_au_hasard(h, 3, 5))
        k = h.choice([0, 1, 2, -1])
        e = f"t[{k}]"
        expl = lambda v: (f"Un tuple s'indexe comme une liste : `t[{k}]` vaut {v}." if k >= 0
                          else f"L'indice -1 désigne le dernier élément : `t[-1]` vaut {v}.")
        return _question(f"Que vaut `{e}` ?", indication, "t = " + ecrire(t), e, expl)
    if sorte == "longueur":
        t = tuple(_liste_au_hasard(h, 2, 5))
        return _question("Que vaut `len(t)` ?", indication, "t = " + ecrire(t), "len(t)",
                         lambda v: f"`len` compte les éléments du tuple : {v}.")
    if sorte == "depaqueter":
        a, b = h.randint(1, 30), h.randint(1, 30)
        nom = h.choice(["x", "y"])
        code = f"x, y = ({a}, {b})"
        return _question(f"Que vaut `{nom}` après ce programme ?", indication, code, nom,
                         lambda v: f"Le tuple est dépaqueté dans l'ordre : x reçoit {a} et y reçoit {b}. Donc {nom} vaut {v}.")
    if sorte == "echange":
        a, b = h.sample(range(1, 30), 2)
        nom = h.choice(["a", "b"])
        code = f"a = {a}\nb = {b}\na, b = b, a"
        return _question(f"Que vaut `{nom}` après ce programme ?", indication, code, nom,
                         lambda v: f"`a, b = b, a` échange les deux valeurs : a vaut maintenant {b} et b vaut {a}. Donc {nom} vaut {v}.")
    if sorte == "division":
        n, d = h.randint(10, 60), h.randint(2, 9)
        nom = h.choice(["q", "r"])
        code = f"q, r = {n} // {d}, {n} % {d}"
        return _question(f"Que vaut `{nom}` après ce programme ?", indication, code, nom,
                         lambda v: f"q reçoit {n} // {d}, le quotient, {n // d} ; r reçoit {n} % {d}, le reste, {n % d}. Donc {nom} vaut {v}.")
    if sorte == "modifier":
        t = tuple(_liste_au_hasard(h, 2, 3))
        x = h.randint(1, 50)
        code = "t = " + ecrire(t) + f"\nt[0] = {x}"
        return _question("Que vaut `t` après ce programme ?", indication, code, "t",
                         lambda v: "Un tuple ne peut pas être modifié : `t[0] = ...` provoque une erreur (TypeError), et Python s'arrête.")
    if sorte == "remplacer":
        a, b = h.sample(range(1, 30), 2)
        code = f"t = ({a}, {b})\nt = ({b}, {a})"
        return _question("Que vaut `t` après ce programme ?", indication, code, "t",
                         lambda v: f"On ne modifie pas le tuple : on donne à t un tout nouveau tuple, ce qui est permis. t vaut `{ecrire(v)}`.")
    x, y = h.randint(-9, 9), h.randint(-9, 9)
    code = f"point = ({x}, {y})\npx, py = point"
    return _question("Que vaut `px + py` après ce programme ?", indication, code, "px + py",
                     lambda v: f"px reçoit {x} et py reçoit {y} : {x} + {y} = {v}." if y >= 0
                     else f"px reçoit {x} et py reçoit {y} : {x} + ({y}) = {v}.")


# --- if / elif / else : quelle branche ? --------------------------------------

def q_branches(h):
    sorte = h.choice(["elif", "elif", "elif", "deux_if", "et_ou", "pair"])
    if sorte == "elif":
        nom, s1, s2 = h.choice([("age", 12, 18), ("note", 10, 16), ("temperature", 10, 25), ("vitesse", 50, 90)])
        x = h.randint(s1 - 6, s2 + 6)
        v = h.sample([2, 3, 4, 5, 6, 7, 8, 9], 3)
        code = (f"{nom} = {x}\nif {nom} < {s1}:\n    r = {v[0]}\nelif {nom} < {s2}:\n    r = {v[1]}\n"
                f"else:\n    r = {v[2]}")

        def expl(r):
            if x < s1:
                return f"{nom} vaut {x} : le premier test, `{nom} < {s1}`, est vrai, donc r vaut {r}. Python ne regarde pas les autres branches."
            if x < s2:
                return f"{nom} vaut {x} : `{nom} < {s1}` est faux, puis `{nom} < {s2}` est vrai, donc r vaut {r}."
            return f"{nom} vaut {x} : les deux tests sont faux, c'est donc le `else` qui s'exécute, et r vaut {r}."
        return _question("Que vaut `r` après ce programme ?", "Un nombre", code, "r", expl)
    if sorte == "deux_if":
        x = h.randint(0, 20)
        a, b = sorted(h.sample(range(3, 18), 2))
        mot = h.choice(["if", "elif"])
        code = f"x = {x}\nr = 0\nif x > {b}:\n    r = r + 1\n{mot} x > {a}:\n    r = r + 10"
        t1, t2 = x > b, x > a

        def expl(r):
            debut = f"x vaut {x} : `x > {b}` est {'vrai' if t1 else 'faux'}, `x > {a}` est {'vrai' if t2 else 'faux'}. "
            if mot == "if":
                return debut + f"Ce sont deux `if` séparés : chacun est testé, et chacun ajoute sa valeur s'il est vrai. r vaut {r}."
            return debut + ("Avec `elif`, la deuxième branche n'est testée que si la première est fausse. "
                            + ("Ici la première est vraie : seule elle s'exécute. " if t1 else "") + f"r vaut {r}.")
        return _question("Que vaut `r` après ce programme ?", "Un nombre", code, "r", expl)
    if sorte == "et_ou":
        a, b = h.randint(0, 20), h.randint(0, 20)
        condition = h.choice(["a > 10 and b > 10", "a > 10 or b > 10", "a == b or a > 15", "a < b and b < 15"])
        code = f"a = {a}\nb = {b}\nif {condition}:\n    r = 1\nelse:\n    r = 2"
        valeur = eval(condition, {"a": a, "b": b})
        return _question("Que vaut `r` après ce programme ?", "Un nombre", code, "r",
                         lambda r: f"Avec a = {a} et b = {b}, la condition `{condition}` vaut {valeur} : "
                         + ("c'est la branche du `if` qui s'exécute" if valeur else "c'est la branche du `else` qui s'exécute")
                         + f", et r vaut {r}.")
    n = h.randint(10, 99)
    code = f'n = {n}\nif n % 2 == 0:\n    r = "pair"\nelse:\n    r = "impair"'
    return _question("Que vaut `r` après ce programme ?", "Un texte, avec ses guillemets", code, "r",
                     lambda r: f"`{n} % 2` vaut {n % 2} : le test `n % 2 == 0` est {'vrai' if n % 2 == 0 else 'faux'}, donc r vaut {ecrire(r)}.")


# --- Boucles while -------------------------------------------------------------

def q_while(h):
    sorte = h.choice(["tours", "tours", "moitie", "double", "jamais"])
    if sorte == "tours":
        a, p = h.randint(0, 5), h.randint(2, 5)
        b = a + h.randint(5, 20)
        code = f"n = {a}\nc = 0\nwhile n < {b}:\n    n = n + {p}\n    c = c + 1"
        valeurs = [a]
        while valeurs[-1] < b:
            valeurs.append(valeurs[-1] + p)
        return _question("Que vaut `c` après ce programme ?", "Un nombre", code, "c",
                         lambda v: f"n prend les valeurs {_suite(valeurs)}. La boucle s'arrête dès que n atteint ou dépasse {b}. "
                         f"c compte les tours : {v}.")
    if sorte == "moitie":
        depart = h.choice([20, 37, 40, 50, 64, 80, 90, 100])
        code = f"n = {depart}\nc = 0\nwhile n > 1:\n    n = n // 2\n    c = c + 1"
        valeurs = [depart]
        while valeurs[-1] > 1:
            valeurs.append(valeurs[-1] // 2)
        return _question("Que vaut `c` après ce programme ?", "Un nombre", code, "c",
                         lambda v: f"n est divisé par 2 (division entière) à chaque tour : {_suite(valeurs)}. "
                         f"La boucle s'arrête quand n ne dépasse plus 1. c compte les tours : {v}.")
    if sorte == "double":
        limite = h.randint(20, 200)
        code = f"x = 1\nwhile x < {limite}:\n    x = x * 2"
        valeurs = [1]
        while valeurs[-1] < limite:
            valeurs.append(valeurs[-1] * 2)
        return _question("Que vaut `x` après ce programme ?", "Un nombre", code, "x",
                         lambda v: f"x double à chaque tour : {_suite(valeurs)}. La boucle s'arrête dès que x atteint ou dépasse {limite} : x vaut {v}.")
    a = h.randint(10, 20)
    b = h.randint(2, a)
    code = f"n = {a}\nc = 0\nwhile n < {b}:\n    n = n + 1\n    c = c + 1"
    return _question("Que vaut `c` après ce programme ?", "Un nombre", code, "c",
                     lambda v: f"Au départ, n vaut {a} : la condition `n < {b}` est déjà fausse, et la boucle ne tourne pas une seule fois. c vaut {v}.")


# --- Fonctions : que renvoie l'appel ? -------------------------------------------

def q_fonctions(h):
    sorte = h.choice(["affine", "affine", "deux_parametres", "variable", "sans_return", "deux_appels", "return_tot"])
    indication = "Un nombre, ou None"
    if sorte == "affine":
        a, b, x = h.randint(2, 5), h.randint(1, 9), h.randint(1, 9)
        code = f"def f(n):\n    return {a} * n + {b}"
        return _question(f"Que vaut `f({x})` ?", indication, code, f"f({x})",
                         lambda v: f"Pendant l'appel `f({x})`, le paramètre n vaut {x} : la fonction renvoie {a} × {x} + {b} = {v}.")
    if sorte == "deux_parametres":
        p, q = h.sample(range(2, 20), 2)
        code = "def ecart(a, b):\n    return a - b"
        return _question(f"Que vaut `ecart({p}, {q})` ?", indication, code, f"ecart({p}, {q})",
                         lambda v: f"Les valeurs sont données dans l'ordre des paramètres : a reçoit {p} et b reçoit {q}. La fonction renvoie {p} - {q} = {v}.")
    if sorte == "variable":
        k, x = h.randint(1, 5), h.randint(1, 9)
        code = f"def g(n):\n    m = n + {k}\n    return m * 2"
        return _question(f"Que vaut `g({x})` ?", indication, code, f"g({x})",
                         lambda v: f"Pendant l'appel, n vaut {x}, donc m vaut {x} + {k} = {x + k}. La fonction renvoie {x + k} × 2 = {v}.")
    if sorte == "sans_return":
        x = h.randint(2, 9)
        code = f"def double(n):\n    print(n * 2)\n\nr = double({x})"
        return _question("Que vaut `r` après ce programme ?", indication, code, "r",
                         lambda v: f"La fonction affiche {2 * x}, mais elle ne renvoie rien : il n'y a pas de `return`. r reçoit donc la valeur {ecrire(v)}.")
    if sorte == "deux_appels":
        a, b = h.randint(2, 6), h.randint(2, 6)
        code = "def carre(n):\n    return n * n"
        return _question(f"Que vaut `carre({a}) + carre({b})` ?", indication, code, f"carre({a}) + carre({b})",
                         lambda v: f"`carre({a})` renvoie {a * a} et `carre({b})` renvoie {b * b} : {a * a} + {b * b} = {v}.")
    x = h.randint(5, 15)
    code = "def f(n):\n    if n > 10:\n        return 1\n    return 2"
    return _question(f"Que vaut `f({x})` ?", indication, code, f"f({x})",
                     lambda v: (f"{x} > 10 est vrai : `return 1` renvoie 1 et arrête la fonction tout de suite." if x > 10
                                else f"{x} > 10 est faux : la fonction passe à la ligne suivante, `return 2`, et renvoie {v}."))


# --- Listes : append, L[i] = ..., parcours ---------------------------------------

def q_listes(h):
    sorte = h.choice(["append", "affecter", "affecter", "longueur", "doubler", "construire", "derniere"])
    depart = _liste_au_hasard(h, 3, 4, 20)
    code = "L = " + ecrire(depart)
    if sorte in ("append", "longueur", "derniere"):
        ajouts = [h.randint(1, 30) for _ in range(h.randint(1, 2))]
        code += "".join(f"\nL.append({x})" for x in ajouts)
        apres = depart + ajouts
        etapes = f"`append` ajoute à la fin : L devient `{ecrire(apres)}`."
        if sorte == "append":
            return _question("Que vaut `L` après ce programme ?", "Une liste, avec ses crochets", code, "L", lambda v: etapes)
        if sorte == "longueur":
            return _question("Que vaut `len(L)` après ce programme ?", "Un nombre", code, "len(L)",
                             lambda v: etapes + f" Elle a donc {v} éléments.")
        return _question("Que vaut `L[-1]` après ce programme ?", "Un nombre", code, "L[-1]",
                         lambda v: etapes + f" Son dernier élément, `L[-1]`, vaut {v}.")
    if sorte == "affecter":
        i, x = h.randint(0, len(depart) - 1), h.randint(21, 40)
        code += f"\nL[{i}] = {x}"
        return _question("Que vaut `L` après ce programme ?", "Une liste, avec ses crochets", code, "L",
                         lambda v: f"`L[{i}] = {x}` remplace l'élément d'indice {i} (en {_rang(i + 1)} position) par {x} : `{ecrire(v)}`.")
    if sorte == "doubler":
        code += "\nfor i in range(len(L)):\n    L[i] = L[i] * 2"
        return _question("Que vaut `L` après ce programme ?", "Une liste, avec ses crochets", code, "L",
                         lambda v: f"La boucle passe par chaque indice, et remplace chaque élément par son double : `{ecrire(v)}`.")
    n, k = h.randint(3, 5), h.randint(1, 4)
    code = f"L = []\nfor i in range({n}):\n    L.append(i * {k})"
    return _question("Que vaut `L` après ce programme ?", "Une liste, avec ses crochets", code, "L",
                     lambda v: f"On part d'une liste vide. i prend les valeurs 0 à {n - 1}, et on ajoute i × {k} à chaque tour : `{ecrire(v)}`.")


COMPETENCES = {
    "division": q_division,
    "conversions": q_conversions,
    "conditions": q_conditions,
    "branches": q_branches,
    "range": q_range,
    "boucles": q_boucles,
    "while": q_while,
    "fonctions": q_fonctions,
    "indices": q_indices,
    "listes": q_listes,
    "grilles": q_grilles,
    "tuples": q_tuples,
}


def tirer(competence, graine=None):
    question = COMPETENCES[competence](random.Random(graine))
    question["competence"] = competence
    return question


# --- Verification de la reponse de l'eleve -----------------------------------

def _egal(a, b):
    """Egalite stricte : 5 et "5", ou [1, 2] et (1, 2), ne sont pas la meme reponse."""
    if type(a) is not type(b):
        return False
    if isinstance(a, (list, tuple)):
        return len(a) == len(b) and all(_egal(x, y) for x, y in zip(a, b))
    return a == b


def _verdict(juste, comprise=True, message=None):
    return {"juste": juste, "comprise": comprise, "message": message}


def _lire_range(texte):
    """Les arguments d'un range ecrit par l'eleve, sans rien executer d'autre."""
    texte = texte.strip().rstrip(":").strip()
    texte = re.sub(r"^for\s+\w+\s+in\s+", "", texte)
    try:
        appel = ast.parse(texte, mode="eval").body
    except SyntaxError:
        return None
    if not (isinstance(appel, ast.Call) and isinstance(appel.func, ast.Name) and appel.func.id == "range"
            and 1 <= len(appel.args) <= 3 and not appel.keywords):
        return None
    try:
        args = [ast.literal_eval(a) for a in appel.args]
    except ValueError:
        return None
    if not all(type(a) is int for a in args) or (len(args) == 3 and args[2] == 0):
        return None
    return args


def verifier(question, reponse):
    texte = reponse.strip()
    if question["genre"] == "range":
        args = _lire_range(texte)
        if args is None:
            return _verdict(False, False, "Écrire un range, par exemple range(1, 10, 2).")
        valeurs = range(*args)
        if len(valeurs) > 1000:
            return _verdict(False)
        return _verdict(list(valeurs) == question["valeurs"])

    if texte.lower().rstrip(" .!") in ("erreur", "error", "une erreur"):
        return _verdict(question["erreur"])
    attendu = None if question["erreur"] else ast.literal_eval(question["attendu"])
    try:
        donne = ast.literal_eval(texte)
    except (ValueError, SyntaxError, TypeError, MemoryError, RecursionError):
        if isinstance(attendu, str) and texte == attendu:
            return _verdict(False, False, f'Un texte s\'écrit entre guillemets : "{texte}".')
        if texte.lower() in ("true", "false", "vrai", "faux"):
            return _verdict(False, False, "Écrire True ou False, avec une majuscule.")
        return _verdict(False, False, 'Réponse non comprise : écrire une valeur Python, comme 12, "abc", [1, 2] ou True, ou bien erreur.')
    if isinstance(attendu, list) and isinstance(donne, tuple) and _egal(list(donne), attendu):
        return _verdict(False, False, "Une liste s'écrit entre crochets : " + ecrire(list(donne)) + ".")
    if question["erreur"]:
        return _verdict(False)
    return _verdict(_egal(donne, attendu))


def automatisme(demande_json):
    demande = json.loads(demande_json)
    if demande["faire"] == "tirer":
        return json.dumps(tirer(demande["competence"], demande.get("graine")))
    return json.dumps(verifier(demande["question"], demande["reponse"]))
