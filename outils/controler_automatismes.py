"""Controle les automatismes (docs-public/entrainement/automatismes.py).

Tire des milliers de questions par competence et verifie, pour chacune :
- que la question se fabrique sans erreur, avec tous ses champs ;
- que la reponse attendue est bien ce que vaut le code affiche (recalcule ici) ;
- que la reponse affichee comme bonne est acceptee, et qu'une mauvaise reponse est refusee ;
- que l'explication donne la reponse, et que chaque range qu'elle cite donne bien les valeurs ;
- que le code affiche n'utilise que ce que les eleves ont vu ;
- qu'il n'y a ni tiret long ni guillemet chevron.
Il verifie aussi que exercices/automatismes.yml et automatismes.py ont les memes competences.

Utilisation, depuis la racine du site : python outils/controler_automatismes.py
La CI le lance aussi : une erreur bloque le deploiement.
"""
import re
import sys

sys.stdout.reconfigure(encoding="utf-8")
sys.dont_write_bytecode = True  # pas de __pycache__ dans le depot

from banque import CARACTERES_PROSCRITS, charger_automatismes, charger_competences  # noqa: E402

TIRAGES = 3000
CHAMPS = {"genre", "enonce", "indication", "code", "erreur", "attendu", "reponse", "explication", "competence"}
auto = charger_automatismes()


def notions_vues():
    """Le controle des notions de verifier_exercices.py, s'il est importable."""
    try:
        import verifier_exercices
        return verifier_exercices.controler_notions
    except Exception:
        return None


def mauvaise_reponse(question):
    """Une reponse fausse a coup sur, pour verifier qu'elle est refusee."""
    if question["genre"] == "range":
        valeurs = question["valeurs"]
        return f"range({valeurs[0]}, {valeurs[0]})"
    if not question["erreur"]:
        return "erreur"
    return "0"


def controler(question, controler_notions):
    problemes = []
    manquants = CHAMPS - set(question)
    if manquants:
        return ["champs manquants : " + ", ".join(sorted(manquants))]
    if question["genre"] == "valeur":
        valeur = auto.calculer(question["code"], question["expression"])
        if (valeur is auto.ERREUR) != question["erreur"]:
            problemes.append("erreur annoncée à tort, ou pas annoncée")
        elif not question["erreur"] and auto.ecrire(valeur) != question["attendu"]:
            problemes.append(f"attendu {question['attendu']}, le code donne {auto.ecrire(valeur)}")
    else:
        args = auto._lire_range(question["reponse"])
        if args is None or list(range(*args)) != question["valeurs"]:
            problemes.append("le range donné comme réponse ne donne pas les valeurs")
        if question["attendu"] != auto.ecrire(question["valeurs"]):
            problemes.append("attendu différent des valeurs demandées")
    if not auto.verifier(question, question["reponse"])["juste"]:
        problemes.append("la bonne réponse est refusée : " + question["reponse"])
    if auto.verifier(question, mauvaise_reponse(question))["juste"]:
        problemes.append("une mauvaise réponse est acceptée")
    attendu_dans_explication = "erreur" if question["erreur"] else question["attendu"]
    if question["genre"] == "valeur" and attendu_dans_explication not in question["explication"] \
            and not (attendu_dans_explication == "[]" and "vide" in question["explication"]):
        problemes.append("l'explication ne donne pas la réponse " + attendu_dans_explication)
    for cite in re.findall(r"`(range\([^`]*\))`", question["explication"]):
        args = auto._lire_range(cite)
        if question["genre"] == "range" and (args is None or list(range(*args)) != question["valeurs"]):
            problemes.append("l'explication cite un range qui ne convient pas : " + cite)
    for champ in ("enonce", "indication", "explication", "code", "reponse"):
        if CARACTERES_PROSCRITS.search(question[champ] or ""):
            problemes.append("tiret long ou guillemet chevron dans " + champ)
    if controler_notions and question["code"]:
        for trouve in controler_notions(question["code"], "tuples"):
            problemes.append("non vu par les élèves : " + trouve)
    return problemes


def main():
    competences = charger_competences()
    ids = [c["id"] for c in competences]
    erreurs = 0
    if sorted(ids) != sorted(auto.COMPETENCES):
        print("ERREUR  automatismes.yml et automatismes.py n'ont pas les mêmes compétences")
        erreurs += 1
    controler_notions = notions_vues()
    for competence in ids:
        if competence not in auto.COMPETENCES:
            continue
        problemes, enonces = [], set()
        for graine in range(TIRAGES):
            try:
                question = auto.tirer(competence, graine)
            except Exception as erreur:
                problemes.append(f"graine {graine} : {type(erreur).__name__} {erreur}")
                continue
            enonces.add(question["enonce"] + question["code"])
            problemes.extend(f"graine {graine} : {p}" for p in controler(question, controler_notions))
        print(("ok      " if not problemes else "ERREUR  ") + f"{competence:<12} {TIRAGES} tirages, {len(enonces)} différents")
        for probleme in problemes[:6]:
            print("        " + probleme)
        erreurs += len(problemes)
    print(f"\n{erreurs} problème(s)")
    sys.exit(1 if erreurs else 0)


if __name__ == "__main__":
    main()
