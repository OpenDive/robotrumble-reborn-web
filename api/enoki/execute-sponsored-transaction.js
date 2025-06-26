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
    const { digest, signature } = req.body;
    
    if (!digest || !signature) {
      return res.status(400).json({ error: 'Missing digest or signature' });
    }
    
    const ENOKI_PRIVATE_API_KEY = process.env.ENOKI_PRIVATE_API_KEY;
    if (!ENOKI_PRIVATE_API_KEY) {
      console.error('ENOKI_PRIVATE_API_KEY not found in environment variables');
      return res.status(500).json({ error: 'Enoki private API key not configured' });
    }
    
    console.log('🚀 Executing sponsored transaction with digest:', digest);
    
    // Step 2: Execute the sponsored transaction
    const executeResponse = await fetch(`https://api.enoki.mystenlabs.com/v1/transaction-blocks/sponsor/${digest}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ENOKI_PRIVATE_API_KEY}`,
      },
      body: JSON.stringify({
        signature: signature,
      }),
    });
    
    if (!executeResponse.ok) {
      const errorText = await executeResponse.text();
      console.error('Enoki execute error:', errorText);
      return res.status(executeResponse.status).json({ 
        error: 'Failed to execute sponsored transaction',
        details: errorText 
      });
    }
    
    const executeData = await executeResponse.json();
    console.log('✅ Sponsored transaction executed:', executeData.digest || digest);
    
    res.json(executeData);
    
  } catch (error) {
    console.error('Error executing sponsored transaction:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
} 