# dsh-mermaid-image-preview

[![Awesome DSH Plugin](https://awesome-dsh-plugin.com/badge.svg)](https://awesome-dsh-plugin.com)
[![DSH Plugin Profile Badge](https://img.shields.io/badge/DSH-Web%20profile-5B4CF0?style=flat-square)](https://github.com/deepseek-ai/deepseek-harness)
[![Release Badge](https://img.shields.io/github/v/release/baconbao/dsh-mermaid-image-preview)](https://github.com/baconbao/dsh-mermaid-image-preview/releases)
[![License Badge](https://img.shields.io/github/license/baconbao/dsh-mermaid-image-preview)](./LICENSE)

A DeepSeek Harness Plugin for Previewing Mermaid Diagram Images

Preview mermaid syntax as images via local rendering in DSH Web when the chat message contains a mermaid fenced code block (` ```mermaid or ```mmd ` ).

![dsh-mermaid-image-preview](https://raw.githubusercontent.com/baconbao/dsh-mermaid-image-preview/928d6f4cc1486295924925683d873a7beba38cad/docs/img/dsh-mermaid-image-preview.png)

## Features and how it works

- **Preview mermaid diagrams by rendering images directly!**
- **Local renderer first!** If it fails, it can fall back to an external or self-hosted rendering engine by configuring a fallback server.
- Setting tab: you can adjust runtime settings in the UI - no restart needed.
- Mount point: `conversation.chat.turnTail` (list slot, additive - never
  shadows shipped UI).
- Thumbnail display: the diagram renders as a thumbnail; click to enlarge in place, click again to shrink back (same element toggles, no popup).
- Light/dark themes follow the UI automatically.

## Support diagram types

The plugin renders diagrams locally with a built-in renderer. It supports
14 diagram types out of the box.

**Rendered locally:** flowchart, sequenceDiagram, classDiagram, stateDiagram, erDiagram, pie, journey, gitGraph, requirementDiagram, timeline, quadrantChart, packet-beta, xychart-beta

**Expand:** gantt, mindmap, block-beta, sankey-beta, architecture-beta, zenuml, C4Context

> [!NOTE]
> You can enable the fallback to render expanded types — see **Configuration** below.

## Installation

### Installation from `github`

```bash
### latest release version
$ npx @deepseek-ai/dsh plugin --profile web add github:baconbao/dsh-mermaid-image-preview#latest

### specific version
$ npx @deepseek-ai/dsh plugin --profile web add github:baconbao/dsh-mermaid-image-preview#<VERSION_TAG|GIT_TAG>

### dev version
$ npx @deepseek-ai/dsh plugin --profile web add github:baconbao/dsh-mermaid-image-preview#dev
```

### Installation from source code

```bash
$ git clone https://github.com/baconbao/dsh-mermaid-image-preview
$ cd dsh-mermaid-image-preview
$ pnpm install
$ dsh plugin --profile web add .
```

> [!IMPORTANT]
> Restart dsh web after installing.

> [!NOTE]
> **Runtime compatibility:** this release targets DSH **0.1.6-alpha.2 and later**; the peer range
> declares exactly that floor and no upper bound, so it installs on every newer runtime.
> Upstream made `conversation.chat.turnTail` a `list` slot and replaced the `settings.plugin.item`
> card seat with `settings.plugins.tab`, which is what this release registers into; older runtimes
> (for example `0.1.5-rc.3`, which still declares a `chain` seat) need an older plugin release.

## Configuration

### Change runtime settings on setting card

![dsh-mermaid-image-preview_setting-card](https://raw.githubusercontent.com/baconbao/dsh-mermaid-image-preview/928d6f4cc1486295924925683d873a7beba38cad/docs/img/dsh-mermaid-image-preview_setting-card.png)

The **Plugins** settings page (**Settings > Plugins**) shows a `Mermaid image preview` tab where
you can adjust plugin's runtime settings directly - no restart needed.
Values are stored in localStorage and applied immediately across all sessions.

### Change render server by profile patch

Diagrams are rendered locally by default. To use your own render server or
enable the external fallback, edit the profile's `cordis.patch.yml` (e.g.
`~/.dsh/profiles/web/cordis.patch.yml`):

```yaml
- id: ui-dsh-mermaid-image-preview
  config:
    enableLocalRender: true
    fallbackRenderUrl: https://mermaid.ink
    enableFallback: false
```

- `enableLocalRender`: render locally (default `true`). Set `false` to always use the fallback server (`enableFallback` is ignored).
- `fallbackRenderUrl`: fallback render server (default `https://mermaid.ink`).
- `enableFallback`: use the fallback server when local rendering fails (default `false`).
- Restart dsh web after changing these settings.
- To host your own fallback render server, see <https://github.com/jihchi/mermaid.ink> for the details.

## Uninstallation

```bash
$ dsh plugin --profile web remove @baconbao/dsh-mermaid-image-preview
```

> [!NOTE]
> Since **v0.2.0** the plugin/package id is changed from `dsh-mermaid-image-preview` to `@baconbao/dsh-mermaid-image-preview`.

## Test

Ask the agent to produce:

````
```mermaid
graph TD
  A[Start] --> B{Success?}
  B -->|Yes| C[Done]
  B -->|No| D[Retry]
```
````

---

## Author

baconbao, vibe coding with deepseek ai

## License

[MIT](./LICENSE)
