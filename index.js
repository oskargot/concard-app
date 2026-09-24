// Native entry: exactly what package.json's `main` used to name directly.
// The web target has its own entry (index.web.js), which has to load Skia's
// CanvasKit before anything imports Skia.
import 'expo-router/entry';
