#!/usr/bin/env node

// Simple Echo MCP Server for testing
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

// Send server info on startup
const serverInfo = {
  jsonrpc: "2.0",
  method: "server_info",
  params: {
    name: "echo-server",
    version: "1.0.0",
    capabilities: {
      tools: ["echo", "list_processes"]
    }
  }
};
console.log(JSON.stringify(serverInfo));

rl.on('line', (line) => {
  try {
    const request = JSON.parse(line);
    
    if (request.method === 'tools/list') {
      const response = {
        jsonrpc: "2.0",
        id: request.id,
        result: {
          tools: [
            {
              name: "echo",
              description: "Echo back the input",
              inputSchema: {
                type: "object",
                properties: {
                  message: { type: "string" }
                },
                required: ["message"]
              }
            },
            {
              name: "list_processes",
              description: "List running processes",
              inputSchema: {
                type: "object",
                properties: {}
              }
            }
          ]
        }
      };
      console.log(JSON.stringify(response));
    } else if (request.method === 'tools/call') {
      if (request.params.name === 'echo') {
        const response = {
          jsonrpc: "2.0",
          id: request.id,
          result: {
            content: [
              {
                type: "text",
                text: `Echo: ${request.params.arguments.message}`
              }
            ]
          }
        };
        console.log(JSON.stringify(response));
      } else if (request.params.name === 'list_processes') {
        // Simple process list
        const { exec } = require('child_process');
        exec('ps aux | head -5', (error, stdout, stderr) => {
          const response = {
            jsonrpc: "2.0",
            id: request.id,
            result: {
              content: [
                {
                  type: "text",
                  text: stdout || "Error getting processes"
                }
              ]
            }
          };
          console.log(JSON.stringify(response));
        });
      }
    }
  } catch (e) {
    // Ignore parse errors
  }
});
