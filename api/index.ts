import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { SlackMCPServer } from '../lib/slack-mcp-server';

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// MCP endpoint info
app.get('/', (req, res) => {
  res.json({
    name: 'Slack MCP Server',
    version: '1.0.0',
    description: 'Remote MCP Server for Slack integration',
    transport: 'sse',
    endpoints: {
      sse: '/sse'
    }
  });
});

// Server-Sent Events endpoint for MCP
app.get('/sse', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Authorization token required' });
  }

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  try {
    const server = new SlackMCPServer(token);
    await server.initialize();

    // Handle MCP protocol over SSE
    server.onMessage = (message) => {
      res.write(`data: ${JSON.stringify(message)}\n\n`);
    };

    // Handle client messages via POST to /message
    req.on('close', () => {
      server.cleanup();
    });

    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: 'connection', status: 'connected' })}\n\n`);

  } catch (error) {
    res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
    res.end();
  }
});

// Handle MCP messages via POST
app.post('/message', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Authorization token required' });
  }

  try {
    const server = new SlackMCPServer(token);
    await server.initialize();
    
    const response = await server.handleMessage(req.body);
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const server = app.listen(port, () => {
  console.log(`Slack MCP Server running on port ${port}`);
});

export default app;
