// Vercel serverless entry. The Nest app is compiled to dist/ by `pnpm vercel-build`; decorators need tsc, not Vercel's bundler.
// The require lives inside the handler so a load or boot failure becomes a logged 503, not an opaque platform 500.
const respond = (res, status, body, type = 'application/json') => {
  res.statusCode = status;
  res.setHeader('content-type', type);
  res.end(JSON.stringify(body));
};

// TEMPORARY (BOOT_DEBUG=true only): /api/_diag/<stage> loads one risky dependency at a time so a native-module
// crash can be pinned down without platform logs. Remove once sign-in works on Vercel.
async function diagnose(stage) {
  if (stage === 'ping') return { node: process.version, arch: process.arch, platform: process.platform };
  if (stage === 'env') return { keys: Object.keys(process.env).filter((k) => !k.startsWith('VERCEL_') && !/KEY|PASSWORD|SECRET|TOKEN/.test(k)).sort() };
  if (stage === 'argon2') {
    const argon2 = require('argon2');
    return { hashed: (await argon2.hash('x')).slice(0, 12) };
  }
  if (stage === 'prisma') {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    try {
      await prisma.$connect();
      return { connected: true, now: await prisma.$queryRaw`select 1 as ok` };
    } finally {
      await prisma.$disconnect();
    }
  }
  if (stage === 'dist') return { loaded: typeof require('../dist/vercel').default };
  return { stages: ['ping', 'env', 'argon2', 'prisma', 'dist'] };
}

module.exports = async function handler(req, res) {
  const diag = process.env.BOOT_DEBUG === 'true' && /^\/api\/_diag(\/|$)/.test(req.url || '');
  if (diag) {
    try {
      return respond(res, 200, await diagnose((req.url || '').split('?')[0].split('/')[3]));
    } catch (error) {
      return respond(res, 500, { error: String(error && error.message).slice(0, 800) });
    }
  }
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
