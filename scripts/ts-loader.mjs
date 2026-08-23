export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const url = new URL(`../${specifier.slice(2)}`, import.meta.url);
    if (!url.pathname.endsWith(".ts") && !url.pathname.endsWith(".js")) {
      url.pathname += ".ts";
    }
    return nextResolve(url.href, context);
  }

  if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    !/\.[cm]?[jt]sx?$/.test(specifier)
  ) {
    try {
      return await nextResolve(`${specifier}.ts`, context);
    } catch {
      return nextResolve(specifier, context);
    }
  }

  return nextResolve(specifier, context);
}
