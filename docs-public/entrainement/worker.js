// Fait tourner Python a part de la page : une boucle infinie ne fige rien,
// la page peut simplement arreter ce worker et en relancer un autre.
const PYODIDE = new URL("vendor/pyodide/", self.location).href;

importScripts(PYODIDE + "pyodide.js");

async function lire(telechargement, nom) {
  const reponse = await telechargement;
  if (!reponse.ok) throw new Error(nom + " introuvable");
  return reponse.text();
}

async function demarrer() {
  // Les fichiers Python se telechargent pendant que Python demarre.
  const correcteur = fetch("correcteur.py");
  const automatismes = fetch("automatismes.py");
  const pyodide = await loadPyodide({ indexURL: PYODIDE });
  pyodide.runPython(await lire(correcteur, "correcteur.py"));
  // Les automatismes forment un module a part : leurs noms ne se melangent pas a ceux du correcteur.
  pyodide.FS.writeFile("automatismes.py", await lire(automatismes, "automatismes.py"));
  return {
    corriger: pyodide.globals.get("corriger"),
    automatisme: pyodide.pyimport("automatismes").automatisme,
  };
}

const pret = demarrer();

pret.then(
  () => postMessage({ genre: "pret" }),
  (erreur) => postMessage({ genre: "echec", message: String(erreur) })
);

// Un exercice a corriger (exo et code), ou une demande pour les automatismes (auto).
onmessage = async (evenement) => {
  const { numero, exo, code, auto } = evenement.data;
  const python = await pret;
  const resultat = auto
    ? python.automatisme(JSON.stringify(auto))
    : python.corriger(JSON.stringify(exo), code);
  postMessage({ genre: "resultat", numero, resultat: JSON.parse(resultat) });
};
