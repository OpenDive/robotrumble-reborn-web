# ZkLogin Setup Guide

This guide will help you set up ZkLogin with Google OAuth for your Robot Karts application.

## Prerequisites

1. Node.js and npm installed
2. A Google Cloud Platform account
3. Basic understanding of OAuth 2.0

## Google OAuth Setup

### 1. Create a Google Cloud Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API and Google OAuth2 API

### 2. Configure OAuth Consent Screen

1. Go to "APIs & Services" > "OAuth consent screen"
2. Choose "External" user type
3. Fill in the required information:
   - App name: "Robot Karts"
   - User support email: Your email
   - Developer contact information: Your email
4. Add scopes: `email`, `profile`, `openid`
5. Add test users if needed

### 3. Create OAuth Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client IDs"
3. Choose "Web application"
4. Add authorized redirect URIs:
   - `http://localhost:5173/auth/callback` (for development)
   - `https://yourdomain.com/auth/callback` (for production)
5. Save the Client ID and Client Secret

## Environment Variables

Create a `.env` file in your project root with the following variables:

```env
# Agora Configuration (existing)
VITE_AGORA_APP_ID=your_agora_app_id
AGORA_APP_CERTIFICATE=your_agora_app_certificate

# Google OAuth Configuration
VITE_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
VITE_GOOGLE_CLIENT_SECRET=your_google_client_secret

# Development URLs
VITE_API_URL=http://localhost:3001
```

## Installation

The required dependencies have already been installed:

```bash
npm install @mysten/sui jwt-decode
```

## How It Works

1. **Initialization**: When a user clicks "Login with Google", the app initializes ZkLogin by calling `/api/zk-login` with `action: 'init'`
2. **OAuth Flow**: The user is redirected to Google's OAuth consent screen
3. **Callback**: Google redirects back to `/auth/callback` with an authorization code
4. **Token Exchange**: The app exchanges the code for an ID token
5. **ZkLogin Completion**: The ID token is sent to `/api/zk-login` with `action: 'complete'` to generate a Sui address
6. **User Session**: The user is logged in with their Sui address and profile information

## File Structure

```
src/
├── shared/
│   ├── contexts/
│   │   └── AuthContext.tsx          # Authentication context
│   ├── types/
│   │   └── zkLogin.ts              # ZkLogin type definitions
│   └── utils/
│       └── zkLogin.ts              # ZkLogin utility functions
└── ui-layer/
    └── components/
        └── shared/
            └── GoogleSignIn.tsx     # Google Sign-In component

server/
└── dev-server.js                   # Express server with ZkLogin API
```

## Testing

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Navigate to `http://localhost:5173`
3. Click "Login with Google" on the login screen
4. Complete the OAuth flow
5. Check the browser console for ZkLogin logs

## Troubleshooting

### Common Issues

1. **"redirect_uri_mismatch" error**: Make sure your redirect URI in Google Cloud Console matches exactly with your app's callback URL
2. **CORS errors**: Ensure your server is running on the correct port (3001)
3. **ZkLogin initialization fails**: Check that the Sui packages are properly installed

### Debug Logs

The application logs detailed information to the browser console:
- ZkLogin initialization
- OAuth token exchange
- Sui address generation

## Security Notes

1. Never expose your Google Client Secret in the frontend
2. In production, implement proper token validation
3. Consider implementing token refresh for long-lived sessions
4. Store sensitive data securely (avoid localStorage for production tokens)

## Next Steps

1. Set up your Google OAuth credentials
2. Add your environment variables
3. Test the login flow
4. Customize the UI as needed
5. Implement additional wallet connection options 