import { Ed25519PublicKey } from '@mysten/sui/keypairs/ed25519';

export interface ZkLoginApiState {
  keypair: {
    getPublicKey: () => Ed25519PublicKey;
  };
  publicKey: string;
  randomness: string;
  nonce: string;
  maxEpoch: number;
  userSalt: string;
}

export interface ZkLoginInitResponse {
  success: boolean;
  data?: ZkLoginState;
  error?: string;
}

export interface ZkLoginCompleteResponse {
  success: boolean;
  data?: {
    address: string;
    proof?: ProofResponse;
  };
  error?: string;
}

export interface ZkLoginState {
  publicKey: string;
  randomness: string;
  nonce: string;
  maxEpoch: number;
  userSalt: string;
  extendedEphemeralPublicKey: string;
}

export interface ProofRequest {
  jwt: string;
  extendedEphemeralPublicKey: string;
  maxEpoch: number;
  jwtRandomness: string;
  salt: string;
  keyClaimName?: string;
  nonce: string;
}

export interface ProofResponse {
  proofPoints: {
    a: [string, string];
    b: [[string, string], [string, string]];
    c: [string, string];
  };
  issBase64Details: {
    value: string;
    indexMod4: number;
  };
  headerBase64: string;
} 