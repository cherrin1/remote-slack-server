// api/oauth/authorize.js - OAuth authorization for Claude Web

export default function handler(req, res) {
  console.log('OAuth authorize called by Claude Web:', req.query);
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { client_id, redirect_uri, scope, state, response_type } = req.query;
  
  if (!redirect_uri) {
    return res.status(400).json({ error: 'redirect_uri is required' });
  }

  if (!client_id) {
    return res.status(400).json({ error: 'client_id is required' });
  }

  try {
    // Generate authorization code
    const authCode = 'claude_web_' + Date.now() + '_' + Math.random().toString(36).substring(7);
    
    const baseUrl = `https://${req.headers.host}`;
    
    // Redirect to our connect page with OAuth context for Claude Web
    const connectUrl = `${baseUrl}/connect?` + new URLSearchParams({
      oauth: 'true',
      client: 'claude-web',
      auth_code: authCode,
      redirect_uri: redirect_uri,
      state: state || '',
      client_id: client_id
    }).toString();
    
    console.log('Redirecting Claude Web to:', connectUrl);
    return res.redirect(302, connectUrl);
    
  } catch (error) {
    console.error('Error in OAuth authorize:', error);
    return res.status(500).json({ error: 'Authorization failed' });
  }
}
