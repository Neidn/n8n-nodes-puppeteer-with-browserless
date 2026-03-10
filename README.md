# n8n-nodes-puppeteer-with-browserless

An [n8n](https://n8n.io) community node for controlling Puppeteer via a self-hosted [Browserless](https://browserless.io) instance. Run browser automation scripts without managing a local Chromium binary — everything executes on your Browserless server.

## Features

- **Run Script** — Connect to Browserless and execute arbitrary Puppeteer JavaScript
- **Create Session** — Create a persistent Browserless session and get its WebSocket endpoint for reuse across multiple nodes
- **Session reuse** — Pass a `browserWSEndpoint` from one node to the next to keep the same browser tab open across workflow steps
- **URL normalization** — Credential URL accepts `http://`, `https://`, `ws://`, or `wss://` — always converted to the correct WebSocket scheme with an explicit port
- **Token support** — API token is automatically appended to all connections and session endpoints

## Prerequisites

- A running [Browserless](https://github.com/browserless/browserless) instance (self-hosted or cloud)
- n8n (self-hosted)

## Installation

In your n8n instance, go to **Settings → Community Nodes** and install:

```
n8n-nodes-puppeteer-with-browserless
```

Or install manually into your n8n node modules directory:

```bash
npm install n8n-nodes-puppeteer-with-browserless
```

## Credentials

Add a **Browserless API** credential with:

| Field | Description |
|---|---|
| Browserless URL | Base URL of your Browserless instance. Accepts `http://`, `https://`, `ws://`, or `wss://`. Port defaults to `443` for secure URLs and `80` for plain. Example: `https://my-browserless.example.com` |
| API Token | Your Browserless API token (optional if no auth is configured) |

## Operations

### Create Session

Creates a new persistent Browserless browser session and returns its connection details.

**Output:**

| Field | Description |
|---|---|
| `browserWSEndpoint` | WebSocket URL to reconnect to this session (includes `?token=`) |
| `browserId` | Unique ID of the browser session |

Use this as the first node in a multi-step workflow. Pass `{{ $json.browserWSEndpoint }}` into subsequent **Run Script** nodes to reuse the same browser tab.

### Run Script

Connects to Browserless and runs a Puppeteer script. Two modes:

**Fresh connection** (no `sessionWsEndpoint`): Opens a new browser, runs the script, then disconnects. Session info (`browserWSEndpoint`, `browserId`) is included in the output so it can be chained if needed.

**Reuse existing session** (`sessionWsEndpoint` provided): Reconnects to an existing Browserless session, reuses the currently open page (preserving navigation, cookies, and DOM state), and leaves the page open after the script runs.

**Parameters:**

| Parameter | Description |
|---|---|
| Session WebSocket Endpoint | Optional. Pass `{{ $json.browserWSEndpoint }}` from a Create Session node to reuse an existing browser tab. |
| Script | JavaScript to execute. `page` (Puppeteer `Page`) and `browser` (Puppeteer `Browser`) are pre-injected — no imports needed. Use `return` to pass data to the next node. |
| Timeout (ms) | Navigation and selector wait timeout. Default: `30000` |
| Viewport Width | Browser viewport width. Default: `1280` |
| Viewport Height | Browser viewport height. Default: `720` |
| User Agent | Custom user agent string (optional) |

**Output:**

All fields returned by your script are merged with session info:

| Field | Description |
|---|---|
| _(your script fields)_ | Whatever your script returns via `return { ... }` |
| `browserWSEndpoint` | WebSocket endpoint of the browser session |
| `browserId` | Browser session ID (when a fresh connection is made) |

## Example Workflow

A typical multi-step scraping workflow:

1. **Create Session** — creates a persistent browser, outputs `browserWSEndpoint` and `browserId`
2. **Run Script** (with `sessionWsEndpoint = {{ $json.browserWSEndpoint }}`) — navigates to a page
3. **Run Script** (with `sessionWsEndpoint = {{ $json.browserWSEndpoint }}`) — interacts with the page (clicks, fills forms, extracts data) using the same tab

**Example script (Run Script node):**

```js
// page and browser are pre-injected — no imports needed.
await page.goto('https://example.com');
const title = await page.title();
const heading = await page.$eval('h1', el => el.textContent);
return { title, heading };
```

## Development

Clone the repo and install dependencies:

```bash
git clone https://github.com/Neidn/n8n-nodes-puppeteer-with-browserless.git
cd n8n-nodes-puppeteer-with-browserless
pnpm install
```

Start n8n with this node loaded and hot-reload enabled:

```bash
pnpm run dev
```

Build for production:

```bash
pnpm run build
```

Lint:

```bash
pnpm run lint
pnpm run lint:fix
```

## License

[MIT](LICENSE.md)