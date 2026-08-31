<!--
  Deux façons de proposer un PDF sur une page. Chemins relatifs à l'index.md
  qui contient le bloc (ex. "cours/01-titre.pdf"). Voir CONVENTIONS.md § Documents PDF.
-->


<!-- ========================================================================
     1) PAR DÉFAUT — liens « Voir / télécharger »
     Simple, léger, parfait quand la page regroupe plusieurs documents.
     ======================================================================== -->

## Titre du document

_Courte description._

[Voir le document](cours/01-titre-du-chapitre.pdf){ .md-button .md-button--primary target=_blank }
[télécharger](cours/01-titre-du-chapitre.pdf){ download }


<!-- ========================================================================
     2) OPTIONNEL — visionneuse intégrée dans un bloc dépliable
     Pour UN document mis en avant qu'on veut lire sans quitter la page.
     HTML brut : à laisser en colonne 0 (pas indenté sous une admonition).
     ======================================================================== -->

<details class="pdf-chapter">
<summary>Chapitre 01 — Titre du chapitre</summary>
<object class="pdf-embed" data="cours/01-titre-du-chapitre.pdf#view=FitH" type="application/pdf">
<p>L’aperçu ne s’affiche pas sur cet appareil. <a href="cours/01-titre-du-chapitre.pdf">Ouvrir le PDF</a></p>
</object>
<p class="pdf-actions">
<a class="md-button" href="cours/01-titre-du-chapitre.pdf" target="_blank">Ouvrir en plein écran</a>
<a class="md-button" href="cours/01-titre-du-chapitre.pdf" download>Télécharger</a>
</p>
</details>
