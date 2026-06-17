// Vercel serverless function: handles ALL /api/* requests
// Imports the Express app from the pre-built backend bundle
// The backend must be built before deploying (see build command in vercel.json)

import app from '../artifacts/api-server/dist/index.mjs'

export default app
