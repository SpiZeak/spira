// Bridge: lunr-languages register on a global `lunr`; elasticlunr is a lunr fork,
// so aliasing the globals lets the Swedish stemmer register on elasticlunr.
window.lunr = window.elasticlunr;
