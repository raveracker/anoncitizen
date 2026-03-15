import { defineConfig } from "vitest/config";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const cert = readFileSync(resolve(__dirname, "assets/uidai-offline-ekyc.cer"), "utf-8");

export default defineConfig({
  define: {
    __UIDAI_CERT__: JSON.stringify(cert),
  },
});
