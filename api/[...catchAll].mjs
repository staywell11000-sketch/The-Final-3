// Vercel serverless function: handles ALL /api/* requests
// Imports the Express app from the pre-built backend bundle
// The backend must be built before deploying (see build command in vercel.json)

import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

let app;

try {
  app = await import(path.resolve(__dirname, "../../artifacts/api-server/dist/index.mjs")).then(m => m.default);
} catch (err) {
  console.error("Failed to import api-server:", err);
  app = (req, res) => {
    res.status(500).json({ error: "API server not available" });
  };
}

export default app;