/*
 * One file per Google top category, only when that category needs rules the shared lists do not have.
 * Export any of: OWN_LABEL (brand names), NOT_SHELF, RESTRICTED, CANT_POST (arrays of regex sources).
 * They are added to the shared lists for that category only. Register the file in ../index.mjs.
 *
 *   // categories/apparel.mjs
 *   export const OWN_LABEL = ['river island', 'new look'];
 *   export const NOT_SHELF = ['bespoke', 'tailored to'];
 */
export {};
