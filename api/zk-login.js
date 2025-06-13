const { generateNonce, generateRandomness, jwtToAddress } = require('@mysten/zklogin');
const { Ed25519Keypair } = require('@mysten/sui/keypairs/ed25519');
const { SuiClient, getFullnodeUrl } = require('@mysten/sui/client');

module.exports = async function handler(req, res) {
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
      // Get existing salt from frontend if available
      const { existingSalt } = req.body;
      
      // Initialize ZK Login - generate ephemeral keypair and nonce
      const ephemeralKeyPair = new Ed25519Keypair();
      const randomness = generateRandomness();
      
      // Generate max epoch (current epoch + buffer)
      const suiClient = new SuiClient({ url: getFullnodeUrl('testnet') });
      const { epoch } = await suiClient.getLatestSuiSystemState();
      console.log('🌐 Current blockchain epoch:', epoch);
      console.log('🌐 Epoch type:', typeof epoch);
      
      const currentEpoch = Number(epoch);
      const maxEpoch = currentEpoch + 2; // 2 epoch buffer (1 epoch ~= 24h)
      
      console.log('🌐 Computed maxEpoch:', maxEpoch);
      
      // Validation: maxEpoch should be reasonable (current + small buffer)
      if (maxEpoch > currentEpoch + 10) {
        console.error('❌ MaxEpoch calculation error - too large:', { epoch, currentEpoch, maxEpoch });
        throw new Error('Invalid epoch calculation');
      }
      
      // Generate nonce
      const extendedEphemeralPublicKey = ephemeralKeyPair.getPublicKey().toSuiBytes();
      const nonce = generateNonce(extendedEphemeralPublicKey, maxEpoch, randomness);
      
      // Use existing salt or generate new one only if none exists
      const userSalt = existingSalt || generateRandomness();
      if (existingSalt) {
        console.log('🧂 Using existing user salt for consistent address');
      } else {
        console.log('🧂 Generated new user salt - will be stored by frontend');
      }
      
      const zkLoginState = {
        publicKey: ephemeralKeyPair.getPublicKey().toSuiAddress(),
        randomness,
        nonce,
        maxEpoch,
        userSalt, // This will be the persistent salt
        extendedEphemeralPublicKey: Array.from(extendedEphemeralPublicKey).join(','),
        // Store ephemeral keypair as serializable data for transaction signing
        ephemeralKeypair: {
          privateKey: ephemeralKeyPair.getSecretKey(),
          publicKey: ephemeralKeyPair.getPublicKey().toBase64()
        }
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
}; 