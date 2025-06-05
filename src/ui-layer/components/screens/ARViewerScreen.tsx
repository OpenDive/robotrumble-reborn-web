import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import AgoraRTC, { IAgoraRTCClient, IRemoteVideoTrack, IRemoteAudioTrack } from 'agora-rtc-sdk-ng';
import { Button } from '../shared/Button';
import { RaceSession } from '../../../shared/types/race';
import { APP_ID, fetchToken } from '../../../shared/utils/agoraAuth';
import { EnhancedARDetector, DetectedMarker } from '../../../engine-layer/core/ar/EnhancedARDetector';
import { GameRenderSystem } from '../../../engine-layer/core/renderer/GameRenderSystem';
import SuiWalletConnect from '../shared/SuiWalletConnect';

interface ARViewerScreenProps {
  session: RaceSession;
  onBack: () => void;
}

interface RemoteUser {
  uid: number;
  videoTrack?: IRemoteVideoTrack;
  audioTrack?: IRemoteAudioTrack;
  isHost?: boolean;
  hasVideo?: boolean;
  hasAudio?: boolean;
}

interface DeliveryPoint {
  row: number;
  col: number;
  id: string;
}

interface Robot {
  id: string;
  name: string;
  position: { x: number; y: number };
  status: 'idle' | 'moving' | 'delivering' | 'offline';
  battery: number;
}

export const ARViewerScreen: React.FC<ARViewerScreenProps> = ({ session, onBack }) => {
  const mainViewRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  
  // Agora refs
  const rtcClientRef = useRef<IAgoraRTCClient | null>(null);
  
  // Full AR System refs
  const arDetectorRef = useRef<EnhancedARDetector | null>(null);
  const renderSystemRef = useRef<GameRenderSystem | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  // Streaming state
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [localUid, setLocalUid] = useState<number | null>(null);
  const [remoteUsers, setRemoteUsers] = useState<Map<number, RemoteUser>>(new Map());
  const [hostUser, setHostUser] = useState<RemoteUser | null>(null);
  const [viewerUsers, setViewerUsers] = useState<Map<number, RemoteUser>>(new Map());
  
  // Local media state for viewer chat
  const [localVideoTrack, setLocalVideoTrack] = useState<any>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<any>(null);
  const [isCameraEnabled, setIsCameraEnabled] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  
  // AR state
  const [arInitialized, setArInitialized] = useState(false);
  const [detectedMarkers, setDetectedMarkers] = useState<DetectedMarker[]>([]);
  const [arEffectsEnabled, setArEffectsEnabled] = useState(true);
  
  // Track created video containers to prevent duplicates
  const createdVideoContainers = useRef<Set<number>>(new Set());
  
  // Track processed video tracks to prevent duplicate processing
  const processedVideoTracks = useRef<Set<string>>(new Set());

  // Delivery control state (read-only for viewers)
  const [startPoint, setStartPoint] = useState<DeliveryPoint | null>(null);
  const [endPoint, setEndPoint] = useState<DeliveryPoint | null>(null);
  const [robots, setRobots] = useState<Robot[]>([
    { id: 'robot-a', name: 'Robot A', position: { x: 80, y: 20 }, status: 'idle', battery: 85 },
    { id: 'robot-b', name: 'Robot B', position: { x: 20, y: 70 }, status: 'idle', battery: 92 }
  ]);
  const [deliveryStatus, setDeliveryStatus] = useState<string>('waiting');
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'processing' | 'confirmed' | 'failed'>('pending');
  const [deliveryCost] = useState(0.5);

  // AR effects toggle handler
  const toggleAREffects = () => {
    const newEnabled = !arEffectsEnabled;
    setArEffectsEnabled(newEnabled);
    
    if (renderSystemRef.current) {
      renderSystemRef.current.setAREffectsEnabled(newEnabled);
      
      // If enabling AR effects, update with current markers
      if (newEnabled && detectedMarkers.length > 0) {
        renderSystemRef.current.updateAREffects(detectedMarkers);
      }
    }
  };

  // Toggle camera for viewer chat
  const toggleCamera = async () => {
    try {
      setMediaError(null);
      
      if (!isCameraEnabled) {
        // Enable camera
        console.log('🎥 Enabling camera...');
        const videoTrack = await AgoraRTC.createCameraVideoTrack({
          optimizationMode: 'detail',
          encoderConfig: '480p_1'
        });
        
        setLocalVideoTrack(videoTrack);
        setIsCameraEnabled(true);
        
        // Publish the video track if connected
        if (rtcClientRef.current && isConnected) {
          await rtcClientRef.current.publish([videoTrack]);
          console.log('📤 Published camera video');
        }
        
        // Play video in local viewer tile
        if (localVideoRef.current) {
          videoTrack.play(localVideoRef.current);
          console.log('📺 Playing local video in viewer tile');
        }
      } else {
        // Disable camera
        console.log('🎥❌ Disabling camera...');
        
        if (localVideoTrack) {
          // Unpublish first if connected
          if (rtcClientRef.current && isConnected) {
            await rtcClientRef.current.unpublish([localVideoTrack]);
            console.log('📤❌ Unpublished camera video');
          }
          
          // Stop and close the track
          localVideoTrack.stop();
          localVideoTrack.close();
          setLocalVideoTrack(null);
        }
        
        setIsCameraEnabled(false);
      }
    } catch (error) {
      console.error('Error toggling camera:', error);
      setMediaError(`Camera error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // Toggle microphone for viewer chat
  const toggleMicrophone = async () => {
    try {
      setMediaError(null);
      
      if (!isMicEnabled) {
        // Enable microphone
        console.log('🎤 Enabling microphone...');
        const audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
          encoderConfig: 'music_standard'
        });
        
        setLocalAudioTrack(audioTrack);
        setIsMicEnabled(true);
        
        // Publish the audio track if connected
        if (rtcClientRef.current && isConnected) {
          await rtcClientRef.current.publish([audioTrack]);
          console.log('📤 Published microphone audio');
        }
      } else {
        // Disable microphone
        console.log('🎤❌ Disabling microphone...');
        
        if (localAudioTrack) {
          // Unpublish first if connected
          if (rtcClientRef.current && isConnected) {
            await rtcClientRef.current.unpublish([localAudioTrack]);
            console.log('📤❌ Unpublished microphone audio');
          }
          
          // Stop and close the track
          localAudioTrack.stop();
          localAudioTrack.close();
          setLocalAudioTrack(null);
        }
        
        setIsMicEnabled(false);
      }
    } catch (error) {
      console.error('Error toggling microphone:', error);
      setMediaError(`Microphone error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // Initialize full AR system with complete 3D scene
  const initializeAROverlay = async () => {
    if (!canvasRef.current || arInitialized) return;
    
    try {
      console.log('Initializing full AR system for viewer...');
      
      // Ensure canvas matches its container size (like ARStreamScreen.tsx)
      const container = canvasRef.current.parentElement;
      if (container) {
        const rect = container.getBoundingClientRect();
        canvasRef.current.width = rect.width;
        canvasRef.current.height = rect.height;
        console.log(`AR Canvas sized to container: ${rect.width}x${rect.height}`);
      }
      
      // Create full GameRenderSystem for complete 3D AR experience
      const renderSystem = new GameRenderSystem();
      renderSystemRef.current = renderSystem;
      
      // Initialize with transparent background for overlay
      renderSystem.initialize(canvasRef.current);
      
      // Set AR mode to enable transparent rendering
      renderSystem.setARMode(true);
      
      // Enable AR effects by default
      renderSystem.setAREffectsEnabled(arEffectsEnabled);
      
      // Create AR detector for marker detection
      const arDetector = new EnhancedARDetector((message) => {
        console.log(`[AR Viewer] ${message}`);
      });
      arDetectorRef.current = arDetector;
      
      // Get scene and camera from render system
      const scene = renderSystem.getScene();
      const camera = renderSystem.getCamera();
      
      // Initialize AR detector with full 3D context
      await arDetector.initialize(scene || undefined, camera || undefined);
      
      // Start full AR rendering loop
      startARRenderingLoop();
      
      setArInitialized(true);
      console.log('Full AR system initialized for viewer');
    } catch (error) {
      console.error('Failed to initialize AR system:', error);
    }
  };

  // Full AR rendering loop with complete 3D scene
  const startARRenderingLoop = () => {
    if (!arDetectorRef.current || !renderSystemRef.current) return;
    
    let frameCount = 0;
    
    const renderLoop = () => {
      frameCount++;
      
      // Run AR detection on host video
      if (hostVideoRef.current && arDetectorRef.current) {
        // Check video readiness every 60 frames (roughly once per second at 60fps)
        if (frameCount % 60 === 0) {
          const video = hostVideoRef.current;
          console.log(`AR Detection Status - Video ready: ${video.videoWidth}x${video.videoHeight}, Current time: ${video.currentTime}, Paused: ${video.paused}`);
        }
        
        const markers = arDetectorRef.current.detectMarkers(hostVideoRef.current);
        
        if (markers.length > 0) {
          console.log(`[AR Viewer] Detected ${markers.length} markers on host stream`);
        }
        
        setDetectedMarkers(markers);
        
        // Update AR markers in the full 3D scene
        if (renderSystemRef.current) {
          renderSystemRef.current.updateAREffects(markers);
          
          // Set AR effects visibility
          renderSystemRef.current.setAREffectsEnabled(arEffectsEnabled);
          
          // Render the complete 3D AR scene
          renderSystemRef.current.render();
        }
      }
      
      animationFrameRef.current = requestAnimationFrame(renderLoop);
    };
    
    animationFrameRef.current = requestAnimationFrame(renderLoop);
  };

  // Cleanup full AR system
  const cleanupAROverlay = () => {
    console.log('Cleaning up AR system...');
    
    // Stop animation loop
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    // Dispose render system
    if (renderSystemRef.current) {
      renderSystemRef.current.dispose();
      renderSystemRef.current = null;
    }
    
    if (arDetectorRef.current) {
      arDetectorRef.current.dispose();
      arDetectorRef.current = null;
    }
    
    setArInitialized(false);
    setDetectedMarkers([]);
  };

  // Connect to stream
  const connectToStream = async () => {
    try {
      setConnectionError(null);
      console.log('Connecting to stream...');
      
      // Create Agora client
      const client = AgoraRTC.createClient({ mode: 'live', codec: 'h264' });
      rtcClientRef.current = client;
      
      // Set up client events
      client.on('user-joined', (user) => {
        console.log(`🟢 User ${user.uid} joined the channel`);
        
        // Add user to remoteUsers immediately when they join
        setRemoteUsers(prev => {
          const newMap = new Map(prev);
          const newUser: RemoteUser = { uid: user.uid as number };
          newMap.set(user.uid as number, newUser);
          console.log(`📊 Updated remoteUsers, now has ${newMap.size} users:`, Array.from(newMap.keys()));
          return newMap;
        });
      });
      
      client.on('user-published', async (user, mediaType) => {
        console.log(`📺 User ${user.uid} published ${mediaType} - attempting to subscribe...`);
        
        try {
          await client.subscribe(user, mediaType);
          console.log(`✅ Successfully subscribed to ${mediaType} from user ${user.uid}`);
        } catch (subscribeError) {
          console.error(`❌ Failed to subscribe to ${mediaType} from user ${user.uid}:`, subscribeError);
          return;
        }
        
        setRemoteUsers(prev => {
          const newMap = new Map(prev);
          const existingUser = newMap.get(user.uid as number) || { uid: user.uid as number };
          
          if (mediaType === 'video' && user.videoTrack) {
            console.log(`🎥 Processing video track for user ${user.uid}`);
            console.log(`📊 Video track details:`, {
              trackId: user.videoTrack.getTrackId(),
              hasVideoTrack: !!user.videoTrack
            });
            
            // Check if we've already processed this exact video track
            const trackId = user.videoTrack.getTrackId();
            if (processedVideoTracks.current.has(trackId)) {
              console.log(`⚠️ Video track ${trackId} already processed, skipping`);
              return newMap;
            }
            
            // Mark this track as processed
            processedVideoTracks.current.add(trackId);
            
            existingUser.videoTrack = user.videoTrack;
            existingUser.hasVideo = true;
            
            // Determine if this is the host (first video publisher or has higher authority)
            // For simplicity, treat the first video publisher as host
            if (!hostUser) {
              console.log(`👑 User ${user.uid} is now the HOST - setting up main video display`);
              // This is the host - display in main view with AR
              existingUser.isHost = true;
              setHostUser(existingUser);
              
              // Remove this user's tile from participant grid since they're now the host
              const existingTile = document.getElementById(`participant-${user.uid}`);
              if (existingTile) {
                existingTile.remove();
                console.log(`🗑️ Removed host tile from participant grid for user ${user.uid}`);
              }
              
              // Instead of complex streaming, just play the same drone video locally
              setTimeout(() => {
                console.log(`🎬 Starting local drone video for synchronized viewing`);
                
                // Create main video view
                const mainContainer = document.createElement('div');
                mainContainer.id = `main-drone-video`;
                mainContainer.className = 'absolute inset-0 w-full h-full bg-black';
                
                const droneVideo = document.createElement('video');
                droneVideo.className = 'w-full h-full object-cover';
                droneVideo.autoplay = true;
                droneVideo.playsInline = true;
                droneVideo.muted = true;
                droneVideo.loop = true;
                droneVideo.style.transform = 'scaleX(-1)'; // Mirror the video
                droneVideo.style.filter = 'brightness(0.7)'; // Match host screen brightness
                droneVideo.id = `drone-video`;
                droneVideo.src = '/assets/videos/drone1.mov'; // Play the drone video locally
                
                console.log(`🎥 Loading drone video locally for synchronized viewing`);
                
                // Add event listeners for debugging
                droneVideo.addEventListener('loadeddata', () => {
                  console.log(`📹 Local drone video loaded: ${droneVideo.videoWidth}x${droneVideo.videoHeight}`);
                });
                
                droneVideo.addEventListener('playing', () => {
                  console.log(`📹 Local drone video is playing`);
                });
                
                droneVideo.addEventListener('error', async (e) => {
                  console.error(`❌ Local drone video error:`, e);
                  console.log('🔄 Fallback to webcam for synchronized viewing...');
                  
                  try {
                    // Fallback to webcam
                    const stream = await navigator.mediaDevices.getUserMedia({ 
                      video: { 
                        facingMode: 'environment',
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                      } 
                    });
                    
                    console.log('📹 Webcam access granted for viewer');
                    
                    // Replace drone video with webcam video
                    droneVideo.srcObject = stream;
                    droneVideo.src = ''; // Clear the src
                    droneVideo.style.transform = 'scaleX(-1)'; // Mirror webcam
                    
                    console.log('✅ Using webcam as fallback for synchronized viewing');
                  } catch (webcamError) {
                    console.error('❌ Failed to access webcam as fallback:', webcamError);
                    
                    // Show error message in video container
                    mainContainer.innerHTML = `
                      <div class="w-full h-full flex items-center justify-center bg-gray-800 text-white">
                        <div class="text-center">
                          <p class="text-lg font-semibold mb-2">Video Source Error</p>
                          <p class="text-sm">Failed to load demo video and camera</p>
                        </div>
                      </div>
                    `;
                  }
                });
                
                mainContainer.appendChild(droneVideo);
                
                // Store reference for AR detection
                hostVideoRef.current = droneVideo;
                
                // Add to main view container
                if (mainViewRef.current) {
                  console.log(`📺 Adding local drone video to main view`);
                  mainViewRef.current.appendChild(mainContainer);
                  
                  // Start playing the video
                  droneVideo.play().then(() => {
                    console.log(`✅ Local drone video started playing successfully`);
                    
                    // Initialize AR overlay once video is playing
                    setTimeout(() => {
                      if (droneVideo.videoWidth > 0 && droneVideo.videoHeight > 0) {
                        console.log(`📐 Video dimensions ready: ${droneVideo.videoWidth}x${droneVideo.videoHeight}`);
                        initializeAROverlay();
                      }
                    }, 500);
                    
                  }).catch((playError) => {
                    console.error(`❌ Failed to play local drone video:`, playError);
                    // Error handler above will handle fallback to webcam
                  });
                } else {
                  console.error(`❌ mainViewRef.current is null`);
                }
              }, 500);
            } else {
              console.log(`👥 User ${user.uid} is a VIEWER with video`);
              // This is a viewer - display in participant tile (tile already exists from user-joined)
              existingUser.isHost = false;
              setViewerUsers(prev => new Map(prev.set(user.uid as number, existingUser)));
              
              setTimeout(() => {
                const videoElement = document.getElementById(`video-${user.uid}`) as HTMLVideoElement;
                const avatarElement = document.getElementById(`avatar-${user.uid}`);
                const statusElement = document.getElementById(`status-${user.uid}`);
                
                if (videoElement && avatarElement && statusElement) {
                  // Play video in tile
                  user.videoTrack!.play(videoElement);
                  
                  // Show video, hide avatar
                  videoElement.classList.remove('hidden');
                  avatarElement.style.display = 'none';
                  statusElement.textContent = 'Live';
                  
                  console.log(`📱 Viewer video displayed in tile for user ${user.uid}`);
                } else {
                  console.log(`❌ Could not find video elements for user ${user.uid}`);
                }
              }, 100);
            }
          }
          
          if (mediaType === 'audio' && user.audioTrack) {
            console.log(`🎤 Processing audio track for user ${user.uid}`);
            existingUser.audioTrack = user.audioTrack;
            existingUser.hasAudio = true;
            user.audioTrack.play();
            console.log(`🔊 Playing audio for user ${user.uid}`);
          }
          
          newMap.set(user.uid as number, existingUser);
          console.log(`📊 After user-published, remoteUsers has ${newMap.size} users:`, Array.from(newMap.keys()));
          return newMap;
        });
      });
      
      client.on('user-unpublished', (user, mediaType) => {
        console.log(`🔇 User ${user.uid} unpublished ${mediaType}`);
        
        if (mediaType === 'video') {
          const remoteUser = remoteUsers.get(user.uid as number);
          if (remoteUser?.isHost) {
            // Host stopped streaming - clean up main view and AR
            const mainContainer = document.getElementById(`main-host-${user.uid}`);
            if (mainContainer) {
              mainContainer.remove();
            }
            cleanupAROverlay();
            setHostUser(null);
            console.log(`👑❌ Host ${user.uid} stopped streaming`);
          } else {
            // Viewer stopped streaming - update tile
            const videoElement = document.getElementById(`video-${user.uid}`) as HTMLVideoElement;
            const avatarElement = document.getElementById(`avatar-${user.uid}`);
            const statusElement = document.getElementById(`status-${user.uid}`);
            
            if (videoElement && avatarElement && statusElement) {
              videoElement.classList.add('hidden');
              avatarElement.style.display = 'flex';
              statusElement.textContent = 'Offline';
            }
            console.log(`👥📴 Viewer ${user.uid} stopped video`);
          }
        }
        
        setRemoteUsers(prev => {
          const newMap = new Map(prev);
          const existingUser = newMap.get(user.uid as number);
          if (existingUser) {
            if (mediaType === 'video') {
              delete existingUser.videoTrack;
              existingUser.hasVideo = false;
            }
            if (mediaType === 'audio') {
              delete existingUser.audioTrack;
              existingUser.hasAudio = false;
            }
            
            // Keep the user in remoteUsers even if they're not publishing
            newMap.set(user.uid as number, existingUser);
          }
          console.log(`📊 After user-unpublished, remoteUsers has ${newMap.size} users:`, Array.from(newMap.keys()));
          return newMap;
        });
      });
      
      client.on('user-left', (user) => {
        console.log(`🔴 User ${user.uid} left the channel`);
        
        // Remove from video container tracking
        createdVideoContainers.current.delete(user.uid as number);
        
        // Remove from processed tracks (clean up any tracks from this user)
        const userTracks = Array.from(processedVideoTracks.current).filter(trackId => 
          trackId.includes(`-${user.uid}-`)
        );
        userTracks.forEach(trackId => processedVideoTracks.current.delete(trackId));
        
        // Remove participant tile
        const userTile = document.getElementById(`participant-${user.uid}`);
        if (userTile) {
          userTile.remove();
          console.log(`🗑️ Removed tile for user ${user.uid}`);
        }
        
        // If host left, clean up main view
        const remoteUser = remoteUsers.get(user.uid as number);
        if (remoteUser?.isHost) {
          const mainContainer = document.getElementById(`main-host-${user.uid}`);
          if (mainContainer) {
            mainContainer.remove();
          }
          cleanupAROverlay();
          setHostUser(null);
          console.log(`👑🚪 Host ${user.uid} left`);
        }
        
        setRemoteUsers(prev => {
          const newMap = new Map(prev);
          newMap.delete(user.uid as number);
          console.log(`📊 After user-left, remoteUsers has ${newMap.size} users:`, Array.from(newMap.keys()));
          return newMap;
        });
        
        setViewerUsers(prev => {
          const newMap = new Map(prev);
          newMap.delete(user.uid as number);
          return newMap;
        });
      });
      
      // Set client role to host (not audience) so that host can detect when we join
      // This follows the same pattern as the reference implementation
      await client.setClientRole('host');
      
      // Generate UID
      const uid = Math.floor(Math.random() * 100000);
      setLocalUid(uid);
      
      // Join channel
      const token = await fetchToken(session.id, uid, 'host');
      await client.join(APP_ID, session.id, token, uid);
      console.log(`Joined channel ${session.id} with UID ${uid} as viewer`);
      
      // Auto-publish local media if already enabled
      const tracksToPublish = [];
      if (localVideoTrack && isCameraEnabled) {
        tracksToPublish.push(localVideoTrack);
        console.log('📤 Auto-publishing existing camera video');
      }
      if (localAudioTrack && isMicEnabled) {
        tracksToPublish.push(localAudioTrack);
        console.log('📤 Auto-publishing existing microphone audio');
      }
      
      if (tracksToPublish.length > 0) {
        await client.publish(tracksToPublish);
        console.log(`📤 Published ${tracksToPublish.length} existing media tracks`);
      }
      
      setIsConnected(true);
      setConnectionError(null);
      console.log('✅ Connected to stream successfully');
      
      // Add periodic debugging to monitor connection state
      const debugInterval = setInterval(() => {
        console.log('🔍 DEBUG STATE CHECK:');
        console.log(`  - Local UID: ${localUid}`);
        console.log(`  - Remote Users: ${remoteUsers.size}`, Array.from(remoteUsers.keys()));
        console.log(`  - Host User: ${hostUser ? `User ${hostUser.uid}` : 'None'}`);
        console.log(`  - Viewer Users: ${viewerUsers.size}`, Array.from(viewerUsers.keys()));
        console.log(`  - Client connection state:`, rtcClientRef.current?.connectionState);
        console.log(`  - AR initialized:`, arInitialized);
      }, 15000); // Every 15 seconds
      
      // Store debug interval for cleanup
      (rtcClientRef.current as any)._debugInterval = debugInterval;
    } catch (error) {
      console.error('Error connecting to stream:', error);
      setConnectionError(`Failed to connect: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // Disconnect from stream
  const disconnectFromStream = async () => {
    try {
      // Clean up AR overlay first
      cleanupAROverlay();
      
      // Clean up local media tracks
      if (localVideoTrack) {
        localVideoTrack.stop();
        localVideoTrack.close();
        setLocalVideoTrack(null);
      }
      
      if (localAudioTrack) {
        localAudioTrack.stop();
        localAudioTrack.close();
        setLocalAudioTrack(null);
      }
      
      setIsCameraEnabled(false);
      setIsMicEnabled(false);
      setMediaError(null);

      if (rtcClientRef.current) {
        // Clean up debug interval
        if ((rtcClientRef.current as any)._debugInterval) {
          clearInterval((rtcClientRef.current as any)._debugInterval);
          console.log('🧹 Cleaned up debug interval');
        }
        
        // Leave channel
        await rtcClientRef.current.leave();
        
        // Clear refs
        rtcClientRef.current = null;
      }
      
      // Clear all containers
      if (mainViewRef.current) {
        mainViewRef.current.innerHTML = '';
      }
      const participantGrid = document.getElementById('participant-grid');
      if (participantGrid) {
        participantGrid.innerHTML = '';
      }
      
      // Clean up drone video container
      const droneContainer = document.getElementById('main-drone-video');
      if (droneContainer) {
        droneContainer.remove();
        console.log('🗑️ Cleaned up drone video container');
      }
      
      setIsConnected(false);
      setLocalUid(null);
      setRemoteUsers(new Map());
      setHostUser(null);
      setViewerUsers(new Map());
      
      // Clear video container tracking
      createdVideoContainers.current.clear();
      
      // Clear processed video tracks
      processedVideoTracks.current.clear();
      
      console.log('Disconnected from stream');
    } catch (error) {
      console.error('Error disconnecting from stream:', error);
    }
  };

  // Handle window resize
  useEffect(() => {
    // Set up resize observer for canvas sizing (like ARStreamScreen.tsx)
    let resizeObserver: ResizeObserver | null = null;
    
    if (canvasRef.current) {
      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (canvasRef.current) {
            canvasRef.current.width = width;
            canvasRef.current.height = height;
            console.log(`AR Canvas resized to: ${width}x${height}`);
            
            // Update render system if it exists
            if (renderSystemRef.current) {
              renderSystemRef.current.resize();
            }
          }
        }
      });
      
      resizeObserver.observe(canvasRef.current.parentElement || canvasRef.current);
    }

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupAROverlay();
      disconnectFromStream();
    };
  }, []);

  return (
    <div className="w-full h-screen bg-[#0B0B1A] relative overflow-hidden flex flex-col">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-radial from-transparent via-[#0B0B1A]/80 to-[#0B0B1A]"/>
      
      {/* Header */}
      <div className="relative z-30 bg-gradient-to-r from-game-900/50 via-game-800/50 to-game-900/50 backdrop-blur-sm border-b border-white/5 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="secondary"
              size="small"
              onClick={onBack}
              className="!bg-white/5 hover:!bg-white/10"
            >
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </Button>
            <div>
              <h1 className="text-xl font-bold text-white">{session.trackName}</h1>
              <p className="text-sm text-white/70">Multi-Viewer AR Stream {arInitialized && '(AR Active)'}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Camera Toggle */}
            {isConnected && (
              <Button
                variant="secondary"
                size="small"
                onClick={toggleCamera}
                className={`${isCameraEnabled ? '!bg-blue-600 hover:!bg-blue-700' : '!bg-white/10 hover:!bg-white/20'}`}
              >
                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {isCameraEnabled ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18 21l-4.95-4.95m0 0L5.636 5.636M18.364 18.364L12 12" />
                  )}
                </svg>
                {isCameraEnabled ? 'Camera On' : 'Camera Off'}
              </Button>
            )}

            {/* Microphone Toggle */}
            {isConnected && (
              <Button
                variant="secondary"
                size="small"
                onClick={toggleMicrophone}
                className={`${isMicEnabled ? '!bg-green-600 hover:!bg-green-700' : '!bg-white/10 hover:!bg-white/20'}`}
              >
                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {isMicEnabled ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-3a1 1 0 011-1h1m0 0V7a3 3 0 013-3m3 3v3m0 0a1 1 0 001 1h1m-1 0v3a1 1 0 01-1 1H9a1 1 0 01-1-1v-3m0 0a1 1 0 011-1h1m0 0V7a3 3 0 013-3m3 3v3" />
                  )}
                </svg>
                {isMicEnabled ? 'Mic On' : 'Mic Off'}
              </Button>
            )}
            
            {/* Debug State Button */}
            {isConnected && (
              <Button
                variant="secondary"
                size="small"
                onClick={() => {
                  console.log(`🔍 MANUAL DEBUG CHECK:`);
                  console.log(`  - Local UID: ${localUid}`);
                  console.log(`  - Remote Users: ${remoteUsers.size}`, Array.from(remoteUsers.keys()));
                  console.log(`  - Host User: ${hostUser ? hostUser.uid : 'None'}`);
                  console.log(`  - Viewer Users: ${viewerUsers.size}`, Array.from(viewerUsers.keys()));
                  console.log(`  - Participant tiles in DOM:`, 
                    Array.from(document.querySelectorAll('[id^="participant-"]')).map(el => el.id)
                  );
                  console.log(`  - Agora client state:`, rtcClientRef.current?.connectionState);
                }}
                className="!bg-gray-600 hover:!bg-gray-700 text-xs"
              >
                Debug
              </Button>
            )}
            
            {/* AR Status */}
            {arInitialized && (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-blue-400 text-sm">AR Detection</span>
              </div>
            )}
            
            {/* Connection Status */}
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
              <span className="text-white/90 text-sm">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            
            {/* Participants Count */}
            {isConnected && (
              <div className="text-white/70 text-sm">
                {remoteUsers.size} Participant{remoteUsers.size !== 1 ? 's' : ''}
              </div>
            )}
            
            {/* Connection Controls */}
            {!isConnected ? (
              <Button
                variant="primary"
                size="small"
                onClick={connectToStream}
                disabled={!!connectionError}
              >
                Join Stream
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="small"
                onClick={disconnectFromStream}
                className="!bg-red-600 hover:!bg-red-700"
              >
                Leave Stream
              </Button>
            )}
            
            {/* Wallet Connect */}
            <div className="ml-2">
              <SuiWalletConnect />
            </div>
          </div>
        </div>
        
        {/* Error Messages */}
        {connectionError && (
          <div className="mt-2 p-2 bg-red-500/20 border border-red-500/30 rounded text-red-400 text-sm">
            {connectionError}
          </div>
        )}
        
        {mediaError && (
          <div className="mt-2 p-2 bg-yellow-500/20 border border-yellow-500/30 rounded text-yellow-400 text-sm">
            {mediaError}
          </div>
        )}
      </div>

      {/* Main Content Area - Explicitly sized to exclude header and bottom panel */}
      <div className="flex" style={{ height: 'calc(100vh - 14rem)' }}>
        {!isConnected ? (
          /* Not Connected State */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-white/70">
              <div className="w-16 h-16 mx-auto mb-4 bg-white/5 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-white mb-2">Ready to Join AR Session</h3>
              <p className="text-sm mb-4">Connect to watch the synchronized drone demo with AR overlay</p>
              <p className="text-xs text-white/50">Channel: {session.id}</p>
            </div>
          </div>
        ) : (
          <>
            {/* Left Side: Main AR View Area */}
            <div className="flex-1 relative">
              {!hostUser ? (
                /* Waiting for Host */
                <div className="h-full flex items-center justify-center">
                  <div className="text-center text-white/70">
                    <div className="w-16 h-16 mx-auto mb-4 bg-white/5 rounded-full flex items-center justify-center">
                      <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-white mb-2">Waiting for Session</h3>
                    <p className="text-sm mb-4">Drone demo will start when host begins session</p>
                    <p className="text-xs text-white/50">Participants: {remoteUsers.size}</p>
                  </div>
                </div>
              ) : null}

              {/* Host Video Container - populated dynamically */}
              <div 
                ref={mainViewRef} 
                className="absolute inset-0 w-full h-full"
                style={{ zIndex: 1 }}
              />

              {/* AR Overlay Canvas - Constrained to video area only */}
              {hostUser && (
                <canvas 
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  style={{
                    zIndex: 2,
                    background: 'transparent',
                    display: arInitialized ? 'block' : 'none',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    maxWidth: '100%',
                    maxHeight: '100%'
                  }}
                />
              )}

              {/* Stream Info Overlay */}
              {isConnected && (
                <div className="absolute top-4 left-4 z-10 bg-black/60 backdrop-blur-sm rounded-lg p-3 text-white">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-sm font-medium">Watching Multi-Viewer AR Stream</span>
                  </div>
                  <div className="text-xs text-white/70">
                    Channel: {session.id}<br />
                    Your UID: {localUid}<br />
                    Host: {hostUser ? `User ${hostUser.uid}` : 'None'}<br />
                    Viewers: {remoteUsers.size}<br />
                    {arInitialized && `AR Markers: ${detectedMarkers.length}`}
                  </div>
                </div>
              )}
            </div>

            {/* Right Side: Delivery Control Panel (Read-only for viewers) */}
            <div className="w-96 bg-gray-900 text-white border-l border-white/10 flex flex-col overflow-hidden relative z-20">
              {/* Control Panel Header - Fixed */}
              <div className="flex-shrink-0 p-4 border-b border-white/10 relative z-10">
                <h2 className="text-lg font-bold text-white mb-1 relative z-10">Delivery Control</h2>
                <p className="text-sm text-white/70 relative z-10">Watching host's delivery control</p>
              </div>
              
              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto min-h-0 relative z-10">
                {/* Delivery Grid */}
                <div className="p-4 border-b border-white/10 relative z-10">
                  <h3 className="text-sm font-medium text-white mb-3 relative z-10">Delivery Zone</h3>
                  <div className="bg-gray-800 rounded-lg p-4 aspect-square relative overflow-hidden z-10">
                    {/* Grid */}
                    <div className="absolute inset-0 grid grid-cols-8 grid-rows-8 gap-1 z-5">
                      {Array.from({ length: 64 }).map((_, index) => {
                        const row = Math.floor(index / 8);
                        const col = index % 8;
                        const isStart = startPoint && startPoint.row === row && startPoint.col === col;
                        const isEnd = endPoint && endPoint.row === row && endPoint.col === col;
                        
                        return (
                          <div
                            key={index}
                            className={`
                              border border-white/20 transition-colors
                              ${isStart ? 'bg-green-500' : ''}
                              ${isEnd ? 'bg-red-500' : ''}
                              ${!isStart && !isEnd ? 'bg-gray-700/30' : ''}
                            `}
                          />
                        );
                      })}
                    </div>
                    
                    {/* Robot Positions */}
                    {robots.map((robot) => (
                      <div
                        key={robot.id}
                        className={`
                          absolute w-3 h-3 rounded-full transform -translate-x-1/2 -translate-y-1/2 z-10
                          ${robot.status === 'idle' ? 'bg-blue-400' : 
                            robot.status === 'moving' ? 'bg-yellow-400 animate-pulse' : 
                            'bg-green-400'}
                        `}
                        style={{
                          left: `${robot.position.x}%`,
                          top: `${robot.position.y}%`
                        }}
                        title={robot.name}
                      />
                    ))}
                    
                    {/* Legend */}
                    <div className="absolute bottom-2 left-2 text-xs z-20">
                      <div className="flex items-center gap-2 mb-1 relative z-10">
                        <div className="w-2 h-2 bg-green-500 rounded relative z-10"></div>
                        <span className="relative z-10 text-white">Start</span>
                      </div>
                      <div className="flex items-center gap-2 relative z-10">
                        <div className="w-2 h-2 bg-red-500 rounded relative z-10"></div>
                        <span className="relative z-10 text-white">End</span>
                      </div>
                    </div>
                    
                    {/* Viewer Notice */}
                    <div className="absolute top-2 right-2 text-xs text-white/90 bg-black/60 px-2 py-1 rounded relative z-20">
                      View Only
                    </div>
                  </div>
                </div>
                
                {/* Robot Status */}
                <div className="p-4 border-b border-white/10 relative z-10">
                  <h3 className="text-sm font-medium text-white mb-3 relative z-10">Robot Status</h3>
                  <div className="space-y-2 relative z-10">
                    {robots.map((robot) => (
                      <div key={robot.id} className="flex items-center justify-between bg-gray-800 rounded p-2 relative z-10">
                        <div className="flex items-center gap-2 relative z-10">
                          <div className={`
                            w-2 h-2 rounded-full relative z-10
                            ${robot.status === 'idle' ? 'bg-blue-400' : 
                              robot.status === 'moving' ? 'bg-yellow-400' : 
                              'bg-green-400'}
                          `} />
                          <span className="text-sm text-white relative z-10">{robot.name}</span>
                        </div>
                        <div className="text-xs text-white/90 relative z-10">
                          {robot.battery}% • {robot.status}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Delivery Status */}
                <div className="p-4 relative z-10">
                  <h3 className="text-sm font-medium text-white mb-3 relative z-10">Execution</h3>
                  
                  <div className="space-y-3 relative z-10">
                    <div className="bg-gray-800 rounded p-3 relative z-10">
                      <div className="text-xs text-white/90 mb-1 relative z-10">Delivery Cost</div>
                      <div className="text-lg font-bold text-white relative z-10">{deliveryCost} SUI</div>
                    </div>
                    
                    <div className="bg-gray-800 rounded p-3 relative z-10">
                      <div className="text-xs text-white/90 mb-1 relative z-10">Status</div>
                      <div className="text-sm text-white relative z-10">{deliveryStatus}</div>
                    </div>
                    
                    <div className="space-y-2 relative z-10">
                      <Button
                        variant="primary"
                        size="small"
                        onClick={() => {
                          // Show a tip or interaction message for viewers
                          alert('💡 Tip: This is a view-only mode. You can watch the host control the delivery system in real-time!');
                        }}
                        className="w-full relative z-20 pointer-events-auto"
                      >
                        Tip to interact
                      </Button>
                      
                      <Button
                        variant="secondary"
                        size="small"
                        onClick={() => {
                          // Show reset info for viewers
                          alert('ℹ️ Only the host can reset the delivery system. You are in view-only mode.');
                        }}
                        className="w-full !bg-gray-700 hover:!bg-gray-600 relative z-20 pointer-events-auto"
                      >
                        Reset
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Bottom Viewer Panel - Fixed Height, Always Present */}
      {isConnected && (
        <div className="h-24 bg-gray-900/90 backdrop-blur-sm border-t border-white/10 flex items-center px-4 flex-shrink-0">
          <div className="flex items-center gap-3 w-full">
            {/* Viewers Label */}
            <div className="text-white/70 text-sm font-medium whitespace-nowrap">
              Viewers ({isConnected ? Math.max(0, remoteUsers.size - (hostUser ? 1 : 0)) + 1 : 0})
            </div>
            
            {/* Horizontal Scroll Container */}
            <div className="flex-1 overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-track-gray-800 scrollbar-thumb-gray-600 hover:scrollbar-thumb-gray-500">
              <div className="flex gap-3 pb-2 min-w-max">
                {/* Local viewer tile (you) */}
                {localUid && (
                  <div className="flex-shrink-0 w-16 h-16 relative">
                    {/* Video container */}
                    <div className="w-full h-full bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg overflow-hidden border-2 border-blue-400 relative">
                      {isCameraEnabled ? (
                        /* Show video when camera is on */
                        <video 
                          ref={localVideoRef}
                          className="w-full h-full object-cover"
                          autoPlay
                          playsInline
                          muted
                          style={{ transform: 'scaleX(-1)' }} // Mirror the video
                        />
                      ) : (
                        /* Show "YOU" text when camera is off */
                        <div className="w-full h-full flex items-center justify-center text-white font-semibold text-xs">
                          YOU
                        </div>
                      )}
                    </div>
                    
                    {/* Status indicators */}
                    <div className="absolute -bottom-1 -right-1 flex gap-1">
                      {/* Camera status */}
                      <div className={`w-3 h-3 rounded-full border border-gray-900 ${isCameraEnabled ? 'bg-blue-400' : 'bg-gray-500'}`}></div>
                      {/* Microphone status */}
                      <div className={`w-3 h-3 rounded-full border border-gray-900 ${isMicEnabled ? 'bg-green-400' : 'bg-gray-500'}`}></div>
                    </div>
                    
                    {/* UID label */}
                    <div className="absolute top-0 left-0 right-0 bg-black/60 text-white text-xs px-1 py-0.5 rounded-t-lg text-center truncate">
                      {localUid}
                    </div>
                  </div>
                )}
                
                {/* Other viewers - Direct mapping like host */}
                {Array.from(remoteUsers.entries())
                  .filter(([uid, user]) => uid !== hostUser?.uid) // Exclude host from viewer tiles
                  .map(([uid, user]) => (
                    <div key={uid} className="flex-shrink-0 w-16 h-16 relative">
                      <div className="w-full h-full bg-gradient-to-br from-purple-500 to-purple-700 rounded-lg flex items-center justify-center text-white font-semibold text-xs overflow-hidden">
                        {user.hasVideo && user.videoTrack ? (
                          /* Show video if participant has camera on */
                          <video 
                            ref={(videoEl) => {
                              if (videoEl && user.videoTrack) {
                                user.videoTrack.play(videoEl);
                              }
                            }}
                            className="w-full h-full object-cover"
                            autoPlay
                            playsInline
                            muted
                          />
                        ) : (
                          /* Show UID if no video */
                          uid.toString().slice(-2)
                        )}
                      </div>
                      
                      {/* Status indicators */}
                      <div className="absolute -bottom-1 -right-1 flex gap-1">
                        {/* Camera status */}
                        <div className={`w-3 h-3 rounded-full border border-gray-900 ${user.hasVideo ? 'bg-blue-400' : 'bg-gray-500'}`}></div>
                        {/* Microphone status */}
                        <div className={`w-3 h-3 rounded-full border border-gray-900 ${user.hasAudio ? 'bg-green-400' : 'bg-gray-500'}`}></div>
                      </div>
                      
                      {/* UID label */}
                      <div className="absolute top-0 left-0 right-0 bg-black/60 text-white text-xs px-1 py-0.5 rounded-t-lg text-center truncate">
                        {uid}
                      </div>
                    </div>
                  ))
                }
                
                {/* Host tile if present */}
                {hostUser && (
                  <div className="flex-shrink-0 w-16 h-16 relative">
                    <div className="w-full h-full bg-gradient-to-br from-green-500 to-green-700 rounded-lg flex items-center justify-center text-white font-semibold text-xs border-2 border-green-400">
                      HOST
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-gray-900"></div>
                    <div className="absolute top-0 left-0 right-0 bg-black/60 text-white text-xs px-1 py-0.5 rounded-t-lg text-center truncate">
                      {hostUser.uid}
                    </div>
                  </div>
                )}
                
                {/* Add More Placeholder */}
                <div className="flex-shrink-0 w-16 h-16 border-2 border-dashed border-white/30 rounded-lg flex items-center justify-center text-white/50 text-xs">
                  +
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 