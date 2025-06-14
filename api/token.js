import pkg from 'agora-token';
const { RtcTokenBuilder, RtcRole } = pkg;

export default function handler(req, res) {
  // Debug logs
  console.log('Token API route hit');
  console.log('Query params:', req.query);
  
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Extract parameters from query
  const { channelName, uid, role } = req.query;
  
  if (!channelName || uid === undefined) {
    return res.status(400).json({ 
      error: 'Missing required parameters: channelName and uid are required' 
    });
  }

  // Get Agora credentials from environment variables - match development server logic
  const APP_ID = process.env.AGORA_APP_ID || process.env.VITE_AGORA_APP_ID || process.env.APP_ID || '598a5efd867842b98ece817df8be08ee';
  const APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE || process.env.APP_CERTIFICATE;
  
  if (!APP_ID) {
    console.error('Agora App ID not found in server environment');
    return res.status(500).json({ error: 'Agora App ID missing' });
  }
  
  if (!APP_CERTIFICATE) {
    console.error('AGORA_APP_CERTIFICATE not found in server environment');
    return res.status(500).json({ error: 'Agora credentials missing' });
  }

  try {
    // Determine role - match development server logic
    let rtcRole = RtcRole.SUBSCRIBER;
    if (role === 'host' || role === 'publisher') {
      rtcRole = RtcRole.PUBLISHER;
    }

    // Generate token (valid for 24 hours to match development server)
    const expireTime = Math.floor(Date.now() / 1000) + (24 * 60 * 60);
    const uidInt = parseInt(uid);
    
    const token = RtcTokenBuilder.buildTokenWithUid(
      APP_ID,
      APP_CERTIFICATE,
      channelName,
      uidInt,
      rtcRole,
      expireTime
    );

    console.log(`Generated token for channel: ${channelName}, uid: ${uidInt}, role: ${role}`);

    // Return token with same format as development server
    res.status(200).json({ 
      token,
      appId: APP_ID,
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
} 