// file: esbuild.js

const { build } = require('esbuild');

const baseConfig = {
    bundle: true,
    minify: true,
    sourcemap: false,
};

const extensionConfig = {
    ...baseConfig,
    platform: 'node',
    mainFields: ['module', 'main'],
    format: 'cjs',
    entryPoints: ['src/extension.ts'],
    outfile: 'out/extension.js',
    external: ['vscode'],
};

(async () => {
    try {
        await build(extensionConfig);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();