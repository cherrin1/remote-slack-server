// api/oauth/authorize.js
// OAuth authorization endpoint - redirects to our connect page

export default function handler(req, res) {
  console.log('OAuth authorize called with:', req.query);
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { client_id, redirect_uri, scope, state, response_type } = req.query;
  
  if (!redirect_uri) {
    return res.status(400).json({ error: 'redirect_uri is required' });
  }

  try {
    // Generate a temporary auth code
    const authCode = 'slack_auth_' + Date.now() + '_' + Math.random().toString(36).substring(7);
    
    // In a real implementation, you'd store this temporarily
    // For now, we'll embed it in our connect page
    
    const baseUrl = `https://${req.headers.host}`;
    
    // Redirect to our connect page with OAuth context
    const connectUrl = `${baseUrl}/connect?` + 
      `oauth=true&` +
      `auth_code=${authCode}&` +
      `redirect_uri=${encodeURIComponent(redirect_uri)}&` +
      `state=${state || ''}&` +
      `client_id=${client_id || ''}`;
    
    console.log('Redirecting to:', connectUrl);
    return res.redirect(302, connectUrl);
    
  } catch (error) {
    console.error('Error in authorize endpoint:', error);
    return res.status(400).json({ error: 'Invalid redirect_uri' });
  }
}
