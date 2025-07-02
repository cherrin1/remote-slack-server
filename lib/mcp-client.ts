import { EventSource } from 'eventsource';

export class SlackMCPClient {
  private serverUrl: string;
  private token: string;
  private eventSource: EventSource | null = null;

  constructor(serverUrl: string, token: string) {
    this.serverUrl = serverUrl.replace(/\/$/, ''); // Remove trailing slash
    this.token = token;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.eventSource = new EventSource(`${this.serverUrl}/sse`, {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });

      this.eventSource.onopen = () => {
        console.log('Connected to Slack MCP Server');
        resolve();
      };

      this.eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        reject(error);
      };

      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('Error parsing SSE message:', error);
        }
      };
    });
  }

  private handleMessage(message: any) {
    if (message.type === 'connection' && message.status === 'connected') {
      console.log('MCP connection established');
    } else if (message.type === 'error') {
      console.error('Server error:', message.error);
    } else {
      console.log('Received message:', message);
    }
  }

  async sendMessage(method: string, params: any = {}): Promise<any> {
    const message = {
      jsonrpc: '2.0',
      id: Math.random().toString(36).substring(7),
      method,
      params
    };

    const response = await fetch(`${this.serverUrl}/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      },
      body: JSON.stringify(message)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  }

  async initialize(): Promise<any> {
    return this.sendMessage('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'slack-mcp-client',
        version: '1.0.0'
      }
    });
  }

  async listTools(): Promise<any> {
    return this.sendMessage('tools/list');
  }

  async callTool(name: string, args: any): Promise<any> {
    return this.sendMessage('tools/call', {
      name,
      arguments: args
    });
  }

  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }
}

// For Node.js environments (Claude Desktop)
if (typeof process !== 'undefined' && process.env) {
  const serverUrl = process.env.MCP_SERVER_URL;
  const token = process.env.SLACK_TOKEN;

  if (serverUrl && token) {
    const client = new SlackMCPClient(serverUrl, token);
    
    // Handle MCP protocol stdin/stdout for Claude Desktop
    process.stdin.on('data', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        let response;

        switch (message.method) {
          case 'initialize':
            response = await client.initialize();
            break;
          case 'tools/list':
            response = await client.listTools();
            break;
          case 'tools/call':
            response = await client.callTool(message.params.name, message.params.arguments);
            break;
          default:
            response = { error: `Unknown method: ${message.method}` };
        }

        process.stdout.write(JSON.stringify({
          jsonrpc: '2.0',
          id: message.id,
          result: response
        }) + '\n');
      } catch (error) {
        process.stdout.write(JSON.stringify({
          jsonrpc: '2.0',
          id: message.id || null,
          error: {
            code: -1,
            message: error.message
          }
        }) + '\n');
      }
    });

    // Connect on startup
    client.connect().catch(console.error);
  }
}

// Example usage for testing
export async function testConnection() {
  const serverUrl = 'https://your-app.vercel.app';
  const token = 'xoxp-your-token';
  
  const client = new SlackMCPClient(serverUrl, token);
  
  try {
    await client.connect();
    
    // Initialize
    const initResult = await client.initialize();
    console.log('Initialize result:', initResult);
    
    // List tools
    const tools = await client.listTools();
    console.log('Available tools:', tools);
    
    // Test a tool call
    const channels = await client.callTool('slack_get_users', { limit: 5 });
    console.log('Users:', channels);
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    client.disconnect();
  }
}
