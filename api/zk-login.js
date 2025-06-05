import { generateNonce, generateRandomness } from '@mysten/zklogin';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { jwtToAddress } from '@mysten/zklogin';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { action } = req.body;

    if (action === 'init') {
      // Initialize ZK Login - generate ephemeral keypair and nonce
      const ephemeralKeyPair = new Ed25519Keypair();
      const randomness = generateRandomness();
      
      // Generate max epoch (current epoch + buffer)
      const suiClient = new SuiClient({ url: getFullnodeUrl('testnet') });
      const { epoch } = await suiClient.getLatestSuiSystemState();
      const maxEpoch = Number(epoch) + 10; // 10 epoch buffer
      
      // Generate nonce
      const extendedEphemeralPublicKey = ephemeralKeyPair.getPublicKey().toSuiBytes();
      const nonce = generateNonce(extendedEphemeralPublicKey, maxEpoch, randomness);
      
      // Generate user salt
      const userSalt = generateRandomness();
      
      const zkLoginState = {
        publicKey: ephemeralKeyPair.getPublicKey().toSuiAddress(),
        randomness,
        nonce,
        maxEpoch,
        userSalt,
        extendedEphemeralPublicKey: Array.from(extendedEphemeralPublicKey).join(',')
      };

      return res.status(200).json({
        success: true,
        data: zkLoginState
      });
    }

    if (action === 'complete') {
      const { 
        jwt, 
        salt, 
        extendedEphemeralPublicKey, 
        maxEpoch, 
        randomness, 
        nonce 
      } = req.body;

      if (!jwt || !salt) {
        return res.status(400).json({ 
          success: false, 
          error: 'Missing required parameters' 
        });
      }

      try {
        // Convert extendedEphemeralPublicKey back to Uint8Array if it's a string
        const publicKeyBytes = typeof extendedEphemeralPublicKey === 'string' 
          ? new Uint8Array(extendedEphemeralPublicKey.split(',').map(x => parseInt(x)))
          : extendedEphemeralPublicKey;

        // Generate the Sui address from JWT
        const suiAddress = jwtToAddress(jwt, salt);

        return res.status(200).json({
          success: true,
          data: {
            address: suiAddress
          }
        });
      } catch (error) {
        console.error('Error generating Sui address:', error);
        return res.status(400).json({
          success: false,
          error: 'Failed to generate Sui address: ' + error.message
        });
      }
    }

    return res.status(400).json({ 
      success: false, 
      error: 'Invalid action' 
    });

  } catch (error) {
    console.error('ZK Login API error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error: ' + error.message 
    });
  }
} 