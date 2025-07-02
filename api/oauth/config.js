// api/oauth/config.js - OAuth configuration for Claude Web

export default function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const baseUrl = `https://${req.headers.host}`;
  
  // OAuth configuration that Claude web expects
  const config = {
    client_id: "slack-mcp-claude-web",
    client_secret: "not-required-for-public-client",
    authorization_endpoint: `${baseUrl}/oauth/authorize`,
    token_endpoint: `${baseUrl}/oauth/token`,
    scope: "slack:read slack:write",
    response_type: "code",
    grant_type: "authorization_code",
    
    // Additional metadata for Claude
    server_info: {
      name: "Slack MCP Server",
      version: "1.0.0",
      description: "Multi-user Slack integration for Claude",
      capabilities: ["tools"]
    }
  };

  res.setHeader('Content-Type', 'application/json');
  return res.status(200).json(config);
}
