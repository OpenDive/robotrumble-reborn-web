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
  
  // Test environment variables on startup
  try {
    getAgoraCredentials();
    console.log('✅ Agora credentials loaded successfully');
  } catch (error) {
    console.error('❌ Error loading Agora credentials:', error.message);
  }
}); 