// api/oauth/token.js - Updated for direct Slack tokens

import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  console.log('OAuth token endpoint called by Claude Web');
  console.log('Method:', req.method);
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'invalid_request',
      error_description: 'Method not allowed' 
    });
  }

  // Parse request body (handle both JSON and form-encoded)
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      const params = new URLSearchParams(body);
      body = Object.fromEntries(params);
    }
  }

  const { grant_type, code, client_id, redirect_uri, client_secret } = body;

  console.log('Parsed token request:', { grant_type, code, client_id, redirect_uri });

  // Validate grant type
  if (grant_type !== 'authorization_code') {
    return res.status(400).json({
      error: 'unsupported_grant_type',
      error_description: 'Only authorization_code is supported'
    });
  }

  // Validate authorization code
  if (!code) {
    return res.status(400).json({
      error: 'invalid_request',
      error_description: 'authorization_code is required'
    });
  }

  // Validate client ID
  if (!client_id || client_id !== 'slack-mcp-claude-web') {
    return res.status(400).json({
      error: 'invalid_client',
      error_description: 'Invalid client_id'
    });
  }

  try {
    // Look up the stored Slack token for this authorization code
    const slackToken = await kv.get(`oauth_code:${code}`);
    
    if (!slackToken) {
      console.log('Authorization code not found or expired:', code);
      return res.status(400).json({
        error: 'invalid_grant',
        error_description: 'Invalid or expired authorization code'
      });
    }

    // Clean up the temporary code
    await kv.del(`oauth_code:${code}`);

    // Create access token response for Claude Web
    const tokenResponse = {
      access_token: slackToken, // Return the Slack token directly
      token_type: 'bearer',
      expires_in: 31536000, // 1 year
      refresh_token: `refresh_${Date.now()}_${Math.random().toString(36)}`,
      scope: 'slack:read slack:write'
    };

    console.log('Returning token to Claude Web:', { 
      access_token: slackToken.substring(0, 20) + '...', 
      token_type: tokenResponse.token_type 
    });

    return res.status(200).json(tokenResponse);

  } catch (error) {
    console.error('Error in token exchange:', error);
    return res.status(500).json({
      error: 'server_error',
      error_description: 'Internal server error'
    });
  }
}
