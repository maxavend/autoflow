// Glyphs with no official UI3 icon (connector path types, dotted stroke,
// stroke weights). Drawn on the same 24px grid and 1px stroke as the
// official icons in ui/icons.js so they sit side by side.
const svg = (body) =>
  `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const GLYPHS = {
  elbow: svg('<path d="M6.5 7.5h4a1.5 1.5 0 0 1 1.5 1.5v6a1.5 1.5 0 0 0 1.5 1.5h4"/>'),
  curve: svg('<path d="M6.5 7.5c6 0 5 9 11 9"/>'),
  strokeDot: svg('<path d="M6.5 12h.01M9.5 12h.01M12.5 12h.01M15.5 12h.01M18.5 12h.01" stroke-width="1.5"/>'),
  check: svg('<path d="m8 12.5 2.5 2.5 5.5-6"/>'),
  // Stroke weights for the weight picker: the line itself is the label.
  weight1: svg('<path d="M6 12h12" stroke-width="1"/>'),
  weight2: svg('<path d="M6 12h12" stroke-width="2"/>'),
  weight4: svg('<path d="M6.5 12h11" stroke-width="3.5"/>'),
  weight6: svg('<path d="M7 12h10" stroke-width="5"/>'),
};
