/**
 * Slack API Client
 * Handles all interactions with Slack's Web API
 */
export class SlackClient {
  constructor(token) {
    this.token = token;
    this.baseUrl = 'https://slack.com/api';
  }

  /**
   * Make a request to Slack API
   * @param {string} endpoint - API endpoint (e.g., 'auth.test')
   * @param {object} params - Request parameters
   * @param {string} method - HTTP method (GET or POST)
   * @returns {Promise<object>} API response
   */
  async makeRequest(endpoint, params = {}, method = 'GET') {
    const url = new URL(`${this.baseUrl}/${endpoint}`);
    const options = {
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': method === 'GET' ? 'application/json' : 'application/x-www-form-urlencoded',
      }
    };

    if (method === 'GET') {
      // Add parameters to URL for GET requests
      Object.keys(params).forEach(key => {
        if (params[key] !== undefined) {
          url.searchParams.append(key, params[key]);
        }
      });
    } else {
      // Use form data for POST requests (Slack prefers this)
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

  /**
   * Test the authentication token
   * @returns {Promise<object>} Auth test response
   */
  async testAuth() {
    return await this.makeRequest('auth.test');
  }

  /**
   * Search for messages across the workspace
   * @param {string} query - Search query
   * @param {number} count - Number of results
   * @returns {Promise<object>} Search results
   */
  async searchMessages(query, count = 20) {
    return await this.makeRequest('search.messages', { query, count });
  }

  /**
   * Get list of conversations (channels)
   * @param {string} types - Channel types to include
   * @param {number} limit - Maximum channels to return
   * @returns {Promise<object>} Channels list
   */
  async getChannels(types = 'public_channel', limit = 100) {
    return await this.makeRequest('conversations.list', { types, limit });
  }

  /**
   * Get conversation history
   * @param {string} channel - Channel ID
   * @param {number} limit - Number of messages
   * @returns {Promise<object>} Message history
   */
  async getChannelHistory(channel, limit = 50) {
    return await this.makeRequest('conversations.history', { channel, limit });
  }

  /**
   * Get channel information
   * @param {string} channel - Channel ID
   * @returns {Promise<object>} Channel info
   */
  async getChannelInfo(channel) {
    return await this.makeRequest('conversations.info', { channel });
  }

  /**
   * Send a message to a channel
   * @param {string} channel - Channel ID or name
   * @param {string} text - Message text
   * @param {object} options - Additional options
   * @returns {Promise<object>} Message response
   */
  async sendMessage(channel, text, options = {}) {
    return await this.makeRequest('chat.postMessage', {
      channel,
      text,
      ...options
    }, 'POST');
  }

  /**
   * Get list of users in workspace
   * @param {number} limit - Maximum users to return
   * @returns {Promise<object>} Users list
   */
  async getUsers(limit = 100) {
    return await this.makeRequest('users.list', { limit });
  }

  /**
   * Get user information
   * @param {string} user - User ID
   * @returns {Promise<object>} User info
   */
  async getUserInfo(user) {
    return await this.makeRequest('users.info', { user });
  }

  /**
   * Open a direct message conversation
   * @param {string} users - Comma-separated user IDs
   * @returns {Promise<object>} DM channel info
   */
  async openDM(users) {
    return await this.makeRequest('conversations.open', { users }, 'POST');
  }
}
