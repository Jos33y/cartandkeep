// Lets the scripts load portal files written for Vite, which imports "./product" without ".js".
// Node needs the extension; this tries ".js" and "/index.js" when a relative import has none. Scripts only:
// nothing in src/ is changed.
export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context);
  } catch (err) {
    if (err?.code !== 'ERR_MODULE_NOT_FOUND' || !/^\.\.?\//.test(specifier) || /\.[cm]?jsx?$/.test(specifier)) throw err;
    for (const tail of ['.js', '.mjs', '/index.js']) {
      try { return await next(specifier + tail, context); } catch { /* try the next */ }
    }
    throw err;
  }
}
