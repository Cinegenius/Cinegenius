import { register } from "node:module";
import { fileURLToPath } from "node:url";

register("./test-alias-loader.mjs", import.meta.url);

// Route fixtures transpile handlers to CommonJS and use createRequire. Their
// synchronous imports need the same resolution as the ESM tests for this module.
const { registerHooks } = await import('node:module');
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/lib/places/')) {
      return nextResolve(fileURLToPath(new URL(`../${specifier.slice(2)}.ts`, import.meta.url)), context);
    }
    return nextResolve(specifier, context);
  },
});
