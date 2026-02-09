import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { getAllTools } from './tools/index.js';
import { Context } from './context.js';
import { zodToJsonSchema } from './utils/schema.js';
import { logger } from './utils/logger.js';

export async function createServer() {
  const server = new Server(
    {
      name: 'electron-mcp-server',
      version: '1.0.0'
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  const context = new Context();
  const tools = getAllTools();

  logger.info(`Electron MCP server initialized with ${tools.length} tools`);

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: zodToJsonSchema(t.inputSchema)
    }))
  }));

  // Execute tool
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const tool = tools.find(t => t.name === name);

    if (!tool) {
      return {
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        isError: true
      };
    }

    logger.debug(`Executing tool: ${name}`, args);

    try {
      const result = await tool.execute(context, args || {});

      // Capture snapshot if requested
      if (result.captureSnapshot) {
        await context.captureSnapshot();
        const snapshotText = context.formatSnapshotAsText();
        result.content = `${result.content}\n\n${snapshotText}`;
      }

      const content: Array<{ type: string; text?: string; data?: string; mimeType?: string }> = [
        { type: 'text', text: result.content }
      ];

      // Add image if present
      if (result.base64Image) {
        content.push({
          type: 'image',
          data: result.base64Image,
          mimeType: 'image/png'
        });
      }

      return {
        content,
        isError: result.isError
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`Tool ${name} failed:`, message);
      return {
        content: [{ type: 'text', text: `Error: ${message}` }],
        isError: true
      };
    }
  });

  // Cleanup on exit
  process.on('SIGINT', async () => {
    logger.info('Received SIGINT, cleaning up...');
    await context.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, cleaning up...');
    await context.close();
    process.exit(0);
  });

  return server;
}

export async function runServer() {
  const server = await createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('Electron MCP server running');
}
