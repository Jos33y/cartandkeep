// Health & Beauty only.
// Salon treatments and professional-only products are not shelf products for her.
export const NOT_SHELF = ['salon treatment', 'professional use only', 'trade only'];
// Diagnostic strips and test kits: in vitro diagnostic devices, held back from this category's store picks.
// Meters and monitors (blood pressure, glucose meters) still pass.
export const RESTRICTED = { diagnostics: String.raw`\b(?:test|reagent) strips?\b|\btest kits?\b` };
