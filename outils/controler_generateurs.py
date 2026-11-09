"""Controle les questions de calcul tirees au hasard (docs-public/entrainement/generateurs.js).

Fait tirer des milliers de questions a chaque generateur, avec Node.js, puis refait chaque
calcul en Python (module ipaddress pour les adresses) et verifie :
- que la reponse attendue est juste ;
- que l'explication donne bien cette reponse ;
- que les valeurs restent dans les limites prevues (masques de /8 a /30...) ;
- qu'il n'y a ni tiret long ni guillemet chevron dans les textes.

Utilisation, depuis la racine du site : python outils/controler_generateurs.py
La CI le lance aussi : une erreur bloque le deploiement.
"""
import ipaddress
import json
import shutil
import subprocess
import sys

sys.stdout.reconfigure(encoding="utf-8")
sys.dont_write_bytecode = True  # pas de __pycache__ dans le depot

from banque import CARACTERES_PROSCRITS, DOSSIER  # noqa: E402

FICHIER = DOSSIER / "generateurs.js"
TIRAGES = 3000
SCRIPT = """
const G = require(process.argv[1]);
const sortie = {};
for (const nom of G.noms) {
  sortie[nom] = [];
  for (let i = 0; i < Number(process.argv[2]); i++) sortie[nom].push(G.tirer(nom));
}
process.stdout.write(JSON.stringify(sortie));
"""


def octets(texte):
    return [int(o) for o in texte.split(".")]


def attendu(nom, d):
    """Refait le calcul a partir des valeurs tirees ; renvoie (reponse, probleme de limites)."""
    if nom == "octet-vers-binaire":
        return format(d["n"], "08b"), not 1 <= d["n"] <= 254
    if nom == "octet-vers-decimal":
        return str(int(d["octet"], 2)), len(d["octet"]) != 8
    if nom == "adresse-vers-decimal":
        morceaux = d["binaire"].split(".")
        return ".".join(str(int(b, 2)) for b in morceaux), len(morceaux) != 4 or any(len(b) != 8 for b in morceaux)
    if nom == "adresse-vers-binaire":
        valeurs = octets(d["adresse"])
        return ".".join(format(v, "08b") for v in valeurs), len(valeurs) != 4 or any(not 0 <= v <= 255 for v in valeurs)
    if nom == "bits-machine":
        return str(32 - d["masque"]), not 8 <= d["masque"] <= 30
    if nom == "nombre-adresses":
        reseau = ipaddress.ip_network("0.0.0.0/" + str(d["masque"]))
        adresses = reseau.num_addresses
        return str(adresses - 2 if d["machines"] else adresses), not 16 <= d["masque"] <= 30
    if nom == "adresse-reseau":
        reseau = ipaddress.ip_network(d["adresse"] + "/" + str(d["masque"]), strict=False)
        machine_nulle = str(reseau.network_address) == d["adresse"]
        return str(reseau.network_address), not 8 <= d["masque"] <= 30 or machine_nulle
    raise KeyError(nom)


def main():
    node = shutil.which("node")
    if not node:
        raise SystemExit("Node.js est nécessaire pour ce contrôle : https://nodejs.org")
    sortie = subprocess.run([node, "-e", SCRIPT, str(FICHIER), str(TIRAGES)], capture_output=True, text=True, encoding="utf-8")
    if sortie.returncode != 0:
        raise SystemExit("Erreur dans generateurs.js :\n" + sortie.stderr)
    tirages = json.loads(sortie.stdout)

    erreurs = 0
    for nom, questions in tirages.items():
        problemes = []
        for q in questions:
            try:
                bonne, hors_limites = attendu(nom, q["donnees"])
            except KeyError:
                problemes.append("générateur non contrôlé : à ajouter dans attendu()")
                break
            if q["reponses"][0] != bonne:
                problemes.append(f"{q['resume']} : réponse {q['reponses'][0]}, au lieu de {bonne}")
            if hors_limites:
                problemes.append(f"{q['resume']} : valeurs hors des limites prévues")
            if bonne not in q["explication"]:
                problemes.append(f"{q['resume']} : l'explication ne donne pas la réponse {bonne}")
            if any(CARACTERES_PROSCRITS.search(q[c]) for c in ("enonce", "explication", "indication")):
                problemes.append(f"{q['resume']} : tiret long ou guillemet chevron")
        if nom == "adresse-reseau":
            au_milieu = sum(q["donnees"]["masque"] % 8 != 0 for q in questions) / len(questions)
            if not 0.6 <= au_milieu <= 0.9:
                problemes.append(f"part des masques au milieu d'un octet : {au_milieu:.0%}, au lieu d'environ 75 %")
        distincts = len({q["resume"] for q in questions})
        print(("ok      " if not problemes else "ERREUR  ") + f"{nom:<22} {len(questions)} tirages, {distincts} différents")
        for probleme in sorted(set(problemes))[:5]:
            print("        " + probleme)
        erreurs += len(problemes)
    print(f"\n{erreurs} problème(s)")
    sys.exit(1 if erreurs else 0)


if __name__ == "__main__":
    main()
