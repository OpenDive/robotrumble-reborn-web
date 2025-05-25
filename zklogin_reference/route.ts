import { NextResponse } from 'next/server';
import { getCurrentEpoch, getProof } from './utils';
import type { ZkLoginInitResponse, ZkLoginCompleteResponse } from './types';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, jwt, salt, publicKey, maxEpoch, randomness } = body;

    // Step 1: Initialize ZK Login
    if (action === 'init') {
      // Import required libraries
      const { Ed25519Keypair } = require('@mysten/sui/keypairs/ed25519');
      const { generateNonce, generateRandomness, getExtendedEphemeralPublicKey } = require('@mysten/zklogin');
      
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
      const response: ZkLoginInitResponse = {
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

      return NextResponse.json(response);
    }

    // Step 2: Complete ZK Login
    if (action === 'complete') {
      if (!jwt || !salt) {
        const response: ZkLoginCompleteResponse = {
          success: false,
          error: 'Missing jwt or salt'
        };
        return NextResponse.json(response, { status: 400 });
      }

      try {
        // Get Sui address from JWT
        const { jwtToAddress } = require('@mysten/zklogin');
        const address = await jwtToAddress(jwt, salt);
        
        // Return address without proof for now
        const response: ZkLoginCompleteResponse = {
          success: true,
          data: { 
            address
          }
        };

        return NextResponse.json(response);

        /* TODO: ZK Proof generation (currently not working)
        const proof = await getProof(
          jwt,
          body.extendedEphemeralPublicKey,
          body.maxEpoch,
          body.randomness,
          salt
        );

        return NextResponse.json({
          success: true,
          data: { 
            address,
            proof
          }
        });
        */
      } catch (error) {
        console.error('ZK Login error:', error);
        return NextResponse.json({
          success: false,
          error: 'Failed to complete ZK Login'
        }, { status: 500 });
      }
    }

    return NextResponse.json({ 
      success: false, 
      error: 'Invalid action' 
    }, { status: 400 });

  } catch (error) {
    console.error('ZK Login error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
} 