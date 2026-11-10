// The clipboard payload is bundled as text (esbuild loader: text).
declare module '*.html' {
  const text: string;
  export default text;
}

// chroma-js (used by FigUI's color input) ships no types.
declare module 'chroma-js';
