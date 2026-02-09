# Electron MCP Server

An MCP (Model Context Protocol) server for testing Electron desktop applications using WebdriverIO. This server enables AI agents to interact with, test, and automate Electron apps.

## Features

- **App Lifecycle Management**: Launch and close Electron applications
- **Element Discovery**: Capture UI snapshots with element references for interactions
- **Element Interactions**: Click, type, and interact with UI elements
- **Screenshots**: Capture visual state of the application
- **Action Recording**: Record interactions for test generation
- **Test Generation**: Generate WebdriverIO or Playwright test code
- **CDP Integration**: Network monitoring, console capture, performance metrics, JS evaluation

## Installation

```bash
cd electron-mcp-server
npm install
npm run build
```

## Usage

### As an MCP Server

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "electron": {
      "command": "node",
      "args": ["/path/to/electron-mcp-server/dist/bin/cli.js"]
    }
  }
}
```

### Programmatic Usage

```typescript
import { createServer, runServer } from 'electron-mcp-server';

// Run as stdio server
await runServer();

// Or create server instance
const server = await createServer();
```

## Available Tools

### App Lifecycle (2)

| Tool | Description |
|------|-------------|
| `electron_launch` | Launch an Electron app with WebdriverIO |
| `electron_close` | Close the Electron app session |

### Element Interactions (3)

| Tool | Description |
|------|-------------|
| `electron_snapshot` | Discover UI elements with references |
| `electron_click` | Click element by reference |
| `electron_type` | Type text into element |

### Page (1)

| Tool | Description |
|------|-------------|
| `electron_screenshot` | Take a screenshot |

### Recording (3)

| Tool | Description |
|------|-------------|
| `electron_start_recording` | Start action recording |
| `electron_stop_recording` | Stop recording |
| `electron_recording_status` | Get recording status |

### Generator (1)

| Tool | Description |
|------|-------------|
| `electron_generate_test` | Generate test code (WebdriverIO/Playwright) |

### CDP Tools (4)

| Tool | Description |
|------|-------------|
| `electron_cdp_network` | Network interception/mocking |
| `electron_cdp_console` | Console log capture |
| `electron_cdp_performance` | Performance metrics |
| `electron_cdp_evaluate` | Execute JS in app context |

## Example Workflow

```
1. electron_launch(binaryPath: "/path/to/your-electron-app")
2. electron_snapshot() -> Returns element list with refs (e1, e2, e3...)
3. electron_click(ref: "e1") -> Click first element
4. electron_type(ref: "e2", text: "Hello") -> Type into input
5. electron_screenshot() -> Capture current state
6. electron_close()
```

## Recording and Test Generation

```
1. electron_launch(binaryPath: "/path/to/app")
2. electron_start_recording()
3. electron_snapshot()
4. electron_click(ref: "e1")
5. electron_type(ref: "e2", text: "test")
6. electron_stop_recording()
7. electron_generate_test(format: "webdriverio_ts", testName: "my_test")
```

### Supported Test Formats

- `webdriverio_js` - WebdriverIO JavaScript
- `webdriverio_ts` - WebdriverIO TypeScript
- `playwright_js` - Playwright JavaScript
- `playwright_ts` - Playwright TypeScript

## CDP Tools Usage

### Network Monitoring

```
electron_cdp_network(action: "get")                    // Get captured requests
electron_cdp_network(action: "clear")                  // Clear history
electron_cdp_network(action: "mock", mock: {...})      // Set up mock response
```

### Console Capture

```
electron_cdp_console(action: "start")                  // Start monitoring
electron_cdp_console(action: "get")                    // Get logs
electron_cdp_console(action: "get", level: "error")    // Get only errors
electron_cdp_console(action: "stop")                   // Stop and retrieve
```

### Performance Metrics

```
electron_cdp_performance(action: "get")                // General metrics
electron_cdp_performance(action: "timing")             // Navigation timing
electron_cdp_performance(action: "memory")             // Memory usage
```

### JavaScript Evaluation

```
electron_cdp_evaluate(script: "return document.title")
electron_cdp_evaluate(script: "localStorage.getItem('key')")
```

## Requirements

- Node.js >= 18.0.0
- Electron app built for testing
- ChromeDriver (handled by wdio-electron-service)

## Dependencies

- `@modelcontextprotocol/sdk` - MCP protocol implementation
- `webdriverio` - WebDriver client
- `wdio-electron-service` - Electron testing service
- `zod` - Schema validation

## License

MIT
