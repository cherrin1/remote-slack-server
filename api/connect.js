// api/connect.js - Updated to not generate API keys
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const baseUrl = `https://${req.headers.host}`;
  const { oauth, client, auth_code, redirect_uri, state, client_id } = req.query;

  const isClaudeWeb = client === 'claude-web' || oauth === 'true';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Connect Your Slack to Claude MCP</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        
        .container {
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            padding: 40px;
            max-width: 500px;
            width: 100%;
        }
        
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        
        .logo {
            font-size: 48px;
            margin-bottom: 16px;
        }
        
        h1 {
            color: #2d3748;
            margin-bottom: 8px;
            font-size: 24px;
        }
        
        .subtitle {
            color: #718096;
            margin-bottom: 30px;
        }

        .claude-notice {
            background: #e6f3ff;
            border: 2px solid #4299e1;
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 20px;
            text-align: center;
        }

        .claude-notice h3 {
            color: #2b6cb0;
            margin-bottom: 8px;
        }

        .claude-notice p {
            color: #2d3748;
            font-size: 14px;
        }
        
        .form-group {
            margin-bottom: 20px;
        }
        
        label {
            display: block;
            color: #4a5568;
            font-weight: 600;
            margin-bottom: 8px;
        }
        
        input[type="text"], input[type="email"] {
            width: 100%;
            padding: 12px 16px;
            border: 2px solid #e2e8f0;
            border-radius: 8px;
            font-size: 16px;
            transition: border-color 0.3s ease;
        }
        
        input[type="text"]:focus, input[type="email"]:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        
        .help-text {
            font-size: 14px;
            color: #718096;
            margin-top: 4px;
        }
        
        .workplace-note {
            background: #e6fffa;
            border: 1px solid #81e6d9;
            border-radius: 8px;
            padding: 12px;
            margin: 16px 0;
            font-size: 14px;
            color: #234e52;
        }
        
        .workplace-note strong {
            color: #1a202c;
        }
        
        .connect-btn {
            width: 100%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 14px 24px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
            margin-top: 20px;
        }
        
        .connect-btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }
        
        .connect-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
        }
        
        .status {
            margin-top: 20px;
            padding: 12px;
            border-radius: 8px;
            font-weight: 600;
            text-align: center;
            display: none;
        }
        
        .status.success {
            background: #f0fff4;
            border: 1px solid #68d391;
            color: #22543d;
        }
        
        .status.error {
            background: #fed7d7;
            border: 1px solid #fc8181;
            color: #742a2a;
        }
        
        .status.loading {
            background: #ebf8ff;
            border: 1px solid #63b3ed;
            color: #2a4365;
        }
        
        .claude-success {
            background: #f0fff4;
            border: 2px solid #68d391;
            border-radius: 8px;
            padding: 20px;
            margin-top: 20px;
            text-align: center;
            display: none;
        }
        
        .claude-success h3 {
            color: #22543d;
            margin-bottom: 12px;
        }
        
        .complete-btn {
            background: #48bb78;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
            font-weight: 600;
        }
        
        .complete-btn:hover {
            background: #38a169;
        }

        .token-display {
            background: #f7fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 12px;
            margin-top: 16px;
            font-family: monospace;
            font-size: 14px;
            word-break: break-all;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🚀</div>
            <h1>Connect Slack to Claude</h1>
            <p class="subtitle">Complete your Claude Web integration</p>
        </div>
        
        ${isClaudeWeb ? `
        <div class="claude-notice">
            <h3>🤖 Claude Web OAuth Setup</h3>
            <p>Enter your Slack token below to complete the integration with Claude Web.</p>
        </div>
        ` : ''}
        
        <form id="connectionForm">
            <div class="workplace-note">
                <strong>🏢 Workplace Users:</strong> Visit your MCP integration bot's home page to generate a user token with the required permissions.
            </div>
            
            <div class="form-group">
                <label for="slackToken">Slack User Token *</label>
                <input 
                    type="text" 
                    id="slackToken" 
                    name="slackToken" 
                    placeholder="xoxp-1234567890-1234567890-1234567890-abcdef"
                    required
                >
                <div class="help-text">Your token should start with "xoxp-"</div>
            </div>
            
            <div class="form-group">
                <label for="userName">Your Name (Optional)</label>
                <input 
                    type="text" 
                    id="userName" 
                    name="userName" 
                    placeholder="John Doe"
                >
            </div>
            
            <div class="form-group">
                <label for="userEmail">Your Email (Optional)</label>
                <input 
                    type="email" 
                    id="userEmail" 
                    name="userEmail" 
                    placeholder="john@company.com"
                >
            </div>
            
            <button type="submit" class="connect-btn" id="connectBtn">
                🔗 ${isClaudeWeb ? 'Complete Claude Web Integration' : 'Connect to Claude'}
            </button>
        </form>
        
        <div class="status" id="status"></div>
        
        <div class="claude-success" id="claudeSuccess">
            <h3>✅ Integration Complete!</h3>
            <p>Your Slack workspace has been successfully connected to Claude Web.</p>
            <div class="token-display" id="tokenDisplay" style="display: none;">
                <strong>Your Token:</strong><br>
                <span id="tokenValue"></span>
            </div>
            <button class="complete-btn" onclick="completeClaudeOAuth()">
                🚀 Return to Claude
            </button>
        </div>
    </div>

    <script>
        // OAuth parameters
        const isClaudeWeb = ${isClaudeWeb};
        const authCode = '${auth_code || ''}';
        const redirectUri = '${redirect_uri || ''}';
        const state = '${state || ''}';
        const clientId = '${client_id || ''}';
        
        document.getElementById('connectionForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const submitBtn = document.getElementById('connectBtn');
            const status = document.getElementById('status');
            const claudeSuccess = document.getElementById('claudeSuccess');
            
            const slackToken = document.getElementById('slackToken').value.trim();
            const userName = document.getElementById('userName').value.trim();
            const userEmail = document.getElementById('userEmail').value.trim();
            
            if (!slackToken.startsWith('xoxp-') || slackToken.length < 50) {
                showStatus('error', '❌ Invalid token format. Token should start with "xoxp-" and be longer.');
                return;
            }
            
            submitBtn.disabled = true;
            submitBtn.textContent = '🔄 Connecting...';
            showStatus('loading', '🔄 Connecting to Slack...');
            
            try {
                // Register the user
                const response = await fetch('${baseUrl}/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        slackToken: slackToken,
                        userInfo: {
                            name: userName || 'Claude Web User',
                            email: userEmail || '',
                            source: 'claude-web-oauth',
                            timestamp: new Date().toISOString()
                        }
                    })
                });
                
                const data = await response.json();
                
                if (response.ok && data.success) {
                    if (isClaudeWeb && authCode) {
                        // Store token for Claude Web OAuth flow
                        await fetch('${baseUrl}/oauth/store-token', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                authCode: authCode,
                                token: slackToken
                            })
                        });
                        
                        showStatus('success', '✅ Successfully connected to Slack!');
                        claudeSuccess.style.display = 'block';
                        document.getElementById('connectionForm').style.display = 'none';
                    } else {
                        showStatus('success', '✅ Successfully connected!');
                        document.getElementById('tokenValue').textContent = slackToken;
                        document.getElementById('tokenDisplay').style.display = 'block';
                    }
                } else {
                    showStatus('error', '❌ ' + (data.message || data.error || 'Connection failed'));
                }
                
            } catch (error) {
                console.error('Connection error:', error);
                showStatus('error', '❌ Network error. Please try again.');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = isClaudeWeb ? '🔗 Complete Claude Web Integration' : '🔗 Connect to Claude';
            }
        });
        
        function showStatus(type, message) {
            const status = document.getElementById('status');
            status.className = \`status \${type}\`;
            status.textContent = message;
            status.style.display = 'block';
        }
        
        function completeClaudeOAuth() {
            if (redirectUri && authCode) {
                const returnUrl = redirectUri + 
                    \`?code=\${authCode}\` + 
                    (state ? \`&state=\${state}\` : '');
                console.log('Redirecting Claude Web to:', returnUrl);
                window.location.href = returnUrl;
            } else {
                // Fallback - just close the window
                window.close();
            }
        }
        
        document.getElementById('slackToken').focus();
    </script>
</body>
</html>
  `;

  res.setHeader('Content-Type', 'text/html');
  return res.status(200).send(html);
}
