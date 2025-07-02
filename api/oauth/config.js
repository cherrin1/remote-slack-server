// api/oauth/config.js
// OAuth configuration endpoint for Claude MCP integration

export default function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const baseUrl = `https://${req.headers.host}`;
  
  // OAuth configuration for Claude
  const config = {
    authorization_endpoint: `${baseUrl}/oauth/authorize`,
    token_endpoint: `${baseUrl}/oauth/token`,
    client_id: "slack-mcp-server",
    scopes: ["slack:read", "slack:write"],
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    token_endpoint_auth_methods_supported: ["client_secret_post", "none"],
    server_info: {
      name: "Slack MCP Server",
      version: "1.0.0",
      description: "Multi-user Slack integration for Claude"
    }
  };

  res.status(200).json(config);
}
