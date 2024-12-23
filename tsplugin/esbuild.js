// file: esbuild.js

const { build } = require('esbuild');

const baseConfig = {
    bundle: true,
    minify: true,
    sourcemap: false,
};


const config = {
    ...baseConfig,
    platform: 'node',
    mainFields: ['module', 'main'],
    format: 'cjs',
    entryPoints: ['src/index.ts'],
    outfile: 'index.js',
    external: ['vscode'],
};

(async () => {
    try {
        await build(config);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();