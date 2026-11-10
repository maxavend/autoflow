# Third-party notices

The plugin UI (`dist/ui.html`, built from `ui/`) bundles the software below. The plugin code
(`dist/code.js`, built from `src/`) bundles no third-party code. The header of `dist/ui.html`
lists the exact npm package versions in each build.

## FigUI

Figma UI3 components for React by XIN — https://figui.dev, https://github.com/anxndsgn/figui.
Copied unchanged into `ui/components/ui/` (see its `ORIGEN.md`), with `ui/lib/utils.ts` and the
design tokens in `ui/styles/figui.css`.

```
MIT License

Copyright (c) 2026 XIN

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## UI3 icons

Official Figma UI3 icons from `@create-figma-plugin/ui`, rendered to SVG in `ui/icons.js`
(`npm run icons`). MIT License (text above), Copyright (c) Yuan Qing Lim.

## npm packages in the UI bundle

| Package | License | Copyright |
| --- | --- | --- |
| react, react-dom, scheduler, use-sync-external-store | MIT | Meta Platforms, Inc. and affiliates |
| @base-ui/react, @base-ui/utils | MIT | 2019 Material-UI SAS |
| @floating-ui/core, @floating-ui/dom, @floating-ui/react-dom, @floating-ui/utils | MIT | 2021-present Floating UI contributors |
| reselect | MIT | 2015-2018 Reselect Contributors |
| tailwind-merge | MIT | 2021 Dany Castillo |
| clsx | MIT | Luke Edwards |
| tailwindcss (generated CSS) | MIT | Tailwind Labs, Inc. |
| class-variance-authority | Apache-2.0 | Joe Bell |
| lucide-react | ISC (some icons MIT, from Feather) | 2026 Lucide Icons and Contributors; 2013-present Cole Bemis |
| chroma-js | BSD-3-Clause (ColorBrewer colors: Apache-2.0) | 2011-2025 Gregor Aisch; 2002 Cynthia Brewer, Mark Harrower and The Pennsylvania State University |

The MIT packages are distributed under the MIT License text above, with their own copyright line.

### ISC License (lucide-react)

```
Copyright (c) 2026 Lucide Icons and Contributors

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
```

The Lucide icons derived from Feather (the panel uses check, chevron and loader icons) are
under the MIT License text above, Copyright (c) 2013-present Cole Bemis.

### BSD 3-Clause License (chroma-js)

```
Copyright (c) 2011-2025, Gregor Aisch
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

3. The name Gregor Aisch may not be used to endorse or promote products
   derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL GREGOR AISCH OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT,
INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY
OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

### Apache License 2.0 (class-variance-authority; ColorBrewer colors in chroma-js)

Licensed under the Apache License, Version 2.0: https://www.apache.org/licenses/LICENSE-2.0.
Distributed on an "AS IS" basis, without warranties or conditions of any kind. The full text ships
with each package (`node_modules/class-variance-authority/LICENSE`, `node_modules/chroma-js/LICENSE`).
