import { SlackClient } from '../lib/slack-client.js';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Get Slack token
  let token = null;
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else {
    token = process.env.SLACK_TOKEN;
  }

  if (!token) {
    return res.status(401).json({ 
      error: 'Missing Slack token. Provide via Authorization header or SLACK_TOKEN env var.' 
    });
  }

  const slackClient = new SlackClient(token);

  try {
    // Handle MCP protocol
    if (req.method === 'POST') {
      const { method, params } = req.body;

      switch (method) {
        case 'initialize':
          return res.json({
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            serverInfo: {
              name: 'slack-mcp-server',
              version: '1.0.0'
            }
          });

        case 'tools/list':
          return res.json({
            tools: [
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
            ]
          });

        case 'tools/call':
          return await handleToolCall(slackClient, params, res);

        default:
          return res.status(400).json({ error: `Unknown method: ${method}` });
      }
    }

    // Server info endpoint
    if (req.method === 'GET') {
      return res.json({
        name: 'Slack MCP Server',
        description: 'MCP server for Slack integration with Claude',
        version: '1.0.0',
        capabilities: ['search', 'channels', 'messages', 'users']
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ 
      error: 'Server error',
      message: error.message 
    });
  }
}

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

async function searchMessages(slackClient, args, res) {
  const { query, limit = 20 } = args;

  try {
    // Try search.messages API first
    const searchData = await slackClient.makeRequest('search.messages', {
      query,
      count: limit
    });

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
      // Fallback to manual search
      return await fallbackSearch(slackClient, query, limit, res);
    }
    throw error;
  }
}

async function fallbackSearch(slackClient, query, limit, res) {
  // Get channels and search manually
  const channelsData = await slackClient.makeRequest('conversations.list', {
    types: 'public_channel,private_channel',
    limit: 50
  });

  const searchTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 2);
  let allResults = [];

  for (const channel of channelsData.channels.slice(0, 10)) {
    if (!channel.is_member) continue;
    
    try {
      const history = await slackClient.makeRequest('conversations.history', {
        channel: channel.id,
        limit: 50
      });

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

  const data = await slackClient.makeRequest('conversations.list', {
    types,
    limit
  });

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

  const data = await slackClient.makeRequest('conversations.history', {
    channel,
    limit
  });

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

  const data = await slackClient.makeRequest('chat.postMessage', {
    channel,
    text
  }, 'POST');

  return res.json({
    content: [{
      type: 'text',
      text: `Message sent successfully to ${channel}`
    }]
  });
}

async function getUsers(slackClient, args, res) {
  const { limit = 100 } = args;

  const data = await slackClient.makeRequest('users.list', {
    limit
  });

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
