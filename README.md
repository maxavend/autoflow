# Autoflow · Smart Connectors para Figma Design

El plugin está en inglés; todos sus textos están en `ui/messages.js`.

Conectores **nativos de FigJam** dentro de archivos de **Figma Design**: une dos elementos cualesquiera
(pantallas, botones anidados, subcapas de instancias, grupos…) con flechas que **Figma mantiene unidas** a
sus elementos cuando se mueven o cambian de tamaño, aunque el plugin esté cerrado. Trazado ortogonal, curvo
o recto, anclajes automáticos o fijos, etiquetas y estilos personalizables.

## Instalación (desarrollo)

```bash
npm install
```

```bash
npm run build
```

En Figma desktop: **Plugins → Development → Import plugin from manifest…** y elige `manifest.json`.
Luego ejecútalo desde **Plugins → Development → Autoflow · Smart Connectors**.

## Uso

| Acción | Cómo |
| --- | --- |
| Conectar dos elementos | Clic en el origen, Shift+clic en el destino → **Copy connector** → **⌘V** (Ctrl+V en Windows) en el lienzo. El conector copiado se crea con el estilo y los lados elegidos en el panel; sigue en el portapapeles, así que basta cambiar la selección y volver a pulsar ⌘V. |
| Lado de salida y entrada | Cada casilla (**Source**, **Target**) tiene una cuadrícula de FigUI3 que representa el elemento: el punto de cada borde fija el lado (arriba, derecha, abajo, izquierda) y el del centro es automático; debajo se lee el lado elegido. Con un conector seleccionado aparece la misma tarjeta: los puntos cambian sus lados y el nombre lleva al elemento en el lienzo. |
| Capas anidadas | ⌘/Ctrl+clic para seleccionar un botón dentro de una pantalla, un componente o una instancia. Figma no deja enganchar conectores a capas dentro de una instancia: el conector se engancha a la instancia real más cercana y apunta al botón (avisa con un mensaje). |
| Flujos de 3+ elementos | Selecciónalos y elige **One after another** (A→B→C) o **All from the first** (A→B, A→C). El panel muestra los conectores que creará **⌘V**; el botón de invertir cambia la dirección. |
| Editar | Selecciona un conector: barra estilo FigJam con color, trazo (grosor y estilo de línea), etiqueta (T), punta inicial, tipo de trazado y punta final. Anclajes, esquinas, hex exacto y tipografía en **More options**. Selección múltiple = edición en lote. |
| Prototipo | **Make prototype** (en *On this page*) convierte conectores en `On click → Navigate` instantáneos (sin transición): el clic queda en el origen (el botón, aunque esté dentro de una instancia) y navega a la pantalla del destino. Con un flujo seleccionado (sus pantallas, o los conectores) actúa solo sobre los conectores que salen de la selección (*Make prototype from selection*); sin selección, sobre toda la página. Si ninguna pantalla del flujo es punto de inicio, agrega uno en la primera; luego ▶ Present. Repetirlo no duplica interacciones. |
| My styles | **Save this style** guarda con un nombre el color, trazo, puntas, tipo de línea y tipografía actuales. Un clic en un estilo guardado lo aplica a los conectores seleccionados o, sin selección, a los nuevos. Se guardan en tu Figma (no en el archivo), así que están en todos tus archivos; el estilo de los conectores nuevos también se recuerda entre sesiones. |
| Sueltos | Si se borra la pantalla o capa de un extremo, el conector queda suelto: el panel avisa, **Show** lo selecciona en el lienzo y **Delete** lo elimina. |

## Cómo funciona (y por qué así)

En un archivo Design, `figma.createConnector` no existe y `connector.clone()` falla
(*Cloning CONNECTOR nodes is not supported in the current editor*). Pero un conector de FigJam **pegado** desde
el portapapeles sí es un `CONNECTOR` real, y la API permite editarlo. Por eso:

1. `ui/connector-payload.html` es un conector de FigJam tal como Figma lo escribe en el portapapeles
   (HTML con `(figmeta)` y un búfer `fig-kiwi`), creado en un FigJam propio y marcado con
   `sharedPluginData('autoflow', 'seed')`. **Copy connector** lo pone en el portapapeles con `execCommand('copy')`.
2. Al pegarlo con elementos seleccionados, Figma crea **una copia dentro de cada elemento**. El plugin escucha
   `PageNode.on('nodechange')`, reconoce las copias marcadas, conserva una por enlace y borra el resto, la mueve
   a la página (o a la sección común de ambos extremos), fija `connectorStart`/`connectorEnd` con imán `AUTO`,
   aplica el estilo predeterminado y quita la marca.
3. Desde ahí **Figma** mueve el conector con sus extremos. No hace falta tener el plugin abierto ni recalcular.
4. `sharedPluginData('autoflow', 'conn')` guarda los ids con los que se creó, para distinguir un conector que
   perdió su extremo de uno libre dibujado a propósito.
5. **No altera los diseños**: los conectores nunca quedan dentro de frames.

## Límites honestos

- **Cada conector necesita un ⌘V** del usuario: un plugin no puede pegar ni crear conectores por sí mismo en Design.
- El plugin debe estar **abierto** al pegar, para enganchar el conector. Pegado con el plugin cerrado, queda como
  un conector libre de FigJam.
- Depende del formato interno del portapapeles de Figma (`fig-kiwi`) y de que Figma siga aceptando pegar
  conectores de FigJam en Design. Si deja de funcionar, regenera `ui/connector-payload.html` desde FigJam.
- Los conectores nativos **no esquivan** otras pantallas; enrutan en codo, curva o recta entre los imanes.
- El fondo de la etiqueta no es editable por API en Design.

## Desarrollo

```bash
npm run check
```

Para publicar en Figma Community: `npm run listing` regenera el ícono, la portada y el carrusel (`publish/`, con la UI real), y `npm run release` revisa que todo esté listo. Los textos del formulario están en `publish/LISTING.md` y la marca, en `brand/kit/BRAND.md`.

`check` ejecuta ESLint, los tests (`node --test`: emparejado y anclajes, validación de la UI y contrato
plugin↔UI con pegado simulado sobre un mock de `figma`) y el build: `tsc --noEmit` + esbuild (`src/code.ts` →
`dist/code.js`) + Vite con `vite-plugin-singlefile` (`ui/` → `dist/ui.html`, un solo HTML sin recursos remotos).

La UI usa [FigUI3](https://github.com/rogie/figui3) `11.2.2` (núcleo MIT; módulo editor `fig-select`/`fig-fill-picker`/`fig-reorder` con licencia PolyForm Shield 1.0.0) e íconos oficiales de UI3 extraídos de `@create-figma-plugin/ui` con `npm run icons` → `ui/icons.js`.

Verificación visual fuera de Figma: sirve la raíz del proyecto (`python3 -m http.server 8765`) y abre `test/ui/harness.html?theme=dark&scenario=connector` (carga `dist/ui.html` en un iframe y simula el plugin; escenarios `defaults|connector|nolabel|nodes|one|two|multi`, `&presets` para estilos guardados). `node test/ui/screenshots.mjs` genera capturas 2x con Chrome headless en `test/ui/screenshots/`.

### Contrato de mensajes

| Dirección | Tipo | Payload |
| --- | --- | --- |
| plugin → UI | `state` | `nodes[], connectors[{id,data,fromName,toName}], stats{total,broken}, defaults, presets[]` |
| plugin → UI | `fonts` | `fonts[{family, styles[]}]` (de `listAvailableFontsAsync`) |
| plugin → UI | `result` | `requestId, action, ok, message` — respuesta a cada mensaje de la UI excepto `plan` y `resize` |
| UI → plugin | `ready` · `clean` · `reset-defaults` | — |
| UI → plugin | `plan` | `order: id[], mode: chain\|fan, fromSide, toSide` (para el próximo ⌘V) |
| UI → plugin | `patch` | `ids[], patch{kind?, label?, fromSide?, toSide?, fromT?, toT?, style?}` |
| UI → plugin | `swap` · `delete` · `prototype` | `ids[]` |
| UI → plugin | `select` | `id, which: from\|to` |
| UI → plugin | `defaults` | `defaults{kind, style}` · `defaults-from`: `id` |
| UI → plugin | `preset-save` · `preset-delete` | `name, preset{kind, style}` · `id` (estilos guardados en `clientStorage`) |
| UI → plugin | `select-broken` | — (selecciona los conectores sueltos) |
| UI → plugin | `resize` | `height` |

```
src/model.ts      modelo del panel y normalización
src/plan.ts       emparejado, orden de clic, anclajes ↔ endpoints, puntas y trazos (puro, testeable)
src/connector.ts  lectura y escritura del CONNECTOR nativo (extremos, estilo, etiqueta)
src/code.ts       puente con la UI, memoria de selección, adopción del pegado, estilos guardados
ui/               panel (FigUI3) + connector-payload.html + messages.js (todos los textos, en inglés, compartidos con src/)
test/             tests + arnés de la UI
```
