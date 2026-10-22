import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = pathToFileURL(fileURLToPath(new URL("../", import.meta.url)));

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const path = specifier.slice(2);
    const hasExtension = /\.[a-zA-Z0-9]+$/.test(path);
    const target = new URL(`${path}${hasExtension ? "" : ".ts"}`, projectRoot);
    return nextResolve(target.href, context);
  }

  // Node's native type stripping does not resolve extensionless relative TS
  // imports the way the Next.js bundler does. Mirror that behavior for tests.
  if (specifier.startsWith(".") && !/\.[a-zA-Z0-9]+$/.test(specifier)) {
    try {
      return await nextResolve(`${specifier}.ts`, context);
    } catch {
      // Preserve Node's normal error and resolution behavior if no TS file exists.
    }
  }

  return nextResolve(specifier, context);
}
