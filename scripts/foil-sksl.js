#!/usr/bin/env node
/**
 * Prints the SkSL that `SkiaFoil` compiles for one recipe.
 *
 *     node scripts/foil-sksl.js mosaic > mosaic.sksl   (from concard-app/)
 *     node scripts/foil-sksl.js                          # lists the recipes
 *
 * `src/card/foil/foil-sksl.ts` has no React Native imports, so it can run
 * here with TypeScript's own transpiler as a require hook. This is how a
 * recipe gets checked in the Skia Labs editor (skialabs.dev) before it goes
 * anywhere near a phone: swap the `u_*` uniforms for Skia Labs' `iTime` /
 * `iResolution` / `iMouse` and the `u_tex` sample for a stand-in, and the rest
 * of the shader compiles as-is.
 */

const path = require('path');
const Module = require('module');
const ts = require('typescript');

// Compile .ts on the fly to CommonJS; nothing here needs Metro or Babel.
Module._extensions['.ts'] = (module, filename) => {
	const source = require('fs').readFileSync(filename, 'utf8');
	const { outputText } = ts.transpileModule(source, {
		compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
		fileName: filename
	});
	module._compile(outputText, filename);
};

const { buildSource, SKIA_RECIPE_NAMES } = require(
	path.join(process.cwd(), 'src', 'card', 'foil', 'foil-sksl.ts')
);

const name = process.argv[2];
if (!SKIA_RECIPE_NAMES.includes(name)) {
	console.error(`usage: node scripts/foil-sksl.js <${SKIA_RECIPE_NAMES.join('|')}>`);
	process.exit(name ? 1 : 0);
}
process.stdout.write(buildSource(name));
