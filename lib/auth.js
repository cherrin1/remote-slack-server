// lib/auth.js
import { kv } from '@vercel/kv';
import { createHash, randomBytes } from 'crypto';

/**
 * User Authentication and Management Class
 * Handles user registration, API key management, and token storage in Vercel KV
 */
export class UserAuth {
  
  /**
   * Generate a unique user ID
   * @returns {string} Random user ID with prefix
   */
  static generateUserId() {
    return 'usr_' + randomBytes(16).toString('hex');
  }

  /**
   * Generate a secure API key for user authentication
   * @returns {string} API key with smcp_ prefix
   */
  static generateApiKey() {
    return 'smcp_' + randomBytes(32).toString('hex');
  }

  /**
   * Create SHA256 hash of token for secure lookups
   * @param {string} token - Slack token to hash
   * @returns {string} SHA256 hash
   */
  static hashToken(token) {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Validate API key format
   * @param {string} apiKey - API key to validate
   * @returns {boolean} True if valid format
   */
  static isValidApiKey(apiKey) {
    return typeof apiKey === 'string' && /^smcp_[a-f0-9]{64}$/.test(apiKey);
  }

  /**
   * Validate Slack token format
   * @param {string} token - Slack token to validate
   * @returns {boolean} True if valid format
   */
  static isValidSlackToken(token) {
    return typeof token === 'string' && token.startsWith('xoxp-') && token.length > 50;
  }

  /**
   * Create a new user account
   * @param {string} slackToken - User's Slack token
   * @param {object} userInfo - Additional user information
   * @returns {Promise<object>} User ID and API key
   */
  static async createUser(slackToken, userInfo = {}) {
    if (!this.isValidSlackToken(slackToken)) {
      throw new Error('Invalid Slack token format');
    }

    const userId = this.generateUserId();
    const apiKey = this.generateApiKey();
    const hashedToken = this.hashToken(slackToken);
    
    const userData = {
      id: userId,
      apiKey,
      slackTokenHash: hashedToken,
      slackToken, // In production, encrypt this
      createdAt: new Date().toISOString(),
      lastUsed: new Date().toISOString(),
      userInfo: {
        ...userInfo,
        registrationIp: userInfo.ip || 'unknown'
      },
      active: true,
      usage: {
        totalRequests: 0,
        lastRequest: null
      }
    };

    // Store user data
    await kv.set(`user:${userId}`, userData);
    
    // Create API key mapping for fast lookups
    await kv.set(`apikey:${apiKey}`, userId);
    
    // Track user count (optional analytics)
    await kv.incr('stats:total_users');
    
    return { userId, apiKey, userData };
  }

  /**
   * Get user by API key
   * @param {string} apiKey - User's API key
   * @returns {Promise<object|null>} User data or null if not found
   */
  static async getUserByApiKey(apiKey) {
    if (!this.isValidApiKey(apiKey)) {
      return null;
    }

    try {
      // Get user ID from API key mapping
      const userId = await kv.get(`apikey:${apiKey}`);
      if (!userId) {
        return null;
      }
      
      // Get full user data
      const userData = await kv.get(`user:${userId}`);
      if (!userData || !userData.active) {
        return null;
      }
      
      // Update last used timestamp
      userData.lastUsed = new Date().toISOString();
      userData.usage.totalRequests = (userData.usage.totalRequests || 0) + 1;
      userData.usage.lastRequest = new Date().toISOString();
      
      // Update in background (don't await)
      kv.set(`user:${userId}`, userData).catch(console.error);
      
      return userData;
    } catch (error) {
      console.error('Error getting user by API key:', error);
      return null;
    }
  }

  /**
   * Update user's Slack token
   * @param {string} userId - User ID
   * @param {string} newSlackToken - New Slack token
   * @returns {Promise<object>} Updated user data
   */
  static async updateUserToken(userId, newSlackToken) {
    if (!this.isValidSlackToken(newSlackToken)) {
      throw new Error('Invalid Slack token format');
    }

    const userData = await kv.get(`user:${userId}`);
    if (!userData) {
      throw new Error('User not found');
    }
    
    userData.slackToken = newSlackToken;
    userData.slackTokenHash = this.hashToken(newSlackToken);
    userData.updatedAt = new Date().toISOString();
    
    await kv.set(`user:${userId}`, userData);
    return userData;
  }

  /**
   * Deactivate user account
   * @param {string} userId - User ID to deactivate
   * @returns {Promise<boolean>} Success status
   */
  static async deactivateUser(userId) {
    const userData = await kv.get(`user:${userId}`);
    if (!userData) {
      return false;
    }
    
    // Mark as inactive
    userData.active = false;
    userData.deactivatedAt = new Date().toISOString();
    
    // Update user record
    await kv.set(`user:${userId}`, userData);
    
    // Remove API key mapping
    await kv.del(`apikey:${userData.apiKey}`);
    
    // Update stats
    await kv.decr('stats:active_users');
    
    return true;
  }

  /**
   * Reactivate user account
   * @param {string} userId - User ID to reactivate
   * @returns {Promise<object>} New API key and user data
   */
  static async reactivateUser(userId) {
    const userData = await kv.get(`user:${userId}`);
    if (!userData) {
      throw new Error('User not found');
    }
    
    // Generate new API key for security
    const newApiKey = this.generateApiKey();
    
    userData.active = true;
    userData.apiKey = newApiKey;
    userData.reactivatedAt = new Date().toISOString();
    delete userData.deactivatedAt;
    
    // Update user record
    await kv.set(`user:${userId}`, userData);
    
    // Create new API key mapping
    await kv.set(`apikey:${newApiKey}`, userId);
    
    return { apiKey: newApiKey, userData };
  }

  /**
   * Get user by user ID
   * @param {string} userId - User ID
   * @returns {Promise<object|null>} User data or null
   */
  static async getUserById(userId) {
    try {
      return await kv.get(`user:${userId}`);
    } catch (error) {
      console.error('Error getting user by ID:', error);
      return null;
    }
  }

  /**
   * List all users (admin function)
   * @param {number} limit - Maximum number of users to return
   * @param {string} cursor - Pagination cursor
   * @returns {Promise<object>} Users list with pagination
   */
  static async listUsers(limit = 100, cursor = '0') {
    try {
      const [newCursor, keys] = await kv.scan(cursor, {
        match: 'user:*',
        count: limit
      });

      const users = [];
      
      for (const key of keys) {
        const userData = await kv.get(key);
        if (userData) {
          // Return sanitized user data (no tokens)
          users.push({
            id: userData.id,
            createdAt: userData.createdAt,
            lastUsed: userData.lastUsed,
            active: userData.active,
            userInfo: {
              name: userData.userInfo?.name,
              email: userData.userInfo?.email,
              slackTeam: userData.userInfo?.slackTeam
            },
            usage: userData.usage
          });
        }
      }
      
      return {
        users,
        cursor: newCursor,
        hasMore: newCursor !== '0'
      };
    } catch (error) {
      console.error('Error listing users:', error);
      return { users: [], cursor: '0', hasMore: false };
    }
  }

  /**
   * Get system statistics
   * @returns {Promise<object>} System stats
   */
  static async getStats() {
    try {
      const totalUsers = await kv.get('stats:total_users') || 0;
      const activeUsers = await kv.get('stats:active_users') || 0;
      
      // Count active users in last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const [, userKeys] = await kv.scan('0', {
        match: 'user:*',
        count: 1000
      });
      
      let recentlyActive = 0;
      for (const key of userKeys) {
        const userData = await kv.get(key);
        if (userData && userData.lastUsed) {
          const lastUsed = new Date(userData.lastUsed);
          if (lastUsed > thirtyDaysAgo) {
            recentlyActive++;
          }
        }
      }
      
      return {
        totalUsers,
        activeUsers,
        recentlyActive,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting stats:', error);
      return {
        totalUsers: 0,
        activeUsers: 0,
        recentlyActive: 0,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Clean up inactive users (admin function)
   * @param {number} daysInactive - Days of inactivity before cleanup
   * @returns {Promise<number>} Number of users cleaned up
   */
  static async cleanupInactiveUsers(daysInactive = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysInactive);
    
    const [, userKeys] = await kv.scan('0', {
      match: 'user:*',
      count: 1000
    });
    
    let cleanedUp = 0;
    
    for (const key of userKeys) {
      const userData = await kv.get(key);
      if (userData && userData.lastUsed) {
        const lastUsed = new Date(userData.lastUsed);
        if (lastUsed < cutoffDate && userData.active) {
          await this.deactivateUser(userData.id);
          cleanedUp++;
        }
      }
    }
    
    return cleanedUp;
  }

  /**
   * Rotate API key for a user
   * @param {string} userId - User ID
   * @returns {Promise<string>} New API key
   */
  static async rotateApiKey(userId) {
    const userData = await kv.get(`user:${userId}`);
    if (!userData) {
      throw new Error('User not found');
    }
    
    // Remove old API key mapping
    await kv.del(`apikey:${userData.apiKey}`);
    
    // Generate new API key
    const newApiKey = this.generateApiKey();
    userData.apiKey = newApiKey;
    userData.keyRotatedAt = new Date().toISOString();
    
    // Update user record
    await kv.set(`user:${userId}`, userData);
    
    // Create new API key mapping
    await kv.set(`apikey:${newApiKey}`, userId);
    
    return newApiKey;
  }

  /**
   * Check if user exists by Slack team
   * @param {string} slackTeamId - Slack team ID
   * @returns {Promise<boolean>} True if user exists for this team
   */
  static async userExistsForTeam(slackTeamId) {
    const [, userKeys] = await kv.scan('0', {
      match: 'user:*',
      count: 1000
    });
    
    for (const key of userKeys) {
      const userData = await kv.get(key);
      if (userData && userData.userInfo?.slackTeam === slackTeamId && userData.active) {
        return true;
      }
    }
    
    return false;
  }
}
