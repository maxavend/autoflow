# Ficha para Figma Community

Estos son los textos e imágenes para llenar el formulario **Plugins → Manage plugins → Publish** de Figma desktop.

## Antes de publicar

1. Ejecuta `npm run release`. El comando pasa el lint, corre los tests y compila. Después revisa el manifest, el build, que la UI no use recursos externos, los avisos de licencia y las imágenes. Tiene que terminar con "Listo para publicar". Hoy marca un pendiente:
   - **`id` del manifest:** es `1696659204905122263`, el que Figma generó en el primer intento de publicación (antes era `autoflow-smart-connectors`, que no es un id de Figma). No lo cambies: las versiones siguientes se publican con **Publish new version** sobre este id.
   - **Avisos de licencia:** la UI usa FigUI3 (de Rogie King; el módulo de editor tiene licencia PolyForm Shield 1.0.0) y los íconos UI3 de `@create-figma-plugin/ui` (de Yuan Qing Lim). Agrega sus avisos a la interfaz y un `THIRD_PARTY_NOTICES.md`, como en Properties Copycat.
2. **Nombre:** ya existe en Community un plugin pagado llamado *Autoflow*, de David Zhao y Yitong Zhang. Figma puede rechazar un nombre repetido, y la gente confundiría los dos plugins. Decide el nombre final antes de enviar. Si cambia, actualiza `manifest.json`, esta ficha y las imágenes (`npm run listing`).
3. Prueba el plugin en Figma desktop con la lista de [Prueba manual](#prueba-manual).
4. Activa la verificación en dos pasos de tu cuenta de Figma. Es obligatoria para publicar.

## Describe your resource

**Name:** Autoflow · Smart Connectors

**Tagline (ES):** Conectores nativos de FigJam en Figma Design que siguen pegados a tus pantallas y capas.

**Tagline (EN):** Native FigJam connectors in Figma Design that stay attached to your screens and layers.

**Category:** Design tools

**Description (ES):**

> Dibuja flujos en Figma Design con conectores nativos de FigJam: flechas que Figma mantiene unidas a sus elementos cuando los mueves o cambias de tamaño, incluso con el plugin cerrado.
>
> Haz clic en el origen, Shift+clic en el destino, pulsa **Copy connector** y pega con **⌘V** (Ctrl+V en Windows). Con ⌘/Ctrl+clic llegas a botones dentro de una pantalla o a capas de una instancia.
>
> • Flujos de 3 o más elementos: uno tras otro (A → B → C) o todos desde el primero (A → B, A → C).
> • Estilo de FigJam: color, grosor, etiqueta, línea, trazado ortogonal, curvo o recto, y puntas. Guarda tus estilos y edita varios conectores a la vez.
> • Prototipo: con un conector seleccionado, **Create prototype interaction** agrega una interacción real On click → Navigate en su origen.
> • Conectores sueltos: si borras un extremo, el panel lo avisa; **Show** los selecciona y **Delete** los borra.
>
> Los conectores van en la página (o en la sección que comparten sus extremos), nunca dentro de tus frames. Figma no permite que un plugin pegue conectores por su cuenta, así que cada uno se crea con tu ⌘V, y el plugin debe estar abierto al pegar. No se conecta a internet ni envía datos fuera de Figma. La interfaz está en inglés.

**Description (EN):**

> Draw flows in Figma Design with native FigJam connectors: arrows that Figma keeps attached to their elements when you move or resize them, even with the plugin closed.
>
> Click the source, Shift+click the target, click **Copy connector** and paste with **⌘V** (Ctrl+V on Windows). ⌘/Ctrl+click reaches buttons inside a screen or layers inside an instance.
>
> • Flows of 3 or more elements: one after another (A → B → C) or all from the first (A → B, A → C).
> • FigJam styling: color, weight, label, line, elbow, curved or straight paths, and caps. Save your own styles and edit many connectors at once.
> • Prototype: with a connector selected, **Create prototype interaction** adds a real On click → Navigate interaction to its source.
> • Loose connectors: if you delete an end, the panel flags them; **Show** selects them and **Delete** removes them.
>
> Connectors live on the page (or in the section their ends share), never inside your frames. Figma doesn't let plugins paste connectors on their own, so each one is created by your ⌘V, with the plugin open. The plugin never connects to the internet or sends data outside Figma.

## Images

- **Icon:** `publish/icon.png` (128 × 128). Es el ícono Liquid Glass claro (`brand/kit/glass/`).
- **Thumbnail:** `publish/cover.png` (1920 × 1080).
- **Carousel:** siete imágenes de 1920 × 1080 en inglés, en este orden (la portada va primero, como thumbnail):
  1. `publish/carousel-1-how-it-works.png`: los tres pasos, con el panel real.
  2. `publish/carousel-2-attached.png`: mueves la pantalla y la flecha la sigue.
  3. `publish/carousel-3-flows.png`: flujos de 3 o más (*One after another*, *All from the first*).
  4. `publish/carousel-4-styles.png`: estilos de FigJam y *My styles*.
  5. `publish/carousel-5-prototype.png`: del mapa de flujo al prototipo (*Create prototype interaction*).
  6. `publish/carousel-6-native.png`: nativo, privado y fuera de tus diseños.
  7. `publish/carousel-7-closing.png`: cierre, con el ícono y dónde encontrar el plugin.

Las fuentes de las imágenes están en `publish/src/`. El panel que aparece en ellas es la UI real (`dist/ui.html`), cargada por medio de `test/ui/harness.html`. Para regenerarlas usa `npm run listing`. Si cambias algo en `ui/`, vuelve a generarlas para que las capturas no queden desactualizadas.

## Data security (opcional)

Respuestas sugeridas para el formulario de seguridad:

- **¿Envía datos fuera de Figma?** No. `networkAccess` es `none` y la interfaz no carga recursos externos.
- **¿Qué datos del archivo usa?** La selección actual, los conectores de la página, sus extremos y las interacciones de prototipo de los elementos que conectas.
- **¿Guarda datos?** Sí, solo dentro de Figma:
  - en cada conector, los ids de sus extremos (`sharedPluginData`), para avisar cuando se suelta;
  - en `clientStorage`, el estilo predeterminado y los estilos guardados;
  - en la página, el botón de reabrir el plugin (`setRelaunchData`).
- **¿Modifica el archivo?** Sí, cuando el usuario lo pide: crea, edita y borra conectores, y con **Create prototype interaction** agrega una interacción On click → Navigate al elemento de origen. No mete nada dentro de los frames.
- **¿Requiere cuenta, pago o servicios de terceros?** No.

## Add the final details

- **Support contact:** un repositorio público con issues o el correo que prefieras.
- **Network access:** aparecerá como *No access*, porque `manifest.json` declara `allowedDomains: ["none"]`.
- **Comments:** a tu elección.

## Prueba manual

Hazla en Figma desktop: compila con `npm run build` e importa el plugin desde *Plugins → Development → Import plugin from manifest…*.

- [ ] Abre el plugin en tema claro y en tema oscuro: se ve bien y sin colores raros.
- [ ] Clic en una pantalla, Shift+clic en otra, **Copy connector** y ⌘V: aparece un conector pegado a las dos, en la página y no dentro de un frame. Cambia la selección y vuelve a pulsar ⌘V: sale otro.
- [ ] Mueve y redimensiona una de las pantallas: el conector la sigue. Cierra el plugin, vuelve a moverla: sigue unido.
- [ ] Con ⌘/Ctrl+clic, conecta un botón anidado dentro de una pantalla.
- [ ] Selecciona tres o más elementos: **One after another** y **All from the first** crean los conectores que muestra la lista; el botón de invertir cambia la dirección.
- [ ] Selecciona un conector y cambia color, grosor, etiqueta, línea, trazado y puntas. Con varios seleccionados, el cambio se aplica a todos.
- [ ] Guarda un estilo con **Save this style** (en **My styles**), ábrelo en otro archivo y aplícalo.
- [ ] Con un conector seleccionado, **⋯ → Create prototype interaction** agrega On click → Navigate real en el origen.
- [ ] Borra una pantalla conectada: el panel avisa del conector suelto, **Show** lo selecciona y **Delete** lo borra.
- [ ] Pega con el plugin cerrado: queda un conector libre de FigJam, sin errores.
- [ ] En Windows, los textos muestran Ctrl+V en vez de ⌘V.
- [ ] Deshacer (Cmd/Ctrl+Z) revierte la última acción.
- [ ] Todo se puede usar con el teclado (Tab, Enter, Espacio).
