// api/oauth/store-token.js
// Store API key temporarily for OAuth flow

import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { authCode, apiKey } = req.body;

  if (!authCode || !apiKey) {
    return res.status(400).json({ 
      error: 'Both authCode and apiKey are required' 
    });
  }

  try {
    // Store the API key temporarily (expires in 10 minutes)
    await kv.setex(`oauth_code:${authCode}`, 600, apiKey);
    
    return res.status(200).json({ 
      success: true,
      message: 'Token stored for OAuth flow'
    });

  } catch (error) {
    console.error('Error storing OAuth token:', error);
    return res.status(500).json({ 
      error: 'Failed to store token' 
    });
  }
}
