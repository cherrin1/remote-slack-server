// api/register.js - Simplified without API key generation
import { kv } from '@vercel/kv';

// Simple SlackClient for registration
class SlackClient {
  constructor(token) {
    this.token = token;
    this.baseUrl = 'https://slack.com/api';
  }

  async testAuth() {
    const response = await fetch(`${this.baseUrl}/auth.test`, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.ok) {
      throw new Error(`Slack API error: ${data.error}`);
    }

    return data;
  }
}

// Simple UserAuth for registration
class UserAuth {
  static generateUserId() {
    return 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(7);
  }

  static async createUser(slackToken, userInfo = {}) {
    if (!slackToken || !slackToken.startsWith('xoxp-')) {
      throw new Error('Invalid Slack token format');
    }

    const userId = this.generateUserId();
    
    const userData = {
      id: userId,
      slackToken,
      createdAt: new Date().toISOString(),
      lastUsed: new Date().toISOString(),
      userInfo,
      active: true,
      usage: {
        totalRequests: 0,
        lastRequest: null
      }
    };

    // Store user data with token as key
    await kv.set(`user:${userId}`, userData);
    
    // Create token mapping for fast lookups
    await kv.set(`token:${slackToken}`, userId);
    
    return { userId, slackToken, userData };
  }
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { slackToken, userInfo = {} } = req.body;
  
  if (!slackToken || !slackToken.startsWith('xoxp-')) {
    return res.status(400).json({ 
      error: 'Valid Slack user token required',
      format: 'Token must start with xoxp-'
    });
  }

  try {
    console.log('Registering user with token:', slackToken.substring(0, 20) + '...');
    
    // Validate token
    const slackClient = new SlackClient(slackToken);
    const authTest = await slackClient.testAuth();
    
    console.log('Auth test successful:', authTest);
    
    // Create user
    const { userId } = await UserAuth.createUser(slackToken, {
      ...userInfo,
      slackUserId: authTest.user_id,
      slackTeam: authTest.team_id,
      slackTeamName: authTest.team,
      slackUrl: authTest.url,
      source: 'claude-web-integration'
    });

    console.log('User created:', userId);

    return res.status(201).json({
      success: true,
      message: 'Successfully registered for Claude web integration',
      token: slackToken, // Return the token for Claude Web to use
      userId,
      integration: {
        server_url: `https://${req.headers.host}`,
        authorization: `Bearer ${slackToken}`,
        instructions: "Use your Slack token directly for authentication"
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    return res.status(400).json({ 
      error: 'Registration failed',
      message: error.message
    });
  }
}
