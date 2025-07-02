// api/oauth/store-token.js
// Store API key temporarily for OAuth flow

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

  const { authCode, apiKey } = req.body;

  if (!authCode || !apiKey) {
    return res.status(400).json({ 
      error: 'Both authCode and apiKey are required' 
    });
  }

  try {
    // Store the API key temporarily (expires in 10 minutes)
    await kv.setex(`oauth_code:${authCode}`, 600, apiKey);
    
    console.log('Stored API key for OAuth code:', authCode.substring(0, 20) + '...');
    
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
