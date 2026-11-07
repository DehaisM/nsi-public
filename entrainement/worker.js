// Fait tourner Python a part de la page : une boucle infinie ne fige rien,
// la page peut simplement arreter ce worker et en relancer un autre.
const PYODIDE = "https://cdn.jsdelivr.net/pyodide/v0.27.7/full/";

importScripts(PYODIDE + "pyodide.js");

async function demarrer() {
  const pyodide = await loadPyodide({ indexURL: PYODIDE });
  const reponse = await fetch("correcteur.py");
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
