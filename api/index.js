// api/index.js - Simplified with direct Slack token authentication
import { kv } from '@vercel/kv';

// Simplified SlackClient
class SlackClient {
  constructor(token) {
    this.token = token;
    this.baseUrl = 'https://slack.com/api';
  }

  async makeRequest(endpoint, params = {}, method = 'GET') {
    const url = new URL(`${this.baseUrl}/${endpoint}`);
    const options = {
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': method === 'GET' ? 'application/json' : 'application/x-www-form-urlencoded',
      }
    };

    if (method === 'GET') {
      Object.keys(params).forEach(key => {
        if (params[key] !== undefined) {
          url.searchParams.append(key, params[key]);
        }
      });
    } else {
      options.method = method;
      const formData = new URLSearchParams();
      Object.keys(params).forEach(key => {
        if (params[key] !== undefined) {
          formData.append(key, params[key]);
        }
      });
      options.body = formData.toString();
    }

    const response = await fetch(url.toString(), options);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.ok) {
      throw new Error(`Slack API error: ${data.error}`);
    }

    return data;
  }

  async testAuth() {
    return await this.makeRequest('auth.test');
  }

  async searchMessages(query, count = 20) {
    return await this.makeRequest('search.messages', { query, count });
  }

  async getChannels(types = 'public_channel', limit = 100) {
    return await this.makeRequest('conversations.list', { types, limit });
  }

  async getChannelHistory(channel, limit = 50) {
    return await this.makeRequest('conversations.history', { channel, limit });
  }

  async sendMessage(channel, text, options = {}) {
    return await this.makeRequest('chat.postMessage', {
      channel,
      text,
      ...options
    }, 'POST');
  }

  async getUsers(limit = 100) {
    return await this.makeRequest('users.list', { limit });
  }
}

// Simple UserAuth
class UserAuth {
  static async getUserByToken(slackToken) {
    if (!slackToken || !slackToken.startsWith('xoxp-')) {
      return null;
    }

    try {
      const userId = await kv.get(`token:${slackToken}`);
      if (!userId) {
        return null;
      }
      
      const userData = await kv.get(`user:${userId}`);
      if (!userData || !userData.active) {
        return null;
      }
      
      // Update usage stats
      userData.lastUsed = new Date().toISOString();
      userData.usage.totalRequests = (userData.usage.totalRequests || 0) + 1;
      userData.usage.lastRequest = new Date().toISOString();
      
      // Update in background
      kv.set(`user:${userId}`, userData).catch(console.error);
      
      return userData;
    } catch (error) {
      console.error('Error getting user by token:', error);
      return null;
    }
  }
}

export default async function handler(req, res) {
  // CORS headers for Claude web
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const path = req.url || '/';

  try {
    // Server capabilities endpoint for Claude web
    if (req.method === 'GET' && path === '/') {
      return res.json({
        name: "Slack MCP Server",
        version: "1.0.0",
        description: "Connect your Slack workspace to Claude",
        capabilities: {
          tools: true
        },
        instructions: {
          setup: "Get registered at /connect",
          authentication: "Use your Slack token in the Authorization header as 'Bearer xoxp-your-token'"
        },
        endpoints: {
          connect: "Visit /connect to register your Slack token",
          register: "POST /register with your Slack token"
        }
      });
    }

    // Skip auth for registration endpoint
    if (req.method === 'POST' && path === '/register') {
      // This will be handled by the separate register.js file
      return res.status(404).json({ error: 'Use /register endpoint' });
    }

    // Authentication for MCP calls
    const slackToken = await authenticateRequest(req);
    if (!slackToken) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'Register at /connect and use your Slack token as: Authorization: Bearer xoxp-your-token'
      });
    }

    // Get user data (optional - for stats/tracking)
    const userData = await UserAuth.getUserByToken(slackToken);
    
    const slackClient = new SlackClient(slackToken);

    // Handle MCP protocol
    if (req.method === 'POST') {
      const { method, params } = req.body || {};

      switch (method) {
        case 'initialize':
          return res.json({
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            serverInfo: {
              name: 'slack-mcp-server',
              version: '1.0.0',
              user: userData?.id || 'anonymous'
            }
          });

        case 'tools/list':
          return res.json({ tools: getAvailableTools() });

        case 'tools/call':
          return await handleToolCall(slackClient, params, res);

        default:
          return res.status(400).json({ error: `Unknown method: ${method}` });
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ 
      error: 'Server error',
      message: error.message 
    });
  }
}

// Authentication function - now looks for Slack token directly
async function authenticateRequest(req) {
  const authHeader = req.headers.authorization;
  let slackToken = null;
  
  if (authHeader) {
    if (authHeader.startsWith('Bearer xoxp-')) {
      slackToken = authHeader.substring(7); // Remove 'Bearer '
    } else if (authHeader.startsWith('xoxp-')) {
      slackToken = authHeader;
    }
  }
  
  // Also check X-Slack-Token header as fallback
  if (!slackToken) {
    slackToken = req.headers['x-slack-token'];
  }
  
  if (!slackToken || !slackToken.startsWith('xoxp-')) {
    return null;
  }
  
  // Validate token by testing it
  try {
    const slackClient = new SlackClient(slackToken);
    await slackClient.testAuth();
    return slackToken;
  } catch (error) {
    console.error('Token validation error:', error);
    return null;
  }
}

// Tool definitions
function getAvailableTools() {
  return [
    {
      name: 'slack_search_messages',
      description: 'Search for messages across Slack channels',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          limit: { type: 'number', description: 'Number of results (default: 20)', default: 20 }
        },
        required: ['query']
      }
    },
    {
      name: 'slack_get_channels',
      description: 'List available channels',
      inputSchema: {
        type: 'object',
        properties: {
          types: { type: 'string', description: 'Channel types (default: public_channel)', default: 'public_channel' },
          limit: { type: 'number', description: 'Number of channels (default: 100)', default: 100 }
        }
      }
    },
    {
      name: 'slack_get_channel_history',
      description: 'Get recent messages from a specific channel',
      inputSchema: {
        type: 'object',
        properties: {
          channel: { type: 'string', description: 'Channel ID or name' },
          limit: { type: 'number', description: 'Number of messages (default: 50)', default: 50 }
        },
        required: ['channel']
      }
    },
    {
      name: 'slack_send_message',
      description: 'Send a message to a channel',
      inputSchema: {
        type: 'object',
        properties: {
          channel: { type: 'string', description: 'Channel ID or name' },
          text: { type: 'string', description: 'Message text' }
        },
        required: ['channel', 'text']
      }
    },
    {
      name: 'slack_get_users',
      description: 'List workspace users',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Number of users (default: 100)', default: 100 }
        }
      }
    }
  ];
}

// Tool call handler
async function handleToolCall(slackClient, params, res) {
  const { name, arguments: args } = params;

  try {
    switch (name) {
      case 'slack_search_messages':
        return await searchMessages(slackClient, args, res);
      case 'slack_get_channels':
        return await getChannels(slackClient, args, res);
      case 'slack_get_channel_history':
        return await getChannelHistory(slackClient, args, res);
      case 'slack_send_message':
        return await sendMessage(slackClient, args, res);
      case 'slack_get_users':
        return await getUsers(slackClient, args, res);
      default:
        return res.status(400).json({ error: `Unknown tool: ${name}` });
    }
  } catch (error) {
    return res.json({
      content: [{
        type: 'text',
        text: `Error: ${error.message}`
      }],
      isError: true
    });
  }
}

// Tool implementations
async function searchMessages(slackClient, args, res) {
  const { query, limit = 20 } = args;

  try {
    const searchData = await slackClient.searchMessages(query, limit);
    const results = searchData.messages.matches.map(match => ({
      channel: match.channel.name,
      user: match.username,
      text: match.text,
      timestamp: match.ts,
      permalink: match.permalink
    }));

    return res.json({
      content: [{
        type: 'text',
        text: `Found ${results.length} messages:\n\n` + 
              results.map(msg => 
                `**#${msg.channel}** (${msg.user}): ${msg.text.substring(0, 200)}${msg.text.length > 200 ? '...' : ''}`
              ).join('\n\n')
      }]
    });

  } catch (error) {
    if (error.message.includes('not_allowed_token_type')) {
      return await fallbackSearch(slackClient, query, limit, res);
    }
    throw error;
  }
}

async function fallbackSearch(slackClient, query, limit, res) {
  const channelsData = await slackClient.getChannels('public_channel,private_channel', 50);
  const searchTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 2);
  let allResults = [];

  for (const channel of channelsData.channels.slice(0, 10)) {
    if (!channel.is_member) continue;
    
    try {
      const history = await slackClient.getChannelHistory(channel.id, 50);
      const matchingMessages = history.messages
        .filter(msg => {
          const text = (msg.text || '').toLowerCase();
          return searchTerms.some(term => text.includes(term));
        })
        .map(msg => ({
          channel: channel.name,
          text: msg.text || 'No text',
          timestamp: msg.ts
        }));

      allResults.push(...matchingMessages);
      if (allResults.length >= limit) break;
    } catch (e) {
      continue;
    }
  }

  const results = allResults.slice(0, limit);
  return res.json({
    content: [{
      type: 'text',
      text: `Found ${results.length} messages (fallback search):\n\n` + 
            results.map(msg => 
              `**#${msg.channel}**: ${msg.text.substring(0, 200)}${msg.text.length > 200 ? '...' : ''}`
            ).join('\n\n')
    }]
  });
}

async function getChannels(slackClient, args, res) {
  const { types = 'public_channel', limit = 100 } = args;
  const data = await slackClient.getChannels(types, limit);

  const channels = data.channels.map(channel => ({
    id: channel.id,
    name: channel.name,
    is_private: channel.is_private,
    topic: channel.topic?.value || 'No topic',
    members: channel.num_members
  }));

  return res.json({
    content: [{
      type: 'text',
      text: `Found ${channels.length} channels:\n\n` + 
            channels.map(ch => 
              `**#${ch.name}** (${ch.members} members): ${ch.topic}`
            ).join('\n')
    }]
  });
}

async function getChannelHistory(slackClient, args, res) {
  const { channel, limit = 50 } = args;
  const data = await slackClient.getChannelHistory(channel, limit);

  const messages = data.messages.map(msg => ({
    user: msg.user,
    text: msg.text || 'No text',
    timestamp: new Date(parseFloat(msg.ts) * 1000).toLocaleString()
  }));

  return res.json({
    content: [{
      type: 'text',
      text: `Recent messages in channel:\n\n` + 
            messages.map(msg => 
              `**${msg.timestamp}**: ${msg.text.substring(0, 300)}${msg.text.length > 300 ? '...' : ''}`
            ).join('\n\n')
    }]
  });
}

async function sendMessage(slackClient, args, res) {
  const { channel, text } = args;
  await slackClient.sendMessage(channel, text);

  return res.json({
    content: [{
      type: 'text',
      text: `Message sent successfully to ${channel}`
    }]
  });
}

async function getUsers(slackClient, args, res) {
  const { limit = 100 } = args;
  const data = await slackClient.getUsers(limit);

  const users = data.members
    .filter(user => !user.deleted && !user.is_bot)
    .map(user => ({
      id: user.id,
      name: user.name,
      real_name: user.real_name,
      email: user.profile?.email
    }));

  return res.json({
    content: [{
      type: 'text',
      text: `Found ${users.length} users:\n\n` + 
            users.slice(0, 20).map(user => 
              `**${user.real_name || user.name}** (@${user.name})${user.email ? ` - ${user.email}` : ''}`
            ).join('\n')
    }]
  });
}
