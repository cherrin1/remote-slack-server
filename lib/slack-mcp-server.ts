import { WebApi } from '@slack/web-api';
import { 
  Server,
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
  TextContent,
  ImageContent
} from '@modelcontextprotocol/sdk/types.js';

export class SlackMCPServer {
  private slack: WebApi;
  private serverInfo = {
    name: 'slack-mcp-server',
    version: '1.0.0'
  };

  public onMessage?: (message: any) => void;

  constructor(private token: string) {
    this.slack = new WebApi(token);
  }

  async initialize() {
    // Test the token
    try {
      await this.slack.auth.test();
    } catch (error) {
      throw new Error(`Invalid Slack token: ${error.message}`);
    }
  }

  cleanup() {
    // Cleanup resources if needed
  }

  async handleMessage(message: any): Promise<any> {
    const { method, params } = message;

    switch (method) {
      case 'initialize':
        return {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {}
          },
          serverInfo: this.serverInfo
        };

      case 'tools/list':
        return { tools: this.getTools() };

      case 'tools/call':
        return await this.callTool(params);

      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }

  private getTools(): Tool[] {
    return [
      // Channel operations
      {
        name: 'slack_get_channel_history',
        description: 'Get message history from a public channel',
        inputSchema: {
          type: 'object',
          properties: {
            channel: { type: 'string', description: 'Channel ID or name' },
            limit: { type: 'number', description: 'Number of messages to retrieve (default: 100)', default: 100 }
          },
          required: ['channel']
        }
      },
      {
        name: 'slack_get_channel_info',
        description: 'Get basic information about a public channel',
        inputSchema: {
          type: 'object',
          properties: {
            channel: { type: 'string', description: 'Channel ID or name' }
          },
          required: ['channel']
        }
      },
      {
        name: 'slack_create_channel',
        description: 'Create a new public channel',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Channel name' },
            is_private: { type: 'boolean', description: 'Whether the channel is private', default: false }
          },
          required: ['name']
        }
      },
      {
        name: 'slack_send_message',
        description: 'Send a message to a channel or user',
        inputSchema: {
          type: 'object',
          properties: {
            channel: { type: 'string', description: 'Channel ID, channel name, or user ID' },
            text: { type: 'string', description: 'Message text' },
            thread_ts: { type: 'string', description: 'Timestamp of parent message to reply in thread' }
          },
          required: ['channel', 'text']
        }
      },
      
      // Private group operations
      {
        name: 'slack_get_private_channels',
        description: 'List user\'s private channels',
        inputSchema: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: 'Number of channels to retrieve', default: 100 }
          }
        }
      },
      {
        name: 'slack_create_private_channel',
        description: 'Create a new private channel',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Channel name' }
          },
          required: ['name']
        }
      },

      // Direct message operations
      {
        name: 'slack_get_dm_history',
        description: 'Get direct message history with a user',
        inputSchema: {
          type: 'object',
          properties: {
            user: { type: 'string', description: 'User ID' },
            limit: { type: 'number', description: 'Number of messages to retrieve', default: 100 }
          },
          required: ['user']
        }
      },
      {
        name: 'slack_send_dm',
        description: 'Send a direct message to a user',
        inputSchema: {
          type: 'object',
          properties: {
            user: { type: 'string', description: 'User ID' },
            text: { type: 'string', description: 'Message text' }
          },
          required: ['user', 'text']
        }
      },

      // Group DM operations
      {
        name: 'slack_get_group_dm_history',
        description: 'Get group direct message history',
        inputSchema: {
          type: 'object',
          properties: {
            channel: { type: 'string', description: 'Group DM channel ID' },
            limit: { type: 'number', description: 'Number of messages to retrieve', default: 100 }
          },
          required: ['channel']
        }
      },

      // Search operations
      {
        name: 'slack_search_messages',
        description: 'Search workspace content',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            sort: { type: 'string', description: 'Sort order (score, timestamp)', default: 'score' },
            count: { type: 'number', description: 'Number of results', default: 20 }
          },
          required: ['query']
        }
      },

      // User operations
      {
        name: 'slack_get_users',
        description: 'Get list of users in workspace',
        inputSchema: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: 'Number of users to retrieve', default: 100 }
          }
        }
      },
      {
        name: 'slack_get_user_info',
        description: 'Get information about a specific user',
        inputSchema: {
          type: 'object',
          properties: {
            user: { type: 'string', description: 'User ID' }
          },
          required: ['user']
        }
      }
    ];
  }

  private async callTool(params: any): Promise<any> {
    const { name, arguments: args } = params;

    try {
      switch (name) {
        case 'slack_get_channel_history':
          return await this.getChannelHistory(args.channel, args.limit);
        
        case 'slack_get_channel_info':
          return await this.getChannelInfo(args.channel);
        
        case 'slack_create_channel':
          return await this.createChannel(args.name, args.is_private);
        
        case 'slack_send_message':
          return await this.sendMessage(args.channel, args.text, args.thread_ts);
        
        case 'slack_get_private_channels':
          return await this.getPrivateChannels(args.limit);
        
        case 'slack_create_private_channel':
          return await this.createPrivateChannel(args.name);
        
        case 'slack_get_dm_history':
          return await this.getDMHistory(args.user, args.limit);
        
        case 'slack_send_dm':
          return await this.sendDM(args.user, args.text);
        
        case 'slack_get_group_dm_history':
          return await this.getGroupDMHistory(args.channel, args.limit);
        
        case 'slack_search_messages':
          return await this.searchMessages(args.query, args.sort, args.count);
        
        case 'slack_get_users':
          return await this.getUsers(args.limit);
        
        case 'slack_get_user_info':
          return await this.getUserInfo(args.user);
        
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error.message}`
          } as TextContent
        ],
        isError: true
      };
    }
  }

  // Tool implementations
  private async getChannelHistory(channel: string, limit: number = 100) {
    const result = await this.slack.conversations.history({
      channel,
      limit
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result.messages, null, 2)
        } as TextContent
      ]
    };
  }

  private async getChannelInfo(channel: string) {
    const result = await this.slack.conversations.info({ channel });
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result.channel, null, 2)
        } as TextContent
      ]
    };
  }

  private async createChannel(name: string, isPrivate: boolean = false) {
    const result = await this.slack.conversations.create({
      name,
      is_private: isPrivate
    });

    return {
      content: [
        {
          type: 'text',
          text: `Channel created: ${JSON.stringify(result.channel, null, 2)}`
        } as TextContent
      ]
    };
  }

  private async sendMessage(channel: string, text: string, threadTs?: string) {
    const result = await this.slack.chat.postMessage({
      channel,
      text,
      thread_ts: threadTs
    });

    return {
      content: [
        {
          type: 'text',
          text: `Message sent: ${JSON.stringify(result, null, 2)}`
        } as TextContent
      ]
    };
  }

  private async getPrivateChannels(limit: number = 100) {
    const result = await this.slack.conversations.list({
      types: 'private_channel',
      limit
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result.channels, null, 2)
        } as TextContent
      ]
    };
  }

  private async createPrivateChannel(name: string) {
    const result = await this.slack.conversations.create({
      name,
      is_private: true
    });

    return {
      content: [
        {
          type: 'text',
          text: `Private channel created: ${JSON.stringify(result.channel, null, 2)}`
        } as TextContent
      ]
    };
  }

  private async getDMHistory(user: string, limit: number = 100) {
    // First open/get the DM channel
    const dmResult = await this.slack.conversations.open({ users: user });
    const channel = dmResult.channel?.id;

    if (!channel) {
      throw new Error('Could not open DM channel');
    }

    const result = await this.slack.conversations.history({
      channel,
      limit
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result.messages, null, 2)
        } as TextContent
      ]
    };
  }

  private async sendDM(user: string, text: string) {
    // First open/get the DM channel
    const dmResult = await this.slack.conversations.open({ users: user });
    const channel = dmResult.channel?.id;

    if (!channel) {
      throw new Error('Could not open DM channel');
    }

    const result = await this.slack.chat.postMessage({
      channel,
      text
    });

    return {
      content: [
        {
          type: 'text',
          text: `DM sent: ${JSON.stringify(result, null, 2)}`
        } as TextContent
      ]
    };
  }

  private async getGroupDMHistory(channel: string, limit: number = 100) {
    const result = await this.slack.conversations.history({
      channel,
      limit
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result.messages, null, 2)
        } as TextContent
      ]
    };
  }

  private async searchMessages(query: string, sort: string = 'score', count: number = 20) {
    const result = await this.slack.search.messages({
      query,
      sort,
      count
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result.messages, null, 2)
        } as TextContent
      ]
    };
  }

  private async getUsers(limit: number = 100) {
    const result = await this.slack.users.list({ limit });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result.members, null, 2)
        } as TextContent
      ]
    };
  }

  private async getUserInfo(user: string) {
    const result = await this.slack.users.info({ user });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result.user, null, 2)
        } as TextContent
      ]
    };
  }
}
