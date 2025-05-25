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

// Helper function to get current epoch from Sui network
async function getCurrentEpoch() {
  try {
    // For development, return a mock epoch
    // In production, you would fetch this from Sui network
    return Math.floor(Date.now() / 1000 / 86400); // Rough epoch calculation
  } catch (error) {
    console.error('Error getting current epoch:', error);
    return Math.floor(Date.now() / 1000 / 86400);
  }
}

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

// ZK Login API route
app.post('/api/zk-login', async (req, res) => {
  try {
    const body = req.body;
    const { action, jwt, salt, publicKey, maxEpoch, randomness } = body;

    // Step 1: Initialize ZK Login
    if (action === 'init') {
      // Dynamic imports for Sui packages
      const { Ed25519Keypair } = await import('@mysten/sui/keypairs/ed25519');
      const { generateNonce, generateRandomness, getExtendedEphemeralPublicKey } = await import('@mysten/sui/zklogin');
      
      // Generate ephemeral keypair for this session
      const keypair = new Ed25519Keypair();
      const extendedEphemeralPublicKey = getExtendedEphemeralPublicKey(keypair.getPublicKey());
      console.log("SUI PUBKEY: " + keypair.getPublicKey().toBase64());

      // Generate random values for the ZK proof
      const randomness = generateRandomness();
      const userSalt = generateRandomness();
      
      // Get current epoch and set max epoch
      const currentEpoch = await getCurrentEpoch();
      const maxEpoch = currentEpoch + 2;
      
      // Generate nonce for OAuth flow
      const nonce = generateNonce(
        keypair.getPublicKey(),
        maxEpoch,
        randomness
      );

      // Return all necessary values for the frontend
      const response = {
        success: true,
        data: {
          publicKey: keypair.getPublicKey().toBase64(),
          extendedEphemeralPublicKey,
          randomness,
          nonce,
          maxEpoch,
          userSalt
        }
      };

      return res.json(response);
    }

    // Step 2: Complete ZK Login
    if (action === 'complete') {
      if (!jwt || !salt) {
        const response = {
          success: false,
          error: 'Missing jwt or salt'
        };
        return res.status(400).json(response);
      }

      try {
        // Get Sui address from JWT
        const { jwtToAddress } = await import('@mysten/sui/zklogin');
        const address = jwtToAddress(jwt, salt);
        
        // Return address without proof for now
        const response = {
          success: true,
          data: { 
            address
          }
        };

        return res.json(response);

        /* TODO: ZK Proof generation (currently not working)
        const proof = await getProof(
          jwt,
          body.extendedEphemeralPublicKey,
          body.maxEpoch,
          body.randomness,
          salt
        );

        return res.json({
          success: true,
          data: { 
            address,
            proof
          }
        });
        */
      } catch (error) {
        console.error('ZK Login error:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to complete ZK Login'
        });
      }
    }

    return res.status(400).json({ 
      success: false, 
      error: 'Invalid action' 
    });

  } catch (error) {
    console.error('ZK Login error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
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
  console.log(`🔐 ZK Login API available at /api/zk-login`);
  
  // Test environment variables on startup
  try {
    getAgoraCredentials();
    console.log('✅ Agora credentials loaded successfully');
  } catch (error) {
    console.error('❌ Error loading Agora credentials:', error.message);
  }
}); 