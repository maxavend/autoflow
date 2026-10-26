# Autoflow original (David Zhao · Yitong Zhang): análisis

Fuente: plugin de Community `733902567457592893`, versión 45 (13 may 2025), ejecutado en Figma web el
2026-10-26. El paquete se obtuvo del endpoint que Figma usa para cargarlo
(`/community/plugin/733902567457592893/code?version_id=132368`). La licencia es *Community Paid Resource
License*: aquí solo se describe el comportamiento; no se copia código.

## Tamaño y forma del paquete

| | Original | Nuestro |
| --- | --- | --- |
| Paquete total | 2,85 MB | 52 KB (`code.js`) + 782 KB (`ui.html`) |
| UI (`__html__`) | 2,44 MB, HTML/JS vanilla, 6 imágenes base64 | figui3 + Preact, un solo archivo |
| Código principal | ~410 KB sin minificar | TypeScript compilado con esbuild |

## Cómo dibuja un flujo

- **Disparador:** el switch *Draw on selection*. Cuando la selección pasa de **1 nodo** a **2 nodos que incluyen
  el anterior**, crea el flujo. El primero es el origen y el nuevo es el destino. No detecta la tecla Shift: solo
  mira esa transición de selección.
- **Consecuencia (reclamos de Community):** con el switch activado, cualquier selección múltiple accidental crea
  flechas. Además, Shift choca con el flujo normal de mover pantallas. Varios usuarios piden un atajo o un modo
  explícito.
- **Nodo creado:** un `VECTOR` llamado `Origen --> Destino`. La etiqueta es un `FRAME` + `TEXT` aparte. El estilo
  *sketchy* genera un segundo vector "rough".
- **Ubicación:** en el **ancestro común más bajo** de origen y destino. Si ese ancestro es un frame con auto
  layout, el vector se marca `layoutPositioning = "ABSOLUTE"`. Es decir, **sí mete flechas dentro de los frames**;
  el nuestro no.

## Dónde guarda los datos

- `figma.currentPage.setPluginData("flows", "id1,id2,…")`: índice por página, como **una sola cadena con IDs
  separados por comas**.
- `vector.setPluginData(<id del vector>, JSON)`: por flujo guarda geometría, rough, terminalStart/End,
  offsetStart/End, srcId, dstId, frameId, roughId, textId y preferencias de ruta.
- `flowStyles`, `shapes` y `shapeStyles` también van en `pluginData` de la página.
- Usa `pluginData` **privado**, no `sharedPluginData`. Ningún otro plugin puede leerlo.
- Como el índice es una sola cadena por página, si dos personas dibujan a la vez gana la última escritura. Eso
  explica el reclamo de que Autoflow "olvida" flechas.

## Actualización en vivo

- Escucha `figma.on("documentchange")`. Redibuja **solo** cuando el cambio es `LOCAL` + `PROPERTY_CHANGE` **y hay
  algo seleccionado**. No reacciona a lo que mueven los colaboradores (`REMOTE`).
- `documentchange` obliga a cargar todo el documento, lo que lo hace lento en archivos grandes. Es el reclamo más
  repetido en Community ("extremely slow").
- Llama 113 veces a `figma.getNodeById` (la versión síncrona), que está obsoleta con carga dinámica de páginas.
  Probablemente explica los fallos con *slots* y con actualizaciones recientes de Figma.
- `currentpagechange` reaplica la visibilidad al cambiar de página. `figma.skipInvisibleInstanceChildren = true`.

## Opciones de la UI (IDs del HTML)

- **Pestañas:** Flows · Shapes (y una pestaña Connectors oculta).
- **Línea:** color hex + opacidad; geometría `STRAIGHT` / `BEZIER` / `RIGHT_ANGLE`; grosor; radio de esquina;
  patrón de trazo; estilo *Smooth* / *Sketchy*.
- **Puntas:** desplegables independientes de inicio y fin con `ARROW_LINES`, `ARROW_EQUILATERAL`, `OPEN`, `DOT` y
  `FLAT`, más **offset** (separación) en cada extremo.
- **Puertos:** minidiagrama con las cajas A y B y un punto por lado. Al hacer clic en un punto se fija el lado de
  salida o de llegada (mensajes `src` / `dst`).
- **Texto sobre la ruta:** campo "Add text…". Fuentes Inter, Courier y Gloria Hallelujah (esta última para el
  estilo sketchy), tres tamaños y alineación.
- **Shapes:** rectángulo, círculo y rombo con texto, relleno, trazo, tramado (*hachure*) y rugosidad. Es una
  herramienta de pizarra.
- **Pie del panel:** switch *Draw on selection*, ojo para ocultar o mostrar todos los flujos y botón para
  actualizar todos.
- **Otros:** botón de relanzamiento "Open Autoflow" en el panel derecho (`root.setRelaunchData`) y un límite de
  50 flujos gratis por archivo (`figma.payments`).

## Observado al ejecutarlo en el navegador integrado

- `Error: The font "Courier Regular" could not be loaded`. En la web, sin el agente de fuentes local, Courier no
  existe; el error se captura y el plugin sigue.
- No conseguí que dibujara un flujo en este navegador: el switch *Draw on selection* volvía a "off" al
  interactuar con el lienzo y no apareció la notificación "Enabled flow drawing". En Figma desktop hay que
  verificarlo; no lo atribuyo a un fallo del plugin sin esa prueba.
- Al abrirse, el plugin limpia y silencia la consola, así que no deja trazas útiles en `console.log`.

## Qué ya hace mejor el nuestro

- Usa `sharedPluginData` por conector (`autoflow/conn`), de modo que la relación viaja con copiar y pegar y la ven
  los colaboradores.
- Usa `PageNode.on("nodechange")` también con cambios `REMOTE` y recalcula de forma incremental, sin cargar todo
  el documento.
- Nunca inserta flechas dentro de los frames: van en la página o en la sección común.
- Su enrutador A* ortogonal esquiva otras pantallas.
- Importa conectores desde el prototipo y puede crear interacciones.
- El paquete es unas 3,5 veces más liviano.

## Qué le falta al nuestro frente al original

1. **Selector visual de puertos** (minidiagrama A/B con puntos por lado). Es más directo que elegir anclajes en
   un desplegable.
2. **Ocultar o mostrar todos** los conectores de la página (el ojo).
3. Puntas **independientes** en inicio y fin, con una forma distinta en cada extremo.
4. Estilo **sketchy** (a mano alzada). Opcional, según el uso.
5. Formas de pizarra (Shapes). Probablemente fuera de alcance.

## Propuestas de UI a partir de los reclamos de usuarios

- **Crear conectores sin accidentes:** mantener *Modo conectar* explícito, con un atajo para entrar y salir
  (Esc). No crear flechas solo porque la selección cambió.
- **Panel según el contexto:** sin selección, el modo y las acciones de la página; con un elemento, "origen
  listo"; con un conector, solo su barra de edición. Hoy se ven a la vez "Estilo de nuevos conectores", "Página"
  y el pie.
- **Agrupar todo lo que crea el plugin** en un contenedor "Autoflow" por página (pedido explícito en Community).
- **Rendimiento visible:** contador y "Recalcular" en una línea compacta, sin ocupar el pie del panel.

---

# Superconnector (David Zhao): análisis

Fuente: plugin de Community `1425926270288521465`, versión 21 (13 may 2025), ejecutado en Figma web el
2026-10-26. El código principal está **ofuscado** (arreglo de cadenas `a1_0x…`) y pesa 1,72 MB, de los cuales
1,39 MB son la UI.

## La idea: conectores **nativos** de FigJam dentro de un archivo de Design

`figma.createConnector` no existe en Design, pero un nodo `CONNECTOR` **sí puede existir** si se pega desde el
portapapeles. Superconnector hace esto:

1. La UI trae incrustados **30 payloads de portapapeles de Figma**: HTML con `(figmeta)` y un búfer `(figma)` en
   formato binario `fig-kiwi`. Son 25 formas de FigJam (`SHAPE_WITH_TEXT`) y un `CONNECTOR` ortogonal; otros 4 no
   generaron nada.
2. **"Click to copy"** escribe uno de esos payloads en el portapapeles con `execCommand('copy')` y muestra el toast
   "✅ Copied connector".
3. El usuario selecciona dos objetos y pulsa **⌘V** (modo *Manual*). El plugin detecta el `CONNECTOR` nuevo y lo
   engancha a la selección.
4. El modo *Auto* (⇧+selección, sin pegar) usaba `connector.clone()` sobre un conector ya existente en el
   archivo. **Hoy falla**:

   > `in clone: Cloning CONNECTOR nodes is not supported in the current editor`

   Eso explica los comentarios de que "Auto dejó de funcionar y Manual sigue".

## Verificado por API en un archivo de Design (consola de Figma web)

| Operación | Resultado |
| --- | --- |
| Pegar el payload del conector | ✅ crea `CONNECTOR` |
| `connectorStart` / `connectorEnd` con `{ endpointNodeId, magnet: "AUTO" }` | ✅ |
| Extremo en una **capa anidada** (botón dentro de un frame) | ✅ |
| Extremo con `position` relativa al nodo, extremo libre `{ position: {x, y} }`, `magnet: "LEFT"` | ✅ |
| `connectorLineType`: `ELBOWED`, `STRAIGHT`, `CURVED` | ✅ |
| Trazo, grosor, `connectorEndStrokeCap = "TRIANGLE_FILLED"` | ✅ |
| Etiqueta nativa: `loadFontAsync(conn.text.fontName)` y luego `conn.text.characters` | ✅ |
| `setSharedPluginData` sobre el conector | ✅ |
| Mover al conector a la página o a una sección con `appendChild` | ✅ |
| `conn.clone()` | ❌ no soportado en Design |
| `figma.createConnector()` | ❌ no existe en Design |
| **Seguir a sus extremos con el plugin cerrado** (mover y arrastrar pantallas) | ✅ lo hace Figma |

**Detalle importante del pegado:** con **dos** frames seleccionados, ⌘V pega **un conector dentro de cada
frame**, cada uno con sus dos extremos sobre su propio frame. El plugin tiene que quedarse con uno, moverlo a la
página, engancharlo origen → destino y borrar el otro. Verificado.

**Limitación:** el conector nativo **no esquiva obstáculos**; pasa por encima de otras pantallas. Lo único que
hace es enrutar en codo o en curva entre los imanes.

## UI de Superconnector

- **Barra:** color (con la opción *Random*), opacidad, formas de FigJam (cuadrado, círculo, triángulo), grosor,
  radio de esquina, patrón de trazo, tipo de línea (recta o codo), invertir dirección y puntas de inicio y fin.
- **Selector de puertos:** dos cajas con los nombres de origen y destino y un punto por lado (igual que Autoflow).
- **Etiqueta:** campo "Add text…".
- **Pie:** switch **Manual / Auto** con su atajo ("Select + ⌘V"), ojo para ocultar todos y una casilla.
- Cuando el archivo no tiene ningún conector, la UI queda bloqueada con un velo ("protective glass") hasta que
  pegas uno. Hay un comentario en Community que lo reporta.

## Qué significa para nuestro plugin

Hay dos motores posibles:

| | Motor actual (vectores propios) | Motor nativo (pegar un `CONNECTOR`) |
| --- | --- | --- |
| Crear | 1 clic, sin portapapeles | el usuario debe pulsar **⌘V** en cada conector |
| Seguir al mover | solo con el panel abierto (al reabrirlo se reconcilia) | **siempre**, lo mueve Figma |
| Esquivar pantallas | ✅ A* propio | ❌ |
| Estilo | total (puntas por vértice, etiquetas auto layout) | el de FigJam: puntas, codo/recta/curva, etiqueta nativa |
| Riesgo | API pública estable | depende del formato interno `fig-kiwi` del portapapeles y de que Figma siga permitiendo pegar conectores en Design |

Si se adopta el motor nativo, hay que **generar nuestro propio payload**: copiar un conector desde un archivo
FigJam nuestro y guardar ese HTML. Los payloads de Superconnector no se pueden reutilizar.
