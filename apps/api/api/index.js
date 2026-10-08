// Vercel serverless entry. The Nest app is compiled to dist/ by `pnpm vercel-build`; decorators need tsc, not Vercel's bundler.
const entry = require('../dist/vercel');

module.exports = entry.default;
