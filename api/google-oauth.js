export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { code, redirect_uri } = req.body;

    if (!code || !redirect_uri) {
      return res.status(400).json({ error: 'Missing code or redirect_uri' });
    }

    // Get Google OAuth credentials from environment variables (server-side only)
    const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
    const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      console.error('Google OAuth credentials missing', {
        hasClientId: !!GOOGLE_CLIENT_ID,
        hasClientSecret: !!GOOGLE_CLIENT_SECRET,
        envKeys: Object.keys(process.env).filter(k => k.includes('GOOGLE'))
      });
      return res.status(500).json({ error: 'Google OAuth credentials not configured' });
    }

    // Exchange code for tokens
    const tokenEndpoint = 'https://oauth2.googleapis.com/token';
    const params = new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri,
      grant_type: 'authorization_code',
    });

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    const responseData = await response.text();

    if (!response.ok) {
      console.error('Google token exchange error:', responseData);
      return res.status(400).json({ error: 'Failed to exchange code for tokens' });
    }

    const tokens = JSON.parse(responseData);
    
    // Return tokens to frontend
    res.status(200).json(tokens);
    
  } catch (error) {
    console.error('Error in Google OAuth exchange:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
} 