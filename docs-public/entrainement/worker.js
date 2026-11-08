// Fait tourner Python a part de la page : une boucle infinie ne fige rien,
// la page peut simplement arreter ce worker et en relancer un autre.
const PYODIDE = new URL("vendor/pyodide/", self.location).href;

importScripts(PYODIDE + "pyodide.js");

async function demarrer() {
  // Le correcteur se telecharge pendant que Python demarre.
  const source = fetch("correcteur.py");
  const pyodide = await loadPyodide({ indexURL: PYODIDE });
  const reponse = await source;
  if (!reponse.ok) throw new Error("correcteur.py introuvable");
  pyodide.runPython(await reponse.text());
  return pyodide.globals.get("corriger");
}

const pret = demarrer();

pret.then(
  () => postMessage({ genre: "pret" }),
  (erreur) => postMessage({ genre: "echec", message: String(erreur) })
);

onmessage = async (evenement) => {
  const { numero, exo, code } = evenement.data;
  const corriger = await pret;
  const resultat = corriger(JSON.stringify(exo), code);
  postMessage({ genre: "resultat", numero, resultat: JSON.parse(resultat) });
};
