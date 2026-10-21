import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = pathToFileURL(fileURLToPath(new URL("../", import.meta.url)));

export async function resolve(specifier, context, nextResolve) {
  if (!specifier.startsWith("@/")) return nextResolve(specifier, context);

  const path = specifier.slice(2);
  const hasExtension = /\.[a-zA-Z0-9]+$/.test(path);
  const target = new URL(`${path}${hasExtension ? "" : ".ts"}`, projectRoot);
  return nextResolve(target.href, context);
}
