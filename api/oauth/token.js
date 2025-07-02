// api/oauth/token.js
// OAuth token exchange endpoint

import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  console.log('OAuth token endpoint called');
  console.log('Method:', req.method);
  console.log('Body:', req.body);
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Handle both JSON and form-encoded data
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      // If JSON parsing fails, treat as form data
      const params = new URLSearchParams(body);
      body = Object.fromEntries(params);
    }
  }

  const { grant_type, code, client_id, redirect_uri } = body;

  console.log('Parsed body:', { grant_type, code, client_id, redirect_uri });

  if (grant_type !== 'authorization_code') {
    return res.status(400).json({ 
      error: 'unsupported_grant_type',
      error_description: 'Only authorization_code grant type is supported'
    });
  }

  if (!code) {
    return res.status(400).json({ 
      error: 'invalid_request',
      error_description: 'authorization_code is required' 
    });
  }

  try {
    // Look up the stored API key for this auth code
    const apiKey = await kv.get(`oauth_code:${code}`);
    
    if (!apiKey) {
      return res.status(400).json({ 
        error: 'invalid_grant',
        error_description: 'Invalid or expired authorization code'
      });
    }

    // Clean up the temporary code
    await kv.del(`oauth_code:${code}`);

    // Return the access token (which is actually the API key)
    const tokenResponse = {
      access_token: apiKey,
      token_type: 'bearer',
      expires_in: 31536000, // 1 year
      scope: 'slack:read slack:write'
    };

    console.log('Returning token response:', tokenResponse);
    return res.status(200).json(tokenResponse);

  } catch (error) {
    console.error('Error in token endpoint:', error);
    return res.status(500).json({ 
      error: 'server_error',
      error_description: 'Internal server error' 
    });
  }
}
