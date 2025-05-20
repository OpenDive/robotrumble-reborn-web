/// <reference types="vite/client" />

// Environment configuration
export const isDebugEnabled = import.meta.env.DEV || import.meta.env.VITE_DEBUG_TOOLS_ENABLED === 'true';
// export const isDebugEnabled = false;

export const videoSourceConfig = {
  defaultSource: import.meta.env.VITE_VIDEO_SOURCE || (import.meta.env.DEV ? 'webcam' : 'webrtc'),
  webcam: {
    width: 1280,
    height: 720
  },
  webrtc: {
    signalingUrl: import.meta.env.VITE_WEBRTC_SIGNALING_URL || 'wss://signaling.robotrumble.com',
    iceServers: import.meta.env.VITE_WEBRTC_ICE_SERVERS?.split(',') || [
      'stun:stun.l.google.com:19302',
      'stun:stun1.l.google.com:19302'
    ]
  }
};
