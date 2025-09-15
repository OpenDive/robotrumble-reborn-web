import React, { useEffect, useRef, useState } from 'react';
import AgoraRTC, { IAgoraRTCClient, IRemoteVideoTrack, IRemoteAudioTrack } from 'agora-rtc-sdk-ng';
import { Button } from '../shared/Button';
import { LoadingModal } from '../shared/LoadingModal';
import { ErrorModal } from '../shared/ErrorModal';
import { JoinGameView } from '../shared/JoinGameView';
import { RaceSession } from '../../../shared/types/race';
import { APP_ID, fetchToken } from '../../../shared/utils/agoraAuth';
import { suiCrossyRobotService, GameState as SuiGameState } from '../../../shared/services/suiCrossyRobotService';
import { SuiWalletConnect } from '../shared/SuiWalletConnect';
import { useCurrentAccount, useSignAndExecuteTransaction, useSignTransaction, useSuiClient } from '@mysten/dapp-kit';
import { useEnokiFlow, useZkLogin, useZkLoginSession } from '@mysten/enoki/react';
import { useAuth } from '../../../shared/contexts/AuthContext';
import { robotWebSocketService, RobotFeedback, RobotCommand } from '../../services/RobotWebSocketService';

// Environment configuration for robot WebSocket
const ROBOT_WS_URL = 'wss://hurricane-laboratories-ddc1627c10dd.herokuapp.com/ws';
const ROBOT_ROOM_ID = 'robot-b';
const ROBOT_WS_ENABLED = 'false';

// Smart contract configuration - Phase 2: Sponsored transactions + fallback to regular transactions
const CROSSY_ROBOT_PACKAGE_ID = "0xaa4fbd2d5507be23930ee1d1febba86ba0fdd438d8167b5629114c2bc548d76f";
const GAME_OBJECT_ID = "0x5841f9619151780ef94d69746cde27299df321b523f185f7fe6d24867b324de7";

// Direction mapping to match smart contract
const DIRECTION_TO_CONTRACT_MAP = {
  'up': 0,      // MOVE_UP
  'down': 1,    // MOVE_DOWN  
  'left': 2,    // MOVE_LEFT
  'right': 3,   // MOVE_RIGHT
  'stop': 0     // Default to UP for stop command
} as const;

interface ARViewerScreenCrossyRoboProps {
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





export const ARViewerScreenCrossyRoboB: React.FC<ARViewerScreenCrossyRoboProps> = ({ session, onBack }) => {
  const mainViewRef = useRef<HTMLDivElement>(null);
  const hostVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  
  // Agora refs
  const rtcClientRef = useRef<IAgoraRTCClient | null>(null);
  
  // Connection state - unified for both video and robot
  const [gameState, setGameState] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('connecting');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  
  // Video streaming state
  const [isAgoraConnected, setIsAgoraConnected] = useState(false);
  const [localUid, setLocalUid] = useState<number | null>(null);
  
  // Robot WebSocket state
  const [isRobotConnected, setIsRobotConnected] = useState(false);
  const [robotFeedback, setRobotFeedback] = useState<RobotFeedback | null>(null);
  const [robotCommands, setRobotCommands] = useState<RobotCommand[]>([]);
  const [remoteUsers, setRemoteUsers] = useState<Map<number, RemoteUser>>(new Map());
  const [hostUser, setHostUser] = useState<RemoteUser | null>(null);
  const [viewerUsers, setViewerUsers] = useState<Map<number, RemoteUser>>(new Map());
  
  // Local media state for viewer chat
  const [localVideoTrack, setLocalVideoTrack] = useState<any>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<any>(null);
  const [isCameraEnabled, setIsCameraEnabled] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  


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

  // Crossy Robo control state (now enabled for viewers too)
  const [messageLog, setMessageLog] = useState<Array<{
    id: string;
    timestamp: string;
    command: string;
    status: 'sent' | 'acknowledged' | 'failed';
  }>>([]);
  const [isControlEnabled, setIsControlEnabled] = useState(true); // Enabled for viewers
  const [selectedRobot, setSelectedRobot] = useState<string>('robot-a');
  
  // Blockchain integration state
  const [suiGameState, setSuiGameState] = useState<SuiGameState | null>(null);
  const [blockchainInitialized, setBlockchainInitialized] = useState(false);
  const [blockchainError, setBlockchainError] = useState<string | null>(null);
  
  // Wallet connection hooks
  const currentAccount = useCurrentAccount();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const { mutateAsync: signTransaction } = useSignTransaction();
  const suiClient = useSuiClient();
  
  // Enoki hooks
  const enokiFlow = useEnokiFlow();
  const { address: enokiAddress } = useZkLogin();
  const zkLoginSession = useZkLoginSession();
  
  // Authentication
  const { user } = useAuth();



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
        if (rtcClientRef.current && isAgoraConnected) {
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
          if (rtcClientRef.current && isAgoraConnected) {
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
        if (rtcClientRef.current && isAgoraConnected) {
          await rtcClientRef.current.publish([audioTrack]);
          console.log('📤 Published microphone audio');
        }
      } else {
        // Disable microphone
        console.log('🎤❌ Disabling microphone...');
        
        if (localAudioTrack) {
          // Unpublish first if connected
          if (rtcClientRef.current && isAgoraConnected) {
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







  // Helper function for logging messages
  const logMessage = (message: string) => {
    console.log(message);
  };







  // Connect to Robot WebSocket
  const connectToRobot = async (): Promise<void> => {
    if (!ROBOT_WS_ENABLED) {
      console.log('Robot WebSocket disabled via environment');
      return;
    }
    
    try {
      setLoadingMessage('Connecting to robot control system...');
      console.log('🤖 Connecting to Robot WebSocket...');
      
      // Connect to robot WebSocket
      await robotWebSocketService.connect(ROBOT_WS_URL, ROBOT_ROOM_ID);
      
      // Set up robot event listeners
      const handleRobotStatus = (data: { connected: boolean; room_id?: string }) => {
        console.log('🤖 Robot status update:', data);
        setIsRobotConnected(data.connected);
      };
      
      const handleControlAck = (data: { status: string; command?: string }) => {
        console.log('🤖 Control acknowledgment:', data);
        const ackCommand: RobotCommand = {
          id: `ack-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          command: `✅ ${data.command || 'Command'} acknowledged: ${data.status}`,
          status: 'acknowledged',
          source: 'websocket'
        };
        setRobotCommands(prev => [ackCommand, ...prev].slice(0, 20));
      };
      
      const handleRobotFeedback = (data: RobotFeedback) => {
        console.log('🤖 Robot feedback:', data);
        setRobotFeedback({
          ...data,
          lastUpdate: new Date()
        });
      };
      
      const handleHeartbeat = (data: { robot_name?: string; status: string }) => {
        console.log('🤖 Robot heartbeat:', data);
        const heartbeatCommand: RobotCommand = {
          id: `heartbeat-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          command: `💓 ${data.robot_name || 'Robot'}: ${data.status}`,
          status: 'acknowledged',
          source: 'websocket'
        };
        setRobotCommands(prev => [heartbeatCommand, ...prev].slice(0, 20));
      };
      
      // Add event listeners
      robotWebSocketService.addEventListener('robotStatus', handleRobotStatus);
      robotWebSocketService.addEventListener('controlAck', handleControlAck);
      robotWebSocketService.addEventListener('robotFeedback', handleRobotFeedback);
      robotWebSocketService.addEventListener('heartbeat', handleHeartbeat);
      
      // Get initial robot state
      const roomInfo = robotWebSocketService.getCurrentRoom();
      setIsRobotConnected(roomInfo.isRobotConnected);
      
      console.log('✅ Robot WebSocket connected successfully');
    } catch (error) {
      console.error('❌ Robot WebSocket connection failed:', error);
      throw new Error(`Robot connection failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // Disconnect from Robot WebSocket
  const disconnectFromRobot = async (): Promise<void> => {
    try {
      robotWebSocketService.disconnect();
      setIsRobotConnected(false);
      setRobotFeedback(null);
      console.log('🤖 Robot WebSocket disconnected');
    } catch (error) {
      console.error('Error disconnecting from robot:', error);
    }
  };

  // Connect to game (both video and robot)
  const connectToGame = async (robotId?: string) => {
    setGameState('connecting');
    setConnectionError(null);
    
    // Set the selected robot if provided
    if (robotId) {
      setSelectedRobot(robotId);
      console.log(`🤖 Selected robot: ${robotId}`);
    }
    
    try {
      // Step 1: Connect to Agora (video streaming)
      setLoadingMessage('Connecting to video stream...');
      await connectToAgoraStream();
      
      // Step 2: Connect to Robot WebSocket
      setLoadingMessage('Connecting to robot control...');
      await connectToRobot();
      
      // Step 3: Both connections successful
      setGameState('connected');
      console.log(`✅ Full game connection established for ${robotId || 'default robot'}`);
      
    } catch (error) {
      console.error('❌ Game connection failed:', error);
      setConnectionError(error instanceof Error ? error.message : String(error));
      setGameState('error');
      
      // Cleanup any partial connections
      await cleanupConnections();
    }
  };

  // Connect to Agora stream only (renamed from connectToStream)
  const connectToAgoraStream = async () => {
    try {
      setConnectionError(null);
      console.log('Connecting to Crossy Robo stream...');
      
      // Create Agora client
      const client = AgoraRTC.createClient({ mode: 'live', codec: 'h264' });
      rtcClientRef.current = client;
      
      // Set up client events
      client.on('user-joined', (user) => {
        console.log(`🟢 User ${user.uid} joined the Crossy Robo channel`);
        
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
        console.log(`🔔 User ${user.uid} published ${mediaType}`);
        await client.subscribe(user, mediaType);
        console.log(`📺 Subscribed to ${mediaType} from user ${user.uid}`);
        
        // Debug: Log the actual tracks received
        if (mediaType === 'video') {
          console.log(`🎬 Video track received:`, user.videoTrack ? 'YES' : 'NO');
          if (user.videoTrack) {
            console.log(`📐 Video track info:`, {
              trackId: user.videoTrack.getTrackId(),
              isPlaying: user.videoTrack.isPlaying
            });
          }
        }
        
        if (mediaType === 'audio') {
          console.log(`🎵 Audio track received:`, user.audioTrack ? 'YES' : 'NO');
          if (user.audioTrack) {
            console.log(`🔊 Audio track info:`, {
              trackId: user.audioTrack.getTrackId(),
              isPlaying: user.audioTrack.isPlaying
            });
          }
        }
        
        setRemoteUsers(prev => {
          const newMap = new Map(prev);
          const existingUser = newMap.get(user.uid as number) || { uid: user.uid as number };
          
          if (mediaType === 'video' && user.videoTrack) {
            existingUser.videoTrack = user.videoTrack;
            existingUser.hasVideo = true;
            
            // Determine if this is the host - Allow newer joiners to take over
            // In Robot B interface, the most recent joiner with video becomes the host
            
            // Track the current state
            const newMapSize = newMap.size;
            const isFirstRobot = !hostUser && newMapSize === 1;
            const isCurrentHost = hostUser && hostUser.uid === user.uid;
            
            // Host selection logic for Robot B interface:
            // 1. If no current host, this user becomes host
            // 2. If there is a current host, this newer joiner takes over as host
            const shouldBeHost = !hostUser || true; // Always take over as host when publishing video
            
            console.log(`🔍 Host assignment check for user ${user.uid}:`);
            console.log(`  - Is first robot: ${isFirstRobot}`);
            console.log(`  - Is current host: ${isCurrentHost}`);
            console.log(`  - Current host: ${hostUser?.uid || 'none'}`);
            console.log(`  - New map size: ${newMapSize}`);
            console.log(`  - Should be host: ${shouldBeHost}`);
            
            if (shouldBeHost) {
              console.log(`👑 User ${user.uid} is now the Crossy Robo HOST (newer joiner takes over)`);
              
              // If there was a previous host, clean up their container
              if (hostUser && hostUser.uid !== user.uid) {
                const oldHostContainer = document.getElementById(`main-host-${hostUser.uid}`);
                if (oldHostContainer) {
                  oldHostContainer.remove();
                  console.log(`🗑️ Removed old host container for user ${hostUser.uid}`);
                }
              }
              
              // This is the host - display in main view with AR
              existingUser.isHost = true;
              setHostUser(existingUser);
              
              // Remove this user's tile from participant grid since they're now the host
              const existingTile = document.getElementById(`participant-${user.uid}`);
              if (existingTile) {
                existingTile.remove();
                console.log(`🗑️ Removed host tile from participant grid for user ${user.uid}`);
              }
              
              // Check if host video container already exists to avoid duplicates
              const existingHostContainer = document.getElementById(`main-host-${user.uid}`);
              if (existingHostContainer) {
                console.log(`🔄 Host video container already exists for user ${user.uid}, reusing it`);
                const existingVideo = existingHostContainer.querySelector('video') as HTMLVideoElement;
                if (existingVideo && user.videoTrack) {
                  user.videoTrack.play(existingVideo);
                  console.log(`🔄 Reusing existing host video for user ${user.uid}`);
                }
                // Don't return early - continue with updating the map
                newMap.set(user.uid as number, existingUser);
                return newMap;
              } else {
                // Create new host video container
                console.log(`🎬 Creating new host video container for user ${user.uid}`);
                console.log(`🔍 mainViewRef.current available:`, !!mainViewRef.current);
                
                // Create retry mechanism to wait for mainViewRef to be available
                const attemptVideoContainerCreation = (retryCount = 0) => {
                  const maxRetries = 20; // Try for 2 seconds (20 × 100ms)
                  
                  console.log(`🎬 Executing host video container creation for user ${user.uid} (attempt ${retryCount + 1})`);
                  console.log(`🔍 mainViewRef.current available:`, !!mainViewRef.current);
                  
                  if (mainViewRef.current) {
                    // Create main host video view
                    const mainContainer = document.createElement('div');
                    mainContainer.id = `main-host-${user.uid}`;
                    mainContainer.className = 'w-full h-full bg-black flex items-center justify-center';
                    
                    const hostVideo = document.createElement('video');
                    hostVideo.className = 'max-w-full max-h-full';
                    hostVideo.style.width = 'auto';
                    hostVideo.style.height = 'auto';
                    hostVideo.style.objectFit = 'fill';
                    hostVideo.autoplay = true;
                    hostVideo.playsInline = true;
                    hostVideo.muted = true;
                    
                    // Debug: Log actual video dimensions when loaded
                    hostVideo.addEventListener('loadedmetadata', () => {
                      console.log('🔍 STREAM SOURCE DEBUG - What we actually received:', {
                        videoWidth: hostVideo.videoWidth,
                        videoHeight: hostVideo.videoHeight,
                        aspectRatio: (hostVideo.videoWidth / hostVideo.videoHeight).toFixed(2),
                        clientWidth: hostVideo.clientWidth,
                        clientHeight: hostVideo.clientHeight,
                        naturalAspectRatio: hostVideo.videoWidth / hostVideo.videoHeight > 1.5 ? '16:9 or wider' : '4:3 or taller'
                      });
                      
                      // Check if we're getting the expected resolution
                      if (hostVideo.videoHeight < 900) {
                        console.warn('⚠️ CROPPING DETECTED: Video height is only', hostVideo.videoHeight, 'pixels');
                        console.warn('⚠️ This suggests the SOURCE is sending cropped content');
                        console.warn('⚠️ Check: iOS app settings, screen recording settings, or game window size');
                      }
                    });
                    // Remove mirroring for host video
                    hostVideo.id = `host-video-${user.uid}`;
                    hostVideo.setAttribute('data-uid', user.uid.toString()); // Add data-uid attribute for AR detection
                    mainContainer.appendChild(hostVideo);
                    
                    console.log(`📺 Created video element with id: ${hostVideo.id}`);
                    
                    // Store reference for AR detection
                    hostVideoRef.current = hostVideo;
                    
                    console.log(`📺 Adding host video container to main view`);
                    // Clear any existing content first
                    mainViewRef.current.innerHTML = '';
                    mainViewRef.current.appendChild(mainContainer);
                    
                    // Play video in main view
                    console.log(`🎥 Playing video track in host video element`);
                    try {
                      user.videoTrack!.play(hostVideo);
                      console.log(`✅ Video track play() called successfully`);
                    } catch (error) {
                      console.error(`❌ Error playing video track:`, error);
                    }
                    
                    console.log(`🎮 Crossy Robo host video displayed in main view for user ${user.uid}`);
                    
                    // Verify the video element is in the DOM
                    setTimeout(() => {
                      const addedVideo = document.getElementById(`host-video-${user.uid}`);
                      console.log(`🔍 Video element in DOM:`, !!addedVideo);
                      if (addedVideo) {
                        console.log(`📐 Video element dimensions: ${(addedVideo as HTMLVideoElement).videoWidth}x${(addedVideo as HTMLVideoElement).videoHeight}`);
                        console.log(`📺 Video element playing:`, !(addedVideo as HTMLVideoElement).paused);
                      }
                    }, 500);
                    

                  } else if (retryCount < maxRetries) {
                    console.log(`⏳ mainViewRef.current is null, retrying in 100ms (attempt ${retryCount + 1}/${maxRetries})`);
                    setTimeout(() => attemptVideoContainerCreation(retryCount + 1), 100);
                  } else {
                    console.error(`❌ mainViewRef.current is still null after ${maxRetries} attempts. Cannot add host video container.`);
                  }
                };
                
                // Start the retry mechanism
                setTimeout(() => attemptVideoContainerCreation(), 100);
              }
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
            setHostUser(null);
            console.log(`👑❌ Crossy Robo host ${user.uid} stopped streaming`);
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
        console.log(`🔴 User ${user.uid} left the Crossy Robo channel`);
        
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
          setHostUser(null);
          console.log(`👑🚪 Crossy Robo host ${user.uid} left`);
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
      
      // Join channel - HARDCODED FOR TESTING
      const channelName = 'robot-video'; // Hardcoded channel name
      const token = await fetchToken(channelName, uid, 'host');
      await client.join(APP_ID, channelName, token, uid);
      console.log(`Joined channel ${channelName} with UID ${uid} as Crossy Robo viewer`);
      
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
      
      setIsAgoraConnected(true);
      console.log('✅ Connected to Agora stream successfully');
      
      // Add initial game creation messages when joining
      setTimeout(() => {
        const gameId = 9538; // Hardcoded game ID for synchronization with host
        const timestamp1 = new Date().toLocaleTimeString();
        const timestamp2 = new Date(Date.now() + 3000).toLocaleTimeString();
        
        // Add game creation command
        const gameCreationCommand = {
          id: `initial-game-${Date.now()}`,
          timestamp: timestamp1,
          command: `Sent command: Create game: ${gameId}`,
          status: 'acknowledged' as const
        };
        
        // Add robot acceptance command
        const robotAcceptanceCommand = {
          id: `initial-accept-${Date.now()}`,
          timestamp: timestamp2,
          command: `Command acknowledged: Robot A accepts the offer`,
          status: 'acknowledged' as const
        };
        
        setMessageLog([robotAcceptanceCommand, gameCreationCommand]);
        console.log(`🎮 Added initial game creation messages for game ${gameId}`);
        
        // Initialize blockchain with current timestamp
        initializeBlockchain();
      }, 1000);
      
      // Start playing crossy video immediately when connected
    } catch (error) {
      console.error('Error connecting to stream:', error);
      setConnectionError(`Failed to connect: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // Cleanup all connections
  const cleanupConnections = async () => {
    try {
      await disconnectFromStream();
      await disconnectFromRobot();
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  };

  // Disconnect from game (both connections)
  const disconnectFromGame = async () => {
    try {
      setGameState('disconnected');
      await cleanupConnections();
      console.log('🎮 Disconnected from game');
    } catch (error) {
      console.error('Error disconnecting from game:', error);
    }
  };

  // Disconnect from Agora stream
  const disconnectFromStream = async () => {
    try {
      
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
      
      setIsAgoraConnected(false);
      setLocalUid(null);
      setRemoteUsers(new Map());
      setHostUser(null);
      setViewerUsers(new Map());
      console.log('Disconnected from Crossy Robo stream');
    } catch (error) {
      console.error('Error disconnecting from stream:', error);
    }
  };

  // Add periodic debug logging
  useEffect(() => {
    if (!isAgoraConnected) return;
    
    const debugInterval = setInterval(() => {
      console.log(`🔍 CROSSY ROBO DEBUG STATE CHECK:`);
      console.log(`  - Local UID: ${localUid}`);
      console.log(`  - Remote Users: ${remoteUsers.size}`, Array.from(remoteUsers.keys()));
      console.log(`  - Host User: ${hostUser ? hostUser.uid : 'None'}`);
      console.log(`  - Viewer Users: ${viewerUsers.size}`, Array.from(viewerUsers.keys()));
      console.log(`  - Participant tiles in DOM:`, 
        Array.from(document.querySelectorAll('[id^="participant-"]')).map(el => el.id)
      );
    }, 10000); // Every 10 seconds
    
    return () => clearInterval(debugInterval);
  }, [isAgoraConnected, localUid, remoteUsers, hostUser, viewerUsers]);



  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnectFromStream();
    };
  }, []);

  // Execute sponsored smart contract movement (Phase 2)
  const executeSponsoredContractMovement = async (
    contractDirection: number,
    originalDirection: string
  ): Promise<{ success: boolean; digest?: string; error?: string }> => {
    try {
      // Only works with Enoki wallets
      if (!enokiAddress || !zkLoginSession) {
        throw new Error('Sponsored transactions require Enoki wallet');
      }

      // Import Transaction for direct use
      const { Transaction } = await import('@mysten/sui/transactions');
      
      // Create transaction for smart contract call
      const transaction = new Transaction();
      transaction.setSender(enokiAddress);
      
      // Call move_robot function on the smart contract
      transaction.moveCall({
        target: `${CROSSY_ROBOT_PACKAGE_ID}::crossy_robot::move_robot`,
        arguments: [
          transaction.object(GAME_OBJECT_ID), // Game object (shared object)
          transaction.pure.u8(contractDirection), // Direction (0-3)
          transaction.object('0x6'), // Clock object (system clock)
        ],
      });
      
      // Build transaction bytes for sponsoring
      const transactionBlockKindBytes = await transaction.build({ 
        client: suiClient, 
        onlyTransactionKind: true 
      });
      
      // Convert Uint8Array to base64 string for Enoki API
      const base64TransactionBytes = btoa(String.fromCharCode(...transactionBlockKindBytes));
      
      // Get JWT from Enoki session
      const jwt = zkLoginSession.jwt;
      
      // Step 1: Request sponsorship from backend
      console.log('🔍 Sending to API:', { 
        transactionBlockKindBytes: base64TransactionBytes.substring(0, 50) + '...', 
        zkLoginJwt: jwt ? 'present' : 'missing',
        jwtLength: jwt?.length 
      });
      
      const sponsorResponse = await fetch('/api/enoki/sponsor-transaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactionBlockKindBytes: base64TransactionBytes,
          zkLoginJwt: jwt,
        }),
      });
      
      if (!sponsorResponse.ok) {
        const errorText = await sponsorResponse.text();
        console.log('❌ API Error Response:', sponsorResponse.status, errorText);
        
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        
        throw new Error(errorData.error || 'Failed to sponsor transaction');
      }
      
      const { transactionBlockBytes, digest } = await sponsorResponse.json();
      
      // Step 2: Sign the transaction bytes (convert base64 string to Uint8Array)
      const signer = await enokiFlow.getKeypair({ network: 'testnet' });
      const transactionBytes = new Uint8Array(atob(transactionBlockBytes).split('').map(c => c.charCodeAt(0)));
      const signature = await signer.signTransaction(transactionBytes);
      
      // Step 3: Execute the sponsored transaction
      const executeResponse = await fetch('/api/enoki/execute-sponsored-transaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          digest: digest,
          signature: signature.signature,
        }),
      });
      
      if (!executeResponse.ok) {
        const errorData = await executeResponse.json();
        throw new Error(errorData.error || 'Failed to execute sponsored transaction');
      }
      
      const result = await executeResponse.json();
      
      return {
        success: true,
        digest: result.digest || digest
      };
      
    } catch (error) {
      console.error('Sponsored transaction failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  };

  // Execute smart contract movement (Phase 1 - Fallback)
  const executeContractMovement = async (
    contractDirection: number, 
    originalDirection: string
  ): Promise<{ success: boolean; digest?: string; error?: string }> => {
    try {
      // Import Transaction for direct use
      const { Transaction } = await import('@mysten/sui/transactions');
      
      // Create transaction for smart contract call
      const transaction = new Transaction();
      
      // Call move_robot function on the smart contract
      transaction.moveCall({
        target: `${CROSSY_ROBOT_PACKAGE_ID}::crossy_robot::move_robot`,
        arguments: [
          transaction.object(GAME_OBJECT_ID), // Game object (shared object)
          transaction.pure.u8(contractDirection), // Direction (0-3)
          transaction.object('0x6'), // Clock object (system clock)
        ],
      });
      
      let result;
      
      // Execute transaction based on wallet type
      if (currentAccount && signAndExecuteTransaction) {
        // Traditional wallet execution
        result = await new Promise((resolve, reject) => {
          signAndExecuteTransaction(
            { transaction },
            {
              onSuccess: (result) => resolve(result),
              onError: (error) => reject(error)
            }
          );
        });
      } else if (enokiAddress && zkLoginSession) {
        // Enoki wallet execution
        transaction.setSender(enokiAddress);
        const txBytes = await transaction.build({ client: suiClient });
        const signer = await enokiFlow.getKeypair({ network: 'testnet' });
        const signature = await signer.signTransaction(txBytes);
        
        result = await suiClient.executeTransactionBlock({
          transactionBlock: txBytes,
          signature: signature.signature,
          requestType: "WaitForLocalExecution",
          options: { showEffects: true, showEvents: true, showObjectChanges: true },
        });
      } else {
        throw new Error('No wallet connected');
      }
      
      // Check transaction success
      if (result && (result as any).effects?.status?.status === 'success') {
        return {
          success: true,
          digest: (result as any).digest
        };
      } else {
        return {
          success: false,
          error: (result as any).effects?.status?.error || 'Transaction failed'
        };
      }
      
    } catch (error) {
      console.error('Smart contract execution failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  };

  // Helper function to map UI directions to robot commands
  const mapDirectionToRobot = (direction: 'up' | 'down' | 'left' | 'right' | 'stop') => {
    const robotCommandMap = {
      'up': 'forward',
      'down': 'backward',
      'left': 'left',
      'right': 'right',
      'stop': 'stop'
    };
    return robotCommandMap[direction];
  };

  // Send fire command directly to new WebSocket (bypassing blockchain)
  const sendFireCommand = async () => {
    if (!isControlEnabled) return;
    
    const sendTimestamp = new Date().toLocaleTimeString();
    const commandId = `fire-${Date.now()}`;
    
    // Add "sending fire command" to log immediately
    const sendingFireCommand: RobotCommand = {
      id: commandId,
      timestamp: sendTimestamp,
      command: `🔥 Sending FIRE`,
      status: 'sent',
      source: 'websocket'
    };
    
    setRobotCommands(prev => [sendingFireCommand, ...prev].slice(0, 20));
    
    // Disable controls during command
    setIsControlEnabled(false);
    
    try {
      // Create WebSocket connection to new server
      const ws = new WebSocket('wss://robot-rumble-server-f48fa1b1741f.herokuapp.com/');
      
      let connectionHandled = false;
      
      // Set up WebSocket event handlers
      ws.onopen = () => {
        if (connectionHandled) return;
        connectionHandled = true;
        
        console.log('🔗 Connected to robot-rumble-server for fire command');
        
        // Send simple shoot command (Unity expects plain string)
        ws.send('shoot');
        console.log('🎯 Sent shoot command: "shoot"');
        
        const fireSuccessCommand: RobotCommand = {
          id: `${commandId}-success`,
          timestamp: new Date().toLocaleTimeString(),
          command: `🎯 SHOOT command sent successfully!`,
          status: 'acknowledged',
          source: 'websocket'
        };
        setRobotCommands(prev => [fireSuccessCommand, ...prev].slice(0, 20));
        
        // Close connection after sending
        setTimeout(() => {
          ws.close();
        }, 1000);
      };
      
      ws.onerror = (error) => {
        if (connectionHandled) return;
        connectionHandled = true;
        
        console.error('WebSocket error:', error);
        
        const failedFireCommand: RobotCommand = {
          id: `${commandId}-fail`,
          timestamp: new Date().toLocaleTimeString(),
          command: `❌ FIRE command failed: WebSocket connection error`,
          status: 'failed',
          source: 'websocket'
        };
        
        setRobotCommands(prev => [failedFireCommand, ...prev].slice(0, 20));
        setIsControlEnabled(true);
      };
      
      ws.onclose = () => {
        console.log('🔗 Disconnected from robot-rumble-server');
        // Always re-enable controls when connection closes
        setIsControlEnabled(true);
      };
      
      // Set timeout for connection
      setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING && !connectionHandled) {
          connectionHandled = true;
          ws.close();
          
          const timeoutFireCommand: RobotCommand = {
            id: `${commandId}-timeout`,
            timestamp: new Date().toLocaleTimeString(),
            command: `❌ FIRE command failed: Connection timeout`,
            status: 'failed',
            source: 'websocket'
          };
          
          setRobotCommands(prev => [timeoutFireCommand, ...prev].slice(0, 20));
          setIsControlEnabled(true);
        }
      }, 5000);
      
    } catch (error) {
      console.error('Fire command failed:', error);
      
      const failedFireCommand: RobotCommand = {
        id: `${commandId}-fail`,
        timestamp: new Date().toLocaleTimeString(),
        command: `❌ FIRE command failed: ${error instanceof Error ? error.message : String(error)}`,
        status: 'failed',
        source: 'websocket'
      };
      
      setRobotCommands(prev => [failedFireCommand, ...prev].slice(0, 20));
      setIsControlEnabled(true);
    }
  };

  // Send directional command via smart contract first, then WebSocket
  const sendCommand = async (direction: 'up' | 'down' | 'left' | 'right' | 'stop') => {
    if (!isControlEnabled) return;
    
    const sendTimestamp = new Date().toLocaleTimeString();
    const commandId = `cmd-${Date.now()}`;
    
    // Map UI direction to contract direction
    const contractDirection = DIRECTION_TO_CONTRACT_MAP[direction];
    
    // Add "sending blockchain transaction" command to log immediately
    const sendingBlockchainCommand: RobotCommand = {
      id: commandId,
      timestamp: sendTimestamp,
      command: `🔗 Sending blockchain transaction: ${direction.toUpperCase()}`,
      status: 'sent',
      source: 'blockchain'
    };
    
    setRobotCommands(prev => [sendingBlockchainCommand, ...prev].slice(0, 20));
    
    // Disable controls during entire process
    setIsControlEnabled(false);
    
    try {
      // STEP 1: Execute blockchain transaction FIRST and WAIT for confirmation
      // Try sponsored transaction first (Phase 2), fallback to regular transaction (Phase 1)
      let txResult;
      
      if (enokiAddress && zkLoginSession) {
        // Phase 2: Try sponsored transaction for better UX
        console.log('🎯 Attempting sponsored transaction...');
        txResult = await executeSponsoredContractMovement(contractDirection, direction);
        
        if (txResult.success) {
          console.log('✅ Sponsored transaction successful!');
          
          // Update command log to show it was sponsored
          const sponsoredCommand: RobotCommand = {
            id: `${commandId}-sponsored`,
          timestamp: new Date().toLocaleTimeString(),
            command: `🎁 SPONSORED: ${direction.toUpperCase()} (gas-free!)`,
          status: 'acknowledged',
          source: 'blockchain'
        };
          setRobotCommands(prev => [sponsoredCommand, ...prev].slice(0, 20));
        } else {
          console.log('⚠️ Sponsored transaction failed, falling back to regular transaction...');
          // Fallback to regular transaction
          txResult = await executeContractMovement(contractDirection, direction);
        }
      } else {
        // Phase 1: Regular transaction (traditional wallet)
        console.log('💳 Using regular transaction (traditional wallet)...');
        txResult = await executeContractMovement(contractDirection, direction);
      }
      
      if (!txResult.success) {
        throw new Error(txResult.error || 'Blockchain transaction failed');
      }
      
      // Add blockchain success log
      const blockchainSuccessCommand: RobotCommand = {
        id: `${commandId}-blockchain-success`,
        timestamp: new Date().toLocaleTimeString(),
        command: `✅ Blockchain confirmed: ${txResult.digest?.substring(0, 8)}...`,
        status: 'acknowledged',
        source: 'blockchain'
      };
      setRobotCommands(prev => [blockchainSuccessCommand, ...prev].slice(0, 20));
      
      // STEP 2: Only AFTER blockchain success, send WebSocket command
      if (isRobotConnected && robotWebSocketService.isConnected) {
        const robotCommand = mapDirectionToRobot(direction);
        
        const wsSuccess = robotWebSocketService.sendControlCommand(robotCommand, 0.5);
        
        if (wsSuccess) {
          const wsSuccessCommand: RobotCommand = {
            id: `${commandId}-websocket-success`,
            timestamp: new Date().toLocaleTimeString(),
            command: `🤖 Robot command sent: ${robotCommand}`,
            status: 'acknowledged',
            source: 'websocket'
          };
          setRobotCommands(prev => [wsSuccessCommand, ...prev].slice(0, 20));
        } else {
          throw new Error('WebSocket command failed');
        }
      } else {
        // Robot not connected, but blockchain transaction succeeded
        const wsWarningCommand: RobotCommand = {
          id: `${commandId}-websocket-warning`,
          timestamp: new Date().toLocaleTimeString(),
          command: `⚠️ Payment processed but robot offline`,
          status: 'acknowledged',
          source: 'websocket'
        };
        setRobotCommands(prev => [wsWarningCommand, ...prev].slice(0, 20));
      }
      
    } catch (error) {
      console.error('Command execution failed:', error);
      
      const failedCommand: RobotCommand = {
        id: `${commandId}-fail`,
        timestamp: new Date().toLocaleTimeString(),
        command: `❌ Command failed: ${error instanceof Error ? error.message : String(error)}`,
        status: 'failed',
        source: 'blockchain'
      };
      
      setRobotCommands(prev => [failedCommand, ...prev].slice(0, 20));
    } finally {
      // Re-enable controls after complete process
      setIsControlEnabled(true);
    }
  };



  // Initialize blockchain service
  const initializeBlockchain = async () => {
    try {
      setBlockchainError(null);
      console.log('🔗 Initializing blockchain integration...');
      
      // Connect wallet if available (both traditional wallet and Enoki)
      if (currentAccount || enokiAddress) {
        setBlockchainInitialized(true);
        
        // Get user address from either traditional wallet or Enoki
        const userAddress = currentAccount?.address || enokiAddress;
        
        // Connect traditional wallet if available
        if (currentAccount && signAndExecuteTransaction) {
          // Traditional wallet connection
          const wrappedSignAndExecute = (transaction: any): Promise<any> => {
            return new Promise((resolve, reject) => {
              signAndExecuteTransaction(
                { transaction },
                {
                  onSuccess: (result) => resolve(result),
                  onError: (error) => reject(error)
                }
              );
            });
          };
          
          suiCrossyRobotService.setWalletConnection(
            currentAccount.address,
            wrappedSignAndExecute
          );
          console.log('✅ Traditional wallet connected:', currentAccount.address);
        }
        // Connect Enoki wallet if available
        else if (enokiAddress && zkLoginSession) {
          // Enoki wallet connection - use Enoki's direct transaction execution
          const enokiSigner = async (transaction: any): Promise<any> => {
            try {
              // Set the sender address
              transaction.setSender(enokiAddress);
              
              // Build the transaction
              const txBytes = await transaction.build({ client: suiClient });
              
              // Get Enoki keypair and sign
              const signer = await enokiFlow.getKeypair({
                network: 'testnet',
              });
              const signature = await signer.signTransaction(txBytes);
              
              // Execute the transaction
              const result = await suiClient.executeTransactionBlock({
                transactionBlock: txBytes,
                signature: signature.signature,
                requestType: "WaitForLocalExecution",
                options: {
                  showEffects: true,
                  showEvents: true,
                  showObjectChanges: true,
                },
              });
              
              return result;
            } catch (error) {
              console.error('Enoki transaction execution failed:', error);
              throw error;
            }
          };

          // Set up the service with Enoki wallet connection
          suiCrossyRobotService.setWalletConnection(enokiAddress, enokiSigner);
          console.log('✅ Enoki wallet connected with blockchain transaction support');
          console.log('🔐 Using Enoki for automatic zkLogin handling');
        }
        
        // Set simple mock state
        setSuiGameState({
          userAddress: userAddress || '',
          isInitialized: true,
          balance: { user: 1.0, robot: 0.5 },
          gameObjectId: "0x3fbe01871af92ae00f9e201d82cb9fdbd1507fd5b9355e2cb50b161933b00c07",
          lastTransactionId: null,
          gameCreated: true,
          gameStarted: true,
          gameEnded: false,
          score: 0,
          lives: 3,
          position: { x: 0, y: 0 },
          direction: 'up'
        });
        
        console.log('✅ Blockchain integration ready');
      }
    } catch (error) {
      console.error('❌ Blockchain initialization failed:', error);
      setBlockchainError(error instanceof Error ? error.message : String(error));
    }
  };

  // Initialize blockchain on wallet connection
  useEffect(() => {
    initializeBlockchain();
  }, [currentAccount, enokiAddress, zkLoginSession]);

  // Auto-connect to Robot B when component mounts
  useEffect(() => {
    const autoConnect = async () => {
      if (gameState === 'connecting') {
        try {
          await connectToGame('robot-b');
        } catch (error) {
          console.error('Auto-connect to Robot B failed:', error);
        }
      }
    };

    autoConnect();
  }, []);



  // Handle different game states
  if (gameState === 'connecting') {
    return <LoadingModal message={loadingMessage} onCancel={() => setGameState('disconnected')} />;
  }
  
  if (gameState === 'error') {
    return (
      <ErrorModal 
        message={connectionError || 'Unknown connection error'}
        onRetry={connectToGame}
        onBack={onBack}
      />
    );
  }
  
  if (gameState === 'disconnected') {
    return <JoinGameView onJoin={connectToGame} sessionName={session.trackName} />;
  }

  // Main UI when connected
  return (
    <div className="w-full h-screen bg-[#0B0B1A] relative overflow-hidden flex flex-col">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-radial from-transparent via-[#0B0B1A]/80 to-[#0B0B1A]"/>
      
      {/* Header */}
      <div className="relative z-50 bg-gradient-to-r from-game-900/50 via-game-800/50 to-game-900/50 backdrop-blur-sm border-b border-white/5 p-4">
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
              <p className="text-sm text-white/70">Crossy Robo Viewer</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Camera Toggle */}
            {isAgoraConnected && (
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
            {isAgoraConnected && (
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
            {isAgoraConnected && (
              <Button
                variant="secondary"
                size="small"
                onClick={() => {
                  console.log(`🔍 CROSSY ROBO MANUAL DEBUG CHECK:`);
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


            
            {/* Connection Status */}
            <div className="flex items-center gap-4">
              {/* Video Status */}
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${isAgoraConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
                <span className="text-white/90 text-sm">
                  Video: {isAgoraConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              
              {/* Robot Status */}
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${isRobotConnected ? 'bg-blue-500 animate-pulse' : 'bg-gray-500'}`} />
                <span className="text-white/90 text-sm">
                  Robot: {isRobotConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>
            
            {/* Participants Count */}
            <div className="text-white/70 text-sm">
              {remoteUsers.size} Participant{remoteUsers.size !== 1 ? 's' : ''}
            </div>
            
            {/* Connection Controls */}
            <Button
              variant="secondary"
              size="small"
              onClick={disconnectFromGame}
              className="!bg-red-600 hover:!bg-red-700"
            >
              Leave Game
            </Button>
            
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

      {/* Main Content Area - Explicitly sized to exclude bottom panel */}
      <div className="flex" style={{ height: 'calc(100vh - 10rem)' }}>
        {/* Always show content when we reach this point since gameState is 'connected' */}
          <>
            {/* Left Side: Main Video View Area */}
            <div className="flex-1 relative flex items-center justify-center bg-black">
              {!hostUser ? (
                /* Waiting for Host */
                <div className="h-full flex items-center justify-center">
                  <div className="text-center text-white/70">
                    <div className="w-16 h-16 mx-auto mb-4 bg-white/5 rounded-full flex items-center justify-center">
                      <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-white mb-2">Waiting for Crossy Robo Host</h3>
                    <p className="text-sm mb-4">Host will appear here with AR overlay</p>
                    <p className="text-xs text-white/50">Participants: {remoteUsers.size}</p>
                  </div>
                </div>
              ) : null}

              {/* Host Video Container - populated dynamically with natural aspect ratio */}
              <div 
                ref={mainViewRef} 
                className="w-full h-full flex items-center justify-center"
                style={{ zIndex: 1 }}
              />



              {/* Stream Info Overlay */}
              {isAgoraConnected && (
                <div className="absolute top-4 left-4 z-50 bg-black/60 backdrop-blur-sm rounded-lg p-3 text-white">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-sm font-medium">Watching Crossy Robo Stream</span>
                  </div>
                  <div className="text-xs text-white/70">
                    Robot: B<br />
                    Channel: robot-video<br />
                    Your UID: {localUid}<br />
                    Host: {hostUser ? `User ${hostUser.uid}` : 'None'}<br />
                    Viewers: {remoteUsers.size}<br />
                  </div>
                </div>
              )}
            </div>

            {/* Right Side: Navigation Control Panel (Read-only for viewers) */}
            <div className="w-96 bg-gray-900 text-white border-l border-white/10 flex flex-col overflow-hidden relative z-20">
              {/* Control Panel Header - Fixed */}
              <div className="flex-shrink-0 p-4 border-b border-white/10 relative z-10">
                <h2 className="text-lg font-bold text-white mb-1 relative z-10">Crossy Control</h2>
                <p className="text-sm text-white/70 relative z-10">Navigate robots across the grid safely</p>
              </div>
              
              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto relative z-10">
                {/* Directional Control Pad (View Only) */}
                <div className="p-4 border-b border-white/10 relative z-10">
                  <h3 className="text-sm font-medium text-white mb-3 relative z-10">Robot Control</h3>
                  
                  {/* Robot Selection (now enabled) */}
                  <div className="mb-4 relative z-10">
                    <label className="text-xs text-white/70 mb-2 block relative z-10">Selected Robot</label>
                    <select 
                      value={selectedRobot}
                      onChange={(e) => setSelectedRobot(e.target.value)}
                      className="w-full bg-gray-800 border border-white/20 rounded px-3 py-2 text-white text-sm relative z-20 pointer-events-auto"
                    >
                      {robots.map(robot => (
                        <option key={robot.id} value={robot.id}>
                          {robot.name} ({robot.battery}%)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Control Pad */}
                  <div className="bg-gray-800 rounded-lg p-6 flex flex-col items-center">
                    {/* Up Button */}
                    <button
                      onClick={() => sendCommand('up')}
                      disabled={!isControlEnabled}
                      className={`
                        w-16 h-16 rounded-lg mb-2 flex items-center justify-center text-white font-bold text-xl
                        transition-all duration-150 relative z-20 pointer-events-auto
                        ${isControlEnabled 
                          ? 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 shadow-lg hover:shadow-xl' 
                          : 'bg-gray-600 cursor-not-allowed opacity-50'
                        }
                      `}
                    >
                      ↑
                    </button>
                    
                    {/* Middle Row: Left, Stop, Right */}
                    <div className="flex items-center gap-2 mb-2">
                      <button
                        onClick={() => sendCommand('left')}
                        disabled={!isControlEnabled}
                        className={`
                          w-16 h-16 rounded-lg flex items-center justify-center text-white font-bold text-xl
                          transition-all duration-150 relative z-20 pointer-events-auto
                          ${isControlEnabled 
                            ? 'bg-orange-600 hover:bg-orange-700 active:bg-orange-800 shadow-lg hover:shadow-xl' 
                            : 'bg-gray-600 cursor-not-allowed opacity-50'
                          }
                        `}
                      >
                        ←
                      </button>
                      
                      <button
                        onClick={sendFireCommand}
                        disabled={!isControlEnabled}
                        className={`
                          w-16 h-16 rounded-lg flex items-center justify-center text-white font-bold text-sm
                          transition-all duration-150 relative z-20 pointer-events-auto
                          ${isControlEnabled 
                            ? 'bg-red-600 hover:bg-red-700 active:bg-red-800 shadow-lg hover:shadow-xl' 
                            : 'bg-gray-600 cursor-not-allowed opacity-50'
                          }
                        `}
                      >
                        FIRE
                      </button>
                      
                      <button
                        onClick={() => sendCommand('right')}
                        disabled={!isControlEnabled}
                        className={`
                          w-16 h-16 rounded-lg flex items-center justify-center text-white font-bold text-xl
                          transition-all duration-150 relative z-20 pointer-events-auto
                          ${isControlEnabled 
                            ? 'bg-orange-600 hover:bg-orange-700 active:bg-orange-800 shadow-lg hover:shadow-xl' 
                            : 'bg-gray-600 cursor-not-allowed opacity-50'
                          }
                        `}
                      >
                        →
                      </button>
                    </div>
                    
                    {/* Down Button */}
                    <button
                      onClick={() => sendCommand('down')}
                      disabled={!isControlEnabled}
                      className={`
                        w-16 h-16 rounded-lg flex items-center justify-center text-white font-bold text-xl
                        transition-all duration-150 relative z-20 pointer-events-auto
                        ${isControlEnabled 
                          ? 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 shadow-lg hover:shadow-xl' 
                          : 'bg-gray-600 cursor-not-allowed opacity-50'
                        }
                      `}
                    >
                      ↓
                    </button>
                  </div>
                  
                  {/* Control Status */}
                  <div className="mt-3 text-center relative z-10">
                    <span className={`text-xs px-2 py-1 rounded ${
                      isControlEnabled 
                        ? 'bg-green-600/20 text-green-400' 
                        : 'bg-yellow-600/20 text-yellow-400'
                    }`}>
                      {isControlEnabled ? 'Ready' : 'Processing...'}
                    </span>
                    
                    {/* Cost Information */}
                    <div className="mt-2">
                      <div className="text-xs text-white/60">
                        Smart Contract: Move Robot
                      </div>
                      {enokiAddress && zkLoginSession ? (
                        <div className="text-xs text-green-400">
                          🎁 SPONSORED (completely free!)
                    </div>
                      ) : (
                        <div className="text-xs text-white/40">
                          Gas fee only (no payment required)
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Robot Command Log */}
                <div className="p-4 border-b border-white/10 relative z-10">
                  <h3 className="text-sm font-medium text-white mb-3 relative z-10">Robot Commands</h3>
                  <div className="bg-gray-800 rounded-lg p-3 h-48 overflow-y-auto relative z-10">
                    {robotCommands.length === 0 ? (
                      <div className="text-center text-white/50 text-sm py-8">
                        No commands sent yet
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {robotCommands.map((command) => (
                          <div key={command.id} className="text-xs">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-white/70">{command.timestamp}</span>
                              <div className="flex items-center gap-1">
                                <div className={`w-2 h-2 rounded-full ${
                                  command.status === 'sent' ? 'bg-yellow-400' :
                                  command.status === 'acknowledged' ? 'bg-green-400' :
                                  'bg-red-400'
                                }`} />
                                <span className={`text-xs ${
                                  command.status === 'sent' ? 'text-yellow-400' :
                                  command.status === 'acknowledged' ? 'text-green-400' :
                                  'text-red-400'
                                }`}>
                                  {command.status === 'sent' ? 'Sending' :
                                   command.status === 'acknowledged' ? 'Confirmed' :
                                   'Failed'}
                                </span>
                                <span className={`text-xs px-1 py-0.5 rounded ${
                                  command.source === 'websocket' ? 'bg-blue-600/20 text-blue-400' :
                                  'bg-purple-600/20 text-purple-400'
                                }`}>
                                  {command.source === 'websocket' ? 'WS' : 'BC'}
                                </span>
                              </div>
                            </div>
                            <div className="text-white font-medium">
                              {command.command}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Robot Status */}
                <div className="p-4 relative z-10">
                  <h3 className="text-sm font-medium text-white mb-3 relative z-10">Robot Status</h3>
                  <div className="space-y-2 relative z-10">
                    {robots.map((robot) => (
                      <div key={robot.id} className={`
                        flex items-center justify-between bg-gray-800 rounded p-2 border-l-4
                        ${robot.id === selectedRobot ? 'border-blue-400' : 'border-transparent'}
                      `}>
                        <div className="flex items-center gap-2">
                          <div className={`
                            w-2 h-2 rounded-full
                            ${robot.status === 'idle' ? 'bg-blue-400' : 
                              robot.status === 'moving' ? 'bg-yellow-400 animate-pulse' : 
                              'bg-green-400'}
                          `} />
                          <span className="text-sm text-white">{robot.name}</span>
                          {robot.id === selectedRobot && (
                            <span className="text-xs bg-blue-600 text-white px-1 py-0.5 rounded">
                              ACTIVE
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-white/70">
                          {robot.battery}% • {robot.status}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
      </div>

      {/* Bottom Viewer Panel - Fixed Height, Always Present */}
        <div className="h-24 bg-gray-900/90 backdrop-blur-sm border-t border-white/10 flex items-center px-4 flex-shrink-0">
          <div className="flex items-center gap-3 w-full">
            {/* Viewers Label */}
            <div className="text-white/70 text-sm font-medium whitespace-nowrap">
              Viewers ({Math.max(0, remoteUsers.size - (hostUser ? 1 : 0)) + 1})
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
    </div>
  );
};