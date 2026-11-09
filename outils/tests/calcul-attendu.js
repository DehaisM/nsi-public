// Recalcule, a partir du seul texte de l'enonce affiche, la reponse d'une question tiree au
// hasard. Methodes volontairement differentes de generateurs.js (divisions successives,
// adresse en entier de 32 bits) pour un controle independant.
function versBinaire(n) {
  let s = "";
  for (let i = 0; i < 8; i++) {
    s = (n % 2) + s;
    n = Math.floor(n / 2);
  }
  return s;
}
function versDecimal(bits) {
  return [...bits].reduce((v, b) => v * 2 + Number(b), 0);
}

module.exports = function attendu(generateur, enonce) {
  const ip = (enonce.match(/(\d+)\.(\d+)\.(\d+)\.(\d+)/) || []).slice(1).map(Number);
  const masque = Number((enonce.match(/\/(\d+)/) || [])[1]);
  switch (generateur) {
    case "octet-vers-binaire":
      return versBinaire(Number(enonce.match(/nombre (\d+)/)[1]));
    case "octet-vers-decimal":
      return String(versDecimal(enonce.match(/[01]{8}/)[0]));
    case "adresse-vers-decimal":
      return enonce.match(/[01]{8}(\.[01]{8}){3}/)[0].split(".").map(versDecimal).join(".");
    case "adresse-vers-binaire":
      return ip.map(versBinaire).join(".");
    case "bits-machine":
      return String(32 - masque);
    case "nombre-adresses":
      return String(2 ** (32 - masque) - (/machines/.test(enonce) ? 2 : 0));
    case "adresse-reseau": {
      const entier = ((ip[0] * 256 + ip[1]) * 256 + ip[2]) * 256 + ip[3];
      const taille = 2 ** (32 - masque);
      const reseau = entier - (entier % taille);
      return [24, 16, 8, 0].map((d) => Math.floor(reseau / 2 ** d) % 256).join(".");
    }
    default:
      throw new Error("generateur inconnu : " + generateur);
  }
};
