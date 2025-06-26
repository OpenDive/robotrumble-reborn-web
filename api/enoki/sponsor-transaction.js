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

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { transactionBlockKindBytes, zkLoginJwt } = req.body;
    
    if (!transactionBlockKindBytes || !zkLoginJwt) {
      return res.status(400).json({ error: 'Missing transactionBlockKindBytes or zkLoginJwt' });
    }
    
    const ENOKI_PRIVATE_API_KEY = process.env.ENOKI_PRIVATE_API_KEY;
    if (!ENOKI_PRIVATE_API_KEY) {
      console.error('ENOKI_PRIVATE_API_KEY not found in environment variables');
      return res.status(500).json({ error: 'Enoki private API key not configured' });
    }
    
    console.log('🎯 Sponsoring transaction via Enoki...');
    
    // Step 1: Sponsor the transaction
    // Send the base64 string directly to Enoki API (it expects a string, not array)
    const sponsorResponse = await fetch('https://api.enoki.mystenlabs.com/v1/transaction-blocks/sponsor', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ENOKI_PRIVATE_API_KEY}`,
        'zklogin-jwt': zkLoginJwt,
      },
      body: JSON.stringify({
        network: 'testnet',
        transactionBlockKindBytes: transactionBlockKindBytes,
      }),
    });
    
    if (!sponsorResponse.ok) {
      const errorText = await sponsorResponse.text();
      console.error('Enoki sponsor error:', errorText);
      return res.status(sponsorResponse.status).json({ 
        error: 'Failed to sponsor transaction',
        details: errorText 
      });
    }
    
    const sponsorData = await sponsorResponse.json();
    console.log('🔍 Full Enoki sponsor response:', JSON.stringify(sponsorData, null, 2));
    
    // Extract data from nested structure
    const digest = sponsorData.data?.digest || sponsorData.digest;
    const transactionBlockBytes = sponsorData.data?.bytes || sponsorData.transactionBlockBytes;
    
    console.log('✅ Transaction sponsored, digest:', digest);
    console.log('✅ Transaction bytes length:', transactionBlockBytes?.length);
    
    if (!digest || !transactionBlockBytes) {
      console.error('❌ Missing required fields in Enoki response');
      return res.status(500).json({ error: 'Invalid response from Enoki API' });
    }
    
    res.json({
      transactionBlockBytes: transactionBlockBytes,
      digest: digest
    });
    
  } catch (error) {
    console.error('Error sponsoring transaction:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
} 