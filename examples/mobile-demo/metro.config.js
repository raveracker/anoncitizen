const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Watch all packages in the monorepo
config.watchFolders = [monorepoRoot];

// Resolve packages from the monorepo root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// Allow .js imports to resolve to .ts/.tsx files (ESM convention used in packages)
config.resolver.sourceExts = [...(config.resolver.sourceExts || []), "mjs"];
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // If importing a .js file that doesn't exist, try .ts/.tsx
  if (moduleName.endsWith(".js")) {
    const tsName = moduleName.replace(/\.js$/, ".ts");
    const tsxName = moduleName.replace(/\.js$/, ".tsx");
    try {
      return context.resolveRequest(context, tsName, platform);
    } catch {
      try {
        return context.resolveRequest(context, tsxName, platform);
      } catch {
        // Fall through to default resolution
      }
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
