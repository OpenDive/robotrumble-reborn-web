import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import pkg from 'agora-token';

// Load environment variables
config();

const { RtcTokenBuilder, RtcRole } = pkg;

const app = express();
const PORT = 3001;

// CORS configuration
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000'],
  credentials: true
}));

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

app.listen(PORT, () => {
  console.log(`🚀 Development token server running on http://localhost:${PORT}`);
  console.log(`📡 Ready to generate Agora tokens for local development`);
  console.log(`🔐 Google OAuth API available at /api/google-oauth`);
  
  // Test environment variables on startup
  try {
    getAgoraCredentials();
    console.log('✅ Agora credentials loaded successfully');
  } catch (error) {
    console.error('❌ Error loading Agora credentials:', error.message);
  }
}); 