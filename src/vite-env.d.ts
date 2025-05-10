/// <reference types="vite/client" />

// Extend Vite's ImportMetaEnv
declare module 'vite/client' {
  interface ImportMetaEnv {
    readonly VITE_DEBUG_TOOLS_ENABLED: string;
    readonly VITE_VIDEO_SOURCE: 'webcam' | 'webrtc' | 'test-video';
    readonly VITE_WEBRTC_SIGNALING_URL: string;
    readonly VITE_WEBRTC_ICE_SERVERS?: string;
  }
}
