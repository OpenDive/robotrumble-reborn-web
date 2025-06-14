import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import pkg from 'agora-token';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from parent directory
config({ path: path.join(__dirname, '..', '.env') });

const { RtcTokenBuilder, RtcRole } = pkg;

const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Add security headers for Enoki OAuth compatibility
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
  next();
});

app.use(express.json());



// Get Agora credentials from environment
const getAgoraCredentials = () => {
  const appId = process.env.VITE_AGORA_APP_ID || process.env.APP_ID;
  const appCertificate = process.env.AGORA_APP_CERTIFICATE || process.env.APP_CERTIFICATE;
  
  if (!appId) {
    throw new Error('Agora App ID not found. Please set VITE_AGORA_APP_ID or APP_ID in .env file');
  }
  
  if (!appCertificate) {
    throw new Error('Agora App Certificate not found. Please set AGORA_APP_CERTIFICATE or APP_CERTIFICATE in .env file');
  }
  
  return { appId, appCertificate };
};

// Google OAuth API route
app.post('/api/google-oauth', async (req, res) => {
  try {
    const { code, redirect_uri } = req.body;

    if (!code || !redirect_uri) {
      return res.status(400).json({ error: 'Missing code or redirect_uri' });
    }

    // Get Google OAuth credentials from environment variables
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
});

app.get('/api/token', (req, res) => {
  try {
    const { channelName, uid, role } = req.query;
    
    if (!channelName || uid === undefined) {
      return res.status(400).json({ 
        error: 'Missing required parameters: channelName and uid are required' 
      });
    }
    
    const { appId, appCertificate } = getAgoraCredentials();
    
    // Determine role
    let rtcRole = RtcRole.SUBSCRIBER;
    if (role === 'host' || role === 'publisher') {
      rtcRole = RtcRole.PUBLISHER;
    }
    
    // Generate token (valid for 24 hours)
    const expireTime = Math.floor(Date.now() / 1000) + (24 * 60 * 60);
    const uidInt = parseInt(uid);
    
    const token = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      channelName,
      uidInt,
      rtcRole,
      expireTime
    );
    
    console.log(`Generated token for channel: ${channelName}, uid: ${uidInt}, role: ${role}`);
    
    res.json({
      token,
      appId,
      channelName,
      uid: uidInt,
      expireTime
    });
    
  } catch (error) {
    console.error('Error generating token:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Development token server is running' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Development server running on port ${PORT}`);
  console.log(`📱 Frontend should connect to: http://localhost:${PORT}`);
  console.log(`🎮 Game APIs available at /api/game/*`);
  console.log(`🤖 Robot APIs available at /api/robot/*`);
  
  if (!process.env.ENOKI_PRIVATE_API_KEY) {
    console.log('⚠️  Enoki private API key not found - some features may not work');
  }
}); 