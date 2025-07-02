// api/oauth/store-token.js
// Store Slack token temporarily for OAuth flow

import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  console.log('Store token endpoint called');
  console.log('Method:', req.method);
  console.log('Body:', req.body);

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

  const { authCode, token } = req.body; // Changed from apiKey to token

  if (!authCode || !token) {
    return res.status(400).json({ 
      error: 'Both authCode and token are required' 
    });
  }

  // Validate it's a Slack token
  if (!token.startsWith('xoxp-')) {
    return res.status(400).json({ 
      error: 'Invalid token format - must be a Slack user token starting with xoxp-' 
    });
  }

  try {
    // Store the Slack token temporarily (expires in 10 minutes)
    await kv.setex(`oauth_code:${authCode}`, 600, token);
    
    console.log('Stored Slack token for OAuth code:', authCode.substring(0, 20) + '...');
    
    return res.status(200).json({ 
      success: true,
      message: 'Token stored for OAuth flow'
    });

  } catch (error) {
    console.error('Error storing OAuth token:', error);
    return res.status(500).json({ 
      error: 'Failed to store token',
      message: error.message 
    });
  }
}
