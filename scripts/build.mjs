// Bundles the extension into dist/ (load that folder as an unpacked extension).
import * as esbuild from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';

const watch = process.argv.includes('--watch');

await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await cp('static', 'dist', { recursive: true });

const options = {
  entryPoints: {
    background: 'src/background/index.js',
    content: 'src/content/index.js',
    bridge: 'src/content/bridge.js',
    popup: 'src/popup/popup.js',
  },
  bundle: true,
  outdir: 'dist',
  format: 'iife',
  target: 'chrome116',
  legalComments: 'none',
  sourcemap: watch ? 'inline' : false,
  logLevel: 'info',
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log('Watching src/ … (re-run the build after editing static/)');
} else {
  await esbuild.build(options);
}
