// Autoflow panel entry: mounts the React UI (FigUI components), listens to
// the plugin and follows Figma's light or dark theme. The styles
// (ui/styles/app.css) are compiled by Tailwind and inlined by
// scripts/build-ui.mjs into dist/ui.html.
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { loadAdvanced, onPluginMessage } from './app/store';

window.addEventListener('message', (e) => onPluginMessage(e.data && e.data.pluginMessage));

// With themeColors: true, Figma puts figma-dark on <html>; FigUI uses the dark class.
const html = document.documentElement;
const theme = () => html.classList.toggle('dark', html.classList.contains('figma-dark'));
theme();
new MutationObserver(theme).observe(html, { attributes: true, attributeFilter: ['class'] });

loadAdvanced();
createRoot(document.getElementById('root')!).render(<App />);
