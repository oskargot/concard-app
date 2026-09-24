// Web entry. `@shopify/react-native-skia` binds to `global.CanvasKit` when it
// is first imported, so CanvasKit (Skia compiled to WASM) has to be loaded
// before expo-router pulls in any screen. With it, the web target draws the
// real SkSL foil, which is what lets `npm run shots` show foil at all.
//
// canvaskit.wasm is served from public/ (copied there, git-ignored, by
// scripts/setup-skia-web.mjs). If it can't load, the app still starts and
// every foil steps aside, as it did before (see skiaAvailable()).
import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web';

LoadSkiaWeb({ locateFile: (file) => `/${file}` })
	.catch((e) => console.warn('[skia-web] CanvasKit did not load; foil is off on web.', e))
	// require, not import(): Metro bundles it with everything else but only runs
	// it here, after CanvasKit exists. (A lazy import() chunk fails in dev.)
	.then(() => require('expo-router/entry'));
