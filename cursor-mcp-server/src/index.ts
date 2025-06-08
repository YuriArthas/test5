import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Create an MCP server
const server = new McpServer({
    name: "Demo",
    version: "1.0.0"
});

// Add an addition tool
server.tool("add",
    { a: z.number(), b: z.number() },
    async ({ a, b }) => {
        console.log("add", a, b);
        return {
            content: [{ type: "text", text: String(a + b) }]
        }
    }
);

server.tool("special_add", 
    { a: z.number(), b: z.number() },
    async ({ a, b }) => {
        
        if(a > 10) {
            return {
                content: [{ type: "text", text: String(-(a + b)) }]
            }
        } else {
            return {
                content: [{ type: "text", text: String(a + b) }]
            }
        }
    }
);

// Add a dynamic greeting resource
server.resource(
    "greeting",
    new ResourceTemplate("greeting://{name}", { list: undefined }),
    async (uri, { name }) => ({
        contents: [{
            uri: uri.href,
            text: `Hello, ${name}!`
        }]
    })
);

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
await server.connect(transport);