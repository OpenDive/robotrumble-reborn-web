import { RtcTokenBuilder, RtcRole } from 'agora-token';

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
  
  if (!channelName) {
    return res.status(400).json({ error: 'Channel name is required' });
  }

  // Get Agora credentials from environment variables (server-side only)
  const APP_ID = process.env.AGORA_APP_ID || '598a5efd867842b98ece817df8be08ee';
  const APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE;
  
  if (!APP_CERTIFICATE) {
    console.error('AGORA_APP_CERTIFICATE not found in server environment');
    return res.status(500).json({ error: 'Agora credentials missing' });
  }

  try {
    // Generate token
    const expirationTimeInSeconds = 3600; // 1 hour
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

    const serverRole = role === 'host' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
    
    const token = RtcTokenBuilder.buildTokenWithUid(
      APP_ID,
      APP_CERTIFICATE,
      channelName,
      parseInt(uid || '0'),
      serverRole,
      privilegeExpiredTs
    );

    console.log('Token generated successfully for channel:', channelName, 'uid:', uid, 'role:', role);

    // Return token with expiration time
    res.status(200).json({ 
      token,
      expiresIn: expirationTimeInSeconds
    });
  } catch (error) {
    console.error('Error generating token:', error);
    res.status(500).json({ error: 'Failed to generate token' });
  }
} 