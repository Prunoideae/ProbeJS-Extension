// file: esbuild.js

const { build } = require('esbuild');

const baseConfig = {
    bundle: true,
    minify: true,
    sourcemap: false,
};

const webviewConfig = {
    ...baseConfig,
    target: "es2020",
    format: "esm",
    entryPoints: ["./src/webview/main.ts"],
    outfile: "./out/webview.js",
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
        await build(webviewConfig);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();