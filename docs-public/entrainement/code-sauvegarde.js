// Code de sauvegarde : toute la progression en quelques caracteres, pour changer
// d'appareil sans compte ni serveur.
//
// Le code contient, bit par bit : la version, la serie de jours, puis les exercices
// reussis, reperes par leur numero fixe. Selon la progression, deux ecritures sont
// possibles et on garde la plus courte :
//   - peu d'exercices : on note l'ecart entre deux numeros reussis (code d'Elias gamma) ;
//   - beaucoup d'exercices : on note deux bits par numero (reussi, sans aide).
// Deux caracteres de controle detectent les fautes de frappe. L'alphabet evite I, L, O
// et U, faciles a confondre quand on recopie a la main.
const CodeSauvegarde = (function () {
  "use strict";

  const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  const VERSION = 0;
  const JOUR_ZERO = Date.UTC(2020, 0, 1);
  const MS_PAR_JOUR = 86400000;
  const BITS_JOUR = 14;
  const BITS_LONGUEUR = 8;
  const NUMERO_MAX = 1 << 20;

  function dateVersNombre(date) {
    const [annee, mois, jour] = date.split("-").map(Number);
    return Math.round((Date.UTC(annee, mois - 1, jour) - JOUR_ZERO) / MS_PAR_JOUR);
  }

  function nombreVersDate(nombre) {
    return new Date(JOUR_ZERO + nombre * MS_PAR_JOUR).toISOString().slice(0, 10);
  }

  function ecrire(bits, valeur, taille) {
    for (let i = taille - 1; i >= 0; i--) bits.push((valeur >> i) & 1);
  }

  function ecrireGamma(bits, n) {
    const taille = Math.floor(Math.log2(n));
    ecrire(bits, 0, taille);
    ecrire(bits, n, taille + 1);
  }

  function ecritureEcarts(reussites) {
    const bits = [];
    let precedent = 0;
    for (const { numero, sansAide } of reussites) {
      ecrireGamma(bits, numero - precedent);
      bits.push(sansAide ? 1 : 0);
      precedent = numero;
    }
    return bits;
  }

  function ecritureCases(reussites) {
    const bits = [];
    for (const { numero, sansAide } of reussites) {
      while (bits.length < 2 * (numero - 1)) bits.push(0);
      bits.push(1, sansAide ? 1 : 0);
    }
    return bits;
  }

  function somme(symboles) {
    return symboles.reduce((s, symbole) => (s * 37 + symbole + 1) % 1021, 11);
  }

  // reussites : liste de { numero, sansAide } ; serie : { dernier, longueur }.
  function creer(reussites, serie) {
    const tries = reussites.slice().sort((a, b) => a.numero - b.numero);
    const ecarts = ecritureEcarts(tries);
    const cases = ecritureCases(tries);
    const parEcarts = ecarts.length <= cases.length;

    const bits = [];
    ecrire(bits, VERSION, 2);
    bits.push(parEcarts ? 1 : 0);
    if (serie && serie.dernier) {
      bits.push(1);
      ecrire(bits, dateVersNombre(serie.dernier), BITS_JOUR);
      ecrire(bits, Math.min(serie.longueur, 255), BITS_LONGUEUR);
    } else {
      bits.push(0);
    }
    bits.push(...(parEcarts ? ecarts : cases));

    const symboles = [];
    for (let i = 0; i < bits.length; i += 5) {
      let symbole = 0;
      for (let j = 0; j < 5; j++) symbole = (symbole << 1) | (bits[i + j] || 0);
      symboles.push(symbole);
    }
    const controle = somme(symboles);
    const texte = [controle >> 5, controle & 31, ...symboles].map((s) => ALPHABET[s]).join("");
    return texte.match(/.{1,4}/g).join("-");
  }

  // Renvoie { dernier, longueur, reussites : Map(numero -> sansAide) }, ou null si le code n'est pas valide.
  function lire(saisie) {
    const texte = saisie.toUpperCase().replace(/[\s-]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
    if (texte.length < 3) return null;
    const tout = [];
    for (const caractere of texte) {
      const valeur = ALPHABET.indexOf(caractere);
      if (valeur < 0) return null;
      tout.push(valeur);
    }
    const controle = (tout[0] << 5) | tout[1];
    const symboles = tout.slice(2);
    if (somme(symboles) !== controle) return null;

    const bits = [];
    for (const symbole of symboles) ecrire(bits, symbole, 5);
    let position = 0;
    const lireBits = (taille) => {
      let valeur = 0;
      for (let i = 0; i < taille; i++) valeur = (valeur << 1) | (bits[position++] || 0);
      return valeur;
    };

    if (lireBits(2) !== VERSION) return null;
    const parEcarts = lireBits(1) === 1;
    const contenu = { dernier: null, longueur: 0, reussites: new Map() };
    if (lireBits(1) === 1) {
      contenu.dernier = nombreVersDate(lireBits(BITS_JOUR));
      contenu.longueur = lireBits(BITS_LONGUEUR);
    }

    if (parEcarts) {
      let numero = 0;
      while (position < bits.length) {
        let taille = 0;
        while (position < bits.length && bits[position] === 0) {
          taille++;
          position++;
        }
        if (position >= bits.length) break; // les derniers zeros ne sont que du bourrage
        numero += lireBits(taille + 1);
        if (numero > NUMERO_MAX) return null;
        contenu.reussites.set(numero, lireBits(1) === 1);
      }
    } else {
      for (let numero = 1; position + 1 < bits.length; numero++) {
        const reussi = lireBits(1) === 1;
        const sansAide = lireBits(1) === 1;
        if (reussi) contenu.reussites.set(numero, sansAide);
      }
    }
    return contenu;
  }

  return { creer, lire };
})();

if (typeof module !== "undefined") module.exports = CodeSauvegarde;
