import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import AgoraRTC, { IAgoraRTCClient, IRemoteVideoTrack, IRemoteAudioTrack } from 'agora-rtc-sdk-ng';
import { Button } from '../shared/Button';
import { RaceSession } from '../../../shared/types/race';
import { APP_ID, fetchToken } from '../../../shared/utils/agoraAuth';
import { EnhancedARDetector, DetectedMarker } from '../../../engine-layer/core/ar/EnhancedARDetector';
import { GameRenderSystem } from '../../../engine-layer/core/renderer/GameRenderSystem';

interface ARViewerScreenProps {
  session: RaceSession;
  onBack: () => void;
}

interface RemoteUser {
  uid: number;
  videoTrack?: IRemoteVideoTrack;
  audioTrack?: IRemoteAudioTrack;
  isHost?: boolean;
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
  
  // AR state
  const [arInitialized, setArInitialized] = useState(false);
  const [detectedMarkers, setDetectedMarkers] = useState<DetectedMarker[]>([]);
  const [arEffectsEnabled, setArEffectsEnabled] = useState(true);

  // Delivery control state (read-only for viewers)
  const [startPoint, setStartPoint] = useState<DeliveryPoint | null>(null);
  const [endPoint, setEndPoint] = useState<DeliveryPoint | null>(null);
  const [robots, setRobots] = useState<Robot[]>([
    { id: 'robot-a', name: 'Robot A', position: { x: 10, y: 10 }, status: 'idle', battery: 85 },
    { id: 'robot-b', name: 'Robot B', position: { x: 80, y: 60 }, status: 'idle', battery: 92 }
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

  // Simulate delivery data for demo (in real app, this would come from host)
  useEffect(() => {
    const timer = setTimeout(() => {
      setStartPoint({ row: 2, col: 1, id: 'start' });
      setEndPoint({ row: 5, col: 6, id: 'end' });
      setDeliveryStatus('Ready to execute delivery');
      setRobots(prev => prev.map(robot => 
        robot.id === 'robot-a' 
          ? { ...robot, status: 'moving' }
          : robot
      ));
    }, 3000); // Show delivery points after 3 seconds

    return () => clearTimeout(timer);
  }, []);

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
        await client.subscribe(user, mediaType);
        console.log(`📺 Subscribed to ${mediaType} from user ${user.uid}`);
        
        setRemoteUsers(prev => {
          const newMap = new Map(prev);
          const existingUser = newMap.get(user.uid as number) || { uid: user.uid as number };
          
          if (mediaType === 'video' && user.videoTrack) {
            existingUser.videoTrack = user.videoTrack;
            
            // Determine if this is the host (first video publisher or has higher authority)
            // For simplicity, treat the first video publisher as host
            if (!hostUser) {
              console.log(`👑 User ${user.uid} is now the HOST`);
              // This is the host - display in main view with AR
              existingUser.isHost = true;
              setHostUser(existingUser);
              
              // Remove this user's tile from participant grid since they're now the host
              const existingTile = document.getElementById(`participant-${user.uid}`);
              if (existingTile) {
                existingTile.remove();
                console.log(`🗑️ Removed host tile from participant grid for user ${user.uid}`);
              }
              
              setTimeout(() => {
                // Create main host video view
                const mainContainer = document.createElement('div');
                mainContainer.id = `main-host-${user.uid}`;
                mainContainer.className = 'absolute inset-0 w-full h-full bg-black';
                
                const hostVideo = document.createElement('video');
                hostVideo.className = 'w-full h-full object-cover';
                hostVideo.autoplay = true;
                hostVideo.playsInline = true;
                hostVideo.muted = true;
                hostVideo.style.transform = 'scaleX(-1)'; // Mirror the video
                hostVideo.id = `host-video-${user.uid}`;
                mainContainer.appendChild(hostVideo);
                
                // Store reference for AR detection
                hostVideoRef.current = hostVideo;
                
                // Add to main view container
                if (mainViewRef.current) {
                  mainViewRef.current.appendChild(mainContainer);
                  
                  // Play video in main view
                  user.videoTrack!.play(hostVideo);
                  
                  console.log(`🎮 Host video displayed in main view for user ${user.uid}`);
                  
                  // Initialize AR overlay for host stream
                  setTimeout(() => {
                    const initializeARWhenReady = () => {
                      if (hostVideo.videoWidth > 0 && hostVideo.videoHeight > 0) {
                        console.log(`📐 Host video dimensions ready: ${hostVideo.videoWidth}x${hostVideo.videoHeight}`);
                        initializeAROverlay();
                      } else {
                        setTimeout(initializeARWhenReady, 500);
                      }
                    };
                    
                    hostVideo.addEventListener('loadeddata', () => {
                      setTimeout(initializeARWhenReady, 200);
                    });
                    
                    hostVideo.addEventListener('playing', () => {
                      setTimeout(initializeARWhenReady, 200);
                    });
                    
                    setTimeout(initializeARWhenReady, 2000);
                  }, 100);
                }
              }, 100);
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
            existingUser.audioTrack = user.audioTrack;
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
            }
            if (mediaType === 'audio') {
              delete existingUser.audioTrack;
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
      
      setIsConnected(true);
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
      
      if (rtcClientRef.current) {
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
      
      setIsConnected(false);
      setLocalUid(null);
      setRemoteUsers(new Map());
      setHostUser(null);
      setViewerUsers(new Map());
      console.log('Disconnected from stream');
    } catch (error) {
      console.error('Error disconnecting from stream:', error);
    }
  };

  // Add periodic debug logging
  useEffect(() => {
    if (!isConnected) return;
    
    const debugInterval = setInterval(() => {
      console.log(`🔍 DEBUG STATE CHECK:`);
      console.log(`  - Local UID: ${localUid}`);
      console.log(`  - Remote Users: ${remoteUsers.size}`, Array.from(remoteUsers.keys()));
      console.log(`  - Host User: ${hostUser ? hostUser.uid : 'None'}`);
      console.log(`  - Viewer Users: ${viewerUsers.size}`, Array.from(viewerUsers.keys()));
      console.log(`  - Participant tiles in DOM:`, 
        Array.from(document.querySelectorAll('[id^="participant-"]')).map(el => el.id)
      );
    }, 10000); // Every 10 seconds
    
    return () => clearInterval(debugInterval);
  }, [isConnected, localUid, remoteUsers, hostUser, viewerUsers]);

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
            {/* AR Effects Toggle */}
            {arInitialized && (
              <Button
                variant="secondary"
                size="small"
                onClick={toggleAREffects}
                className={`${arEffectsEnabled ? '!bg-blue-600 hover:!bg-blue-700' : '!bg-white/10 hover:!bg-white/20'}`}
              >
                {arEffectsEnabled ? 'Hide Effects' : 'Show Effects'}
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
          </div>
        </div>
        
        {/* Error Messages */}
        {connectionError && (
          <div className="mt-2 p-2 bg-red-500/20 border border-red-500/30 rounded text-red-400 text-sm">
            {connectionError}
          </div>
        )}
      </div>

      {/* Main Content Area - Explicitly sized to exclude bottom panel */}
      <div className="flex" style={{ height: 'calc(100vh - 10rem)' }}>
        {!isConnected ? (
          /* Not Connected State */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-white/70">
              <div className="w-16 h-16 mx-auto mb-4 bg-white/5 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-white mb-2">Ready to Watch AR Stream</h3>
              <p className="text-sm mb-4">Join to watch the host's AR experience with other viewers</p>
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
                    <h3 className="text-lg font-medium text-white mb-2">Waiting for Host</h3>
                    <p className="text-sm mb-4">Host will appear here with AR overlay</p>
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
            <div className="w-96 bg-gray-900 text-white border-l border-white/10 flex flex-col overflow-hidden">
              {/* Control Panel Header - Fixed */}
              <div className="flex-shrink-0 p-4 border-b border-white/10">
                <h2 className="text-lg font-bold text-white mb-1">Delivery Control</h2>
                <p className="text-sm text-white/70">Watching host's delivery control</p>
              </div>
              
              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto">
                {/* Delivery Grid */}
                <div className="p-4 border-b border-white/10">
                  <h3 className="text-sm font-medium text-white mb-3">Delivery Zone</h3>
                  <div className="bg-gray-800 rounded-lg p-4 aspect-square relative overflow-hidden">
                    {/* Grid */}
                    <div className="absolute inset-0 grid grid-cols-8 grid-rows-8 gap-1">
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
                          absolute w-3 h-3 rounded-full transform -translate-x-1/2 -translate-y-1/2
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
                    <div className="absolute bottom-2 left-2 text-xs">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 bg-green-500 rounded"></div>
                        <span>Start</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-red-500 rounded"></div>
                        <span>End</span>
                      </div>
                    </div>
                    
                    {/* Viewer Notice */}
                    <div className="absolute top-2 right-2 text-xs text-white/50 bg-black/30 px-2 py-1 rounded">
                      View Only
                    </div>
                  </div>
                </div>
                
                {/* Robot Status */}
                <div className="p-4 border-b border-white/10">
                  <h3 className="text-sm font-medium text-white mb-3">Robot Status</h3>
                  <div className="space-y-2">
                    {robots.map((robot) => (
                      <div key={robot.id} className="flex items-center justify-between bg-gray-800 rounded p-2">
                        <div className="flex items-center gap-2">
                          <div className={`
                            w-2 h-2 rounded-full
                            ${robot.status === 'idle' ? 'bg-blue-400' : 
                              robot.status === 'moving' ? 'bg-yellow-400' : 
                              'bg-green-400'}
                          `} />
                          <span className="text-sm text-white">{robot.name}</span>
                        </div>
                        <div className="text-xs text-white/70">
                          {robot.battery}% • {robot.status}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Delivery Status */}
                <div className="p-4">
                  <h3 className="text-sm font-medium text-white mb-3">Execution</h3>
                  
                  <div className="space-y-3">
                    <div className="bg-gray-800 rounded p-3">
                      <div className="text-xs text-white/70 mb-1">Delivery Cost</div>
                      <div className="text-lg font-bold text-white">{deliveryCost} SUI</div>
                    </div>
                    
                    <div className="bg-gray-800 rounded p-3">
                      <div className="text-xs text-white/70 mb-1">Status</div>
                      <div className="text-sm text-white">{deliveryStatus}</div>
                    </div>
                    
                    <div className="space-y-2">
                      <Button
                        variant="primary"
                        size="small"
                        onClick={() => {}} // No-op for viewers
                        disabled={!startPoint || !endPoint}
                        className="w-full"
                      >
                        Tip to interact
                      </Button>
                      
                      <Button
                        variant="secondary"
                        size="small"
                        onClick={() => {}} // No-op for viewers
                        className="w-full !bg-gray-700 hover:!bg-gray-600"
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
                    <div className="w-full h-full bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center text-white font-semibold text-xs border-2 border-blue-400">
                      YOU
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-blue-400 rounded-full border-2 border-gray-900"></div>
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
                      <div className="w-full h-full bg-gradient-to-br from-purple-500 to-purple-700 rounded-lg flex items-center justify-center text-white font-semibold text-xs">
                        {uid.toString().slice(-2)}
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-gray-900"></div>
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