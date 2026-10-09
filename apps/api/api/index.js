// Vercel serverless entry. The Nest app is compiled to dist/ by `pnpm vercel-build`; decorators need tsc, not Vercel's bundler.
// The require lives inside the handler so a load or boot failure becomes a logged 503, not an opaque platform 500.
module.exports = async function handler(req, res) {
  try {
    await require('../dist/vercel').default(req, res);
  } catch (error) {
    console.error('API failed to start', error);
    if (res.headersSent) return;
    // BOOT_DEBUG=true is a temporary switch to read the startup error from the response; leave it unset normally.
    const detail = process.env.BOOT_DEBUG === 'true' && error instanceof Error ? error.message.slice(0, 600) : 'The API is unavailable';
    res.statusCode = 503;
    res.setHeader('content-type', 'application/problem+json');
    res.end(JSON.stringify({ type: 'about:blank#503', title: 'Service Unavailable', status: 503, detail }));
  }
};
