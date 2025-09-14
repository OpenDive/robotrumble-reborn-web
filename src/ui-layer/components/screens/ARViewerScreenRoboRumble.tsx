import React, { useState, useRef, useEffect, useCallback } from 'react';
import AgoraRTC, { IAgoraRTCClient, IRemoteVideoTrack, IRemoteAudioTrack } from 'agora-rtc-sdk-ng';
import { Button } from '../shared/Button';
import { RaceSession } from '../../../shared/types/race';
import { APP_ID, fetchToken } from '../../../shared/utils/agoraAuth';
import { SuiWalletConnect } from '../shared/SuiWalletConnect';
import { useCurrentAccount, useSignAndExecuteTransaction, useSignTransaction, useSuiClient } from '@mysten/dapp-kit';
import { useEnokiFlow, useZkLogin, useZkLoginSession } from '@mysten/enoki/react';
import { useAuth } from '../../../shared/contexts/AuthContext';

interface ARViewerScreenRoboRumbleProps {
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

interface BattlePoint {
  row: number;
  col: number;
  id: string;
}

interface Robot {
  id: string;
  name: string;
  position: { x: number; y: number };
  status: 'idle' | 'moving' | 'battling' | 'offline';
  battery: number;
}

export const ARViewerScreenRoboRumble: React.FC<ARViewerScreenRoboRumbleProps> = ({ session, onBack }) => {
  const mainViewRef = useRef<HTMLDivElement>(null);
  const hostVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const splitScreenTopRef = useRef<HTMLVideoElement>(null);
  const splitScreenBottomRef = useRef<HTMLVideoElement>(null);
  
  // Agora refs
  const rtcClientRef = useRef<IAgoraRTCClient | null>(null);
  
  // Debounce ref for updateSplitScreenDisplay
  const updateDisplayTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isUpdatingDisplayRef = useRef<boolean>(false);
  
  // Persistent video element cache to prevent React render interruptions
  const videoElementCacheRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  
  // Track which video tracks are currently playing to prevent duplicate play() calls
  const playingTracksRef = useRef<Set<string>>(new Set());
  
  // Streaming state
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [localUid, setLocalUid] = useState<number | null>(null);
  const [remoteUsers, setRemoteUsers] = useState<Map<number, RemoteUser>>(new Map());
  const [hostUser, setHostUser] = useState<RemoteUser | null>(null);
  const [viewerUsers, setViewerUsers] = useState<Map<number, RemoteUser>>(new Map());
  const [splitScreenUsers, setSplitScreenUsers] = useState<RemoteUser[]>([]);
  const primaryUserIndexRef = useRef<number>(0);
  const [primaryUserIndex, setPrimaryUserIndex] = useState(0);
  
  useEffect(() => {
    primaryUserIndexRef.current = primaryUserIndex;
  }, [primaryUserIndex]);
  
  // Local media state for viewer chat
  const [localVideoTrack, setLocalVideoTrack] = useState<any>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<any>(null);
  const [isCameraEnabled, setIsCameraEnabled] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  
  // Battle control state (read-only for viewers)
  const [startPoint, setStartPoint] = useState<BattlePoint | null>(null);
  const [endPoint, setEndPoint] = useState<BattlePoint | null>(null);
  const [robots, setRobots] = useState<Robot[]>([
    { id: 'robot-a', name: 'Robot A', position: { x: 10, y: 10 }, status: 'idle', battery: 85 },
    { id: 'robot-b', name: 'Robot B', position: { x: 80, y: 60 }, status: 'idle', battery: 92 }
  ]);
  const [battleStatus, setBattleStatus] = useState<string>('waiting');
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'processing' | 'confirmed' | 'failed'>('pending');
  const [battleCost] = useState(0.5);

  // Chat system state
  const [chatMessages, setChatMessages] = useState<Array<{
    id: string;
    timestamp: string;
    sender: string;
    senderUid: number;
    message: string;
    isHost: boolean;
  }>>([]);
  const [currentMessage, setCurrentMessage] = useState<string>('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  // Wallet connection hooks - Enhanced with Enoki support  
  const currentAccount = useCurrentAccount();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const { mutate: signTransaction } = useSignTransaction();
  const suiClient = useSuiClient();
  const { address: zkLoginAddress } = useZkLogin();
  const zkLoginSession = useZkLoginSession();
  const { user } = useAuth();
  const enokiFlow = useEnokiFlow();


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

  // Simulate battle data for demo (in real app, this would come from host)
  useEffect(() => {
    const timer = setTimeout(() => {
      setStartPoint({ row: 2, col: 1, id: 'start' });
      setEndPoint({ row: 5, col: 6, id: 'end' });
      setBattleStatus('Ready to engage');
      setRobots(prev => prev.map(robot => 
        robot.id === 'robot-a' 
          ? { ...robot, status: 'moving' }
          : robot
      ));
    }, 3000); // Show battle points after 3 seconds

    return () => clearTimeout(timer);
  }, []);

  // Send chat message to host and other viewers
  const sendChatMessage = async () => {
    if (!currentMessage.trim() || isSendingMessage || !isConnected || !localUid) return;
    
    setIsSendingMessage(true);
    
    try {
      const timestamp = new Date().toLocaleTimeString();
      const messageId = `msg-${Date.now()}`;
      
      // Add message to local chat immediately
      const newMessage = {
        id: messageId,
        timestamp,
        sender: `Viewer${localUid.toString().slice(-2)}`,
        senderUid: localUid,
        message: currentMessage.trim(),
        isHost: false
      };
      
      setChatMessages(prev => [newMessage, ...prev].slice(0, 100)); // Keep last 100 messages
      
      // Send message to host and other viewers via Agora data channel (simulate for now)
      // In a real implementation, you would use Agora's data stream or a separate messaging service
      console.log(`📤 Viewer sent message: "${currentMessage}" to host and ${remoteUsers.size - 1} other viewers`);
      
      // Clear input
      setCurrentMessage('');
      
    } catch (error) {
      console.error('Failed to send chat message:', error);
    } finally {
      setIsSendingMessage(false);
    }
  };

  // Handle Enter key press in chat input
  const handleChatKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  };

  // Simulate receiving messages from host and other viewers
  useEffect(() => {
    if (!isConnected) return;
    
    const simulateMessages = () => {
      const hostMessages = [
        "Welcome to the battle arena! 🤖",
        "Robot A is looking strong today",
        "Let's see who wins this round!",
        "Thanks for watching everyone!",
        "The battle is about to begin...",
        "Great crowd today! 🎉",
        "Robot B has some new upgrades",
        "This should be an epic battle!"
      ];
      
      const viewerMessages = [
        "This is so exciting! 🔥",
        "Amazing AR effects!",
        "When does it start?",
        "Best stream ever! 💯",
        "The arena looks incredible",
      ];
      
      const viewerNames = ["RoboWatcher"];
      
      // 60% chance for host message, 40% for viewer message
      const isHostMessage = Math.random() > 0.4;
      const messages = isHostMessage ? hostMessages : viewerMessages;
      const randomMessage = messages[Math.floor(Math.random() * messages.length)];
      
      const timestamp = new Date().toLocaleTimeString();
      const messageId = `sim-msg-${Date.now()}`;
      
      if (isHostMessage) {
        // Host message
        const hostMessage = {
          id: messageId,
          timestamp,
          sender: 'Host',
          senderUid: hostUser?.uid || 1,
          message: randomMessage,
          isHost: true
        };
        
        setChatMessages(prev => [hostMessage, ...prev].slice(0, 100));
        console.log(`📥 Received host message: "${randomMessage}"`);
      } else {
        // Other viewer message
        const randomName = viewerNames[Math.floor(Math.random() * viewerNames.length)];
        const randomUid = Math.floor(Math.random() * 90000) + 10000; // Random 5-digit UID
        
        const viewerMessage = {
          id: messageId,
          timestamp,
          sender: randomName,
          senderUid: randomUid,
          message: randomMessage,
          isHost: false
        };
        
        setChatMessages(prev => [viewerMessage, ...prev].slice(0, 100));
        console.log(`📥 Received viewer message from ${randomName}: "${randomMessage}"`);
      }
    };
    
    // Start simulating messages after 8 seconds, then every 6-12 seconds
    const initialTimer = setTimeout(() => {
      simulateMessages();
      const interval = setInterval(() => {
        if (Math.random() > 0.2) { // 80% chance to send a message
          simulateMessages();
        }
      }, 6000 + Math.random() * 6000); // 6-12 seconds
      
      return () => clearInterval(interval);
    }, 8000);
    
    return () => clearTimeout(initialTimer);
  }, [isConnected, hostUser]);


  // Debounced version of updateSplitScreenDisplay to prevent rapid calls
  const debouncedUpdateSplitScreenDisplay = useCallback((users: RemoteUser[]) => {
    if (updateDisplayTimeoutRef.current) {
      clearTimeout(updateDisplayTimeoutRef.current);
    }
    
    updateDisplayTimeoutRef.current = window.setTimeout(() => {
      console.log('Updating split screen display with users:', users.length);
      updateSplitScreenDisplay(users);
      updateDisplayTimeoutRef.current = null;
    }, 100);
  }, [primaryUserIndex]);

  // Connect to stream
  const connectToStream = async () => {
    try {
      setConnectionError(null);
      console.log('Connecting to Robo Rumble stream...');
      
      // Create Agora client
      const client = AgoraRTC.createClient({ mode: 'live', codec: 'h264' });
      rtcClientRef.current = client;
      
      // Set up client events
      client.on('user-joined', (user) => {
        console.log(`🟢 User ${user.uid} joined the Robo Rumble channel`);
        
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
            existingUser.hasVideo = true;
            
            // Add user to split screen (first 2 users get split screen)
            setSplitScreenUsers(prev => {
              const updated = [...prev];
              const existingIndex = updated.findIndex(u => u.uid === existingUser.uid);
              
              if (existingIndex >= 0) {
                // Update existing user
                updated[existingIndex] = existingUser;
              } else if (updated.length < 2) {
                // Add new user to split screen if space available
                updated.push(existingUser);
                console.log(`📺 Added user ${user.uid} to split screen (position ${updated.length})`);
              }
              
              // Update split screen display with debouncing
              debouncedUpdateSplitScreenDisplay(updated);
              
              return updated;
            });
            
            // Determine if this is the host (first video publisher or has higher authority)
            // For simplicity, treat the first video publisher as host
            if (!hostUser) {
              console.log(`👑 User ${user.uid} is now the Robo Rumble HOST`);
              existingUser.isHost = true;
              setHostUser(existingUser);
            } else {
              console.log(`👥 User ${user.uid} is a VIEWER with video`);
              existingUser.isHost = false;
              setViewerUsers(prev => new Map(prev.set(user.uid as number, existingUser)));
            }
          }
          
          if (mediaType === 'audio' && user.audioTrack) {
            existingUser.audioTrack = user.audioTrack;
            existingUser.hasAudio = true;
            user.audioTrack.play();
            console.log(`🔊 Playing audio for user ${user.uid}`);
          }
          
          newMap.set(user.uid as number, existingUser);
          return newMap;
        });
      });
      
      client.on('user-unpublished', (user, mediaType) => {
        console.log(`🔇 User ${user.uid} unpublished ${mediaType}`);
        
        if (mediaType === 'video') {
          // Remove user from split screen
          setSplitScreenUsers(prev => {
            const updated = prev.filter(u => u.uid !== user.uid);
            debouncedUpdateSplitScreenDisplay(updated);
            return updated;
          });
          
          const remoteUser = remoteUsers.get(user.uid as number);
          if (remoteUser?.isHost) {
            setHostUser(null);
            console.log(`👑❌ Host stopped streaming`);
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
          return newMap;
        });
      });
      
      client.on('user-left', (user) => {
        console.log(`🔴 User ${user.uid} left the Robo Rumble channel`);
        
        // Clean up video element and playing tracks from cache
        const userKey = String(user.uid);
        const cachedElement = videoElementCacheRef.current.get(userKey);
        if (cachedElement) {
          videoElementCacheRef.current.delete(userKey);
          console.log(`🗑️ Cleaned up cached video element for user ${user.uid}`);
        }
        
        // Clean up playing tracks for this user
        const tracksToRemove = Array.from(playingTracksRef.current).filter(trackKey => 
          trackKey.startsWith(`${userKey}-`)
        );
        tracksToRemove.forEach(trackKey => {
          playingTracksRef.current.delete(trackKey);
          console.log(`🗑️ Cleaned up playing track: ${trackKey}`);
        });
        
        // Remove user from split screen
        setSplitScreenUsers(prev => {
          const updated = prev.filter(u => u.uid !== user.uid);
          debouncedUpdateSplitScreenDisplay(updated);
          return updated;
        });
        
        const remoteUser = remoteUsers.get(user.uid as number);
        if (remoteUser?.isHost) {
          setHostUser(null);
          console.log(`👑🚪 Host left`);
        }
        
        setRemoteUsers(prev => {
          const newMap = new Map(prev);
          newMap.delete(user.uid as number);
          return newMap;
        });
        
        setViewerUsers(prev => {
          const newMap = new Map(prev);
          newMap.delete(user.uid as number);
          return newMap;
        });
      });
      
      // Set client role to host (not audience) so that host can detect when we join
      await client.setClientRole('host');
      
      // Generate UID
      const uid = Math.floor(Math.random() * 100000);
      setLocalUid(uid);
      
      // Join channel - HARDCODED FOR TESTING
      const channelName = 'robot-video'; // Hardcoded channel name
      const token = await fetchToken(channelName, uid, 'host');
      await client.join(APP_ID, channelName, token, uid);
      console.log(`Joined channel ${channelName} with UID ${uid} as Robo Rumble viewer`);
      
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
    } catch (error) {
      console.error('Error connecting to stream:', error);
      setConnectionError(`Failed to connect: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const updateSplitScreenDisplay = (users: RemoteUser[], overridePrimaryIndex?: number) => {
    if (!mainViewRef.current) return;
    
    // Create main PiP container
    const pipContainer = document.createElement('div');
    pipContainer.id = 'pip-container';
    pipContainer.className = 'absolute inset-0 w-full h-full bg-black';
    
    // Create a single video container that holds all videos
    const videoContainer = document.createElement('div');
    
    // Clear existing overlays and event listeners from previous container if it exists
    const existingContainer = mainViewRef.current.querySelector('#video-container');
    if (existingContainer) {
      const existingOverlays = existingContainer.querySelectorAll('.user-overlay');
      existingOverlays.forEach(overlay => overlay.remove());
      
      // Clean up previous click handlers
      const existingClickArea = existingContainer.querySelector('.overlay-click-area');
      if (existingClickArea && (existingClickArea as any)._clickHandler) {
        existingClickArea.removeEventListener('click', (existingClickArea as any)._clickHandler);
      }
    }
    videoContainer.className = 'absolute inset-0 w-full h-full';
    videoContainer.id = 'video-container';
    
    // Create click area for overlay swapping (invisible)
    const overlayClickArea = document.createElement('div');
    overlayClickArea.className = 'absolute top-4 right-4 w-1/3 h-1/3 cursor-pointer z-20';
    overlayClickArea.id = 'pip-overlay-click';
    
    // Process each user and position their video elements using CSS
    users.forEach((user, index) => {
      const userKey = String(user.uid);
      
      // Try to reuse existing video element from persistent cache
      let videoElement = videoElementCacheRef.current.get(userKey);
      
      if (!videoElement && user.videoTrack) {
        // Create new video element only if we don't have one in cache
        videoElement = document.createElement('video');
        videoElement.autoplay = true;
        videoElement.playsInline = true;
        videoElement.muted = true;
        videoElement.setAttribute('data-uid', userKey);
        videoElement.style.position = 'absolute';
        videoElement.style.objectFit = 'contain';
        videoElement.style.backgroundColor = 'black';
        
        // Store in persistent cache
        videoElementCacheRef.current.set(userKey, videoElement);
        
        // Add to video container ONCE - never move it again
        videoContainer.appendChild(videoElement);
        
        // Play video track only once when creating new element
        const trackKey = `${userKey}-${user.videoTrack.getTrackId()}`;
        user.videoTrack.play(videoElement);
        playingTracksRef.current.add(trackKey);
        console.log(`📺 Playing video for user ${user.uid} in PiP position ${index + 1}`);
        
        // Debug logging
        videoElement.addEventListener('loadedmetadata', () => {
          console.log(`🔍 Video ${user.uid} dimensions: ${videoElement!.videoWidth}x${videoElement!.videoHeight}`);
          console.log(`🔍 Video ${user.uid} aspect ratio: ${videoElement!.videoWidth / videoElement!.videoHeight}`);
        });
      } else if (videoElement && user.videoTrack) {
        // Reusing existing video element - avoid calling play() unless it's a new track
        console.log(`♻️ Reusing existing video element for user ${user.uid}`);
        
        // Ensure video is in the container (but don't move if already there)
        if (videoElement.parentNode !== videoContainer) {
          videoContainer.appendChild(videoElement);
        }
        
        // Only play if this is a completely new track (different track ID)
        const currentTrackKey = `${userKey}-${user.videoTrack.getTrackId()}`;
        if (!playingTracksRef.current.has(currentTrackKey)) {
          // Clean up old track references for this user
          const oldTracks = Array.from(playingTracksRef.current).filter(trackKey => 
            trackKey.startsWith(`${userKey}-`)
          );
          oldTracks.forEach(trackKey => playingTracksRef.current.delete(trackKey));
          
          // Play new track
          user.videoTrack.play(videoElement);
          playingTracksRef.current.add(currentTrackKey);
          console.log(`🔄 Playing NEW video track for user ${user.uid}`);
        } else {
          console.log(`✅ Video track for user ${user.uid} already playing on cached element`);
        }
      } else {
        // No video element and no video track
        console.log(`⚠️ No video track or element for user ${user.uid}`);
        return; // Skip this user
      }
      
      // videoElement is guaranteed to be defined at this point
      if (!videoElement) return;
      
      // Use override index if provided, otherwise use current state
      const effectivePrimaryIndex = overridePrimaryIndex !== undefined ? overridePrimaryIndex : primaryUserIndex;
        
      // Determine if this should be the main video based on effective primary index
      const isMainVideo = (effectivePrimaryIndex === 0 && index === 0) || (effectivePrimaryIndex === 1 && index === 1);
      
      // Clear all positioning styles first
      videoElement.style.top = '';
      videoElement.style.left = '';
      videoElement.style.right = '';
      videoElement.style.bottom = '';
      videoElement.style.width = '';
      videoElement.style.height = '';
      videoElement.style.border = '';
      videoElement.style.borderRadius = '';
      
      if (isMainVideo) {
        // Position as main video (full screen)
        videoElement.style.top = '0px';
        videoElement.style.left = '0px';
        videoElement.style.width = '100%';
        videoElement.style.height = '100%';
        videoElement.style.zIndex = '1';
        videoElement.style.display = 'block';
        console.log(`🎯 Positioned user ${user.uid} as MAIN video`);
      } else if (index < 2) {
        // Position as overlay video (top-right corner)
        videoElement.style.top = '16px';
        videoElement.style.right = '16px';
        videoElement.style.left = 'auto';
        videoElement.style.width = '33.333333%';
        videoElement.style.height = '33.333333%';
        videoElement.style.zIndex = '10';
        videoElement.style.display = 'block';
        videoElement.style.border = '2px solid rgba(255, 255, 255, 0.3)';
        videoElement.style.borderRadius = '8px';
        console.log(`🎯 Positioned user ${user.uid} as OVERLAY video`);
      } else {
        // Hide additional users
        videoElement.style.display = 'none';
      }
    });
    
    // Add click handler to overlay area for swapping
    const handleOverlayClick = () => {
      const currentPrimaryIndex = primaryUserIndexRef.current;
      console.log('Overlay clicked, current primaryUserIndex:', currentPrimaryIndex);
      const newPrimaryIndex = currentPrimaryIndex === 0 ? 1 : 0;
      console.log('Setting new primaryUserIndex:', newPrimaryIndex);
      setPrimaryUserIndex(newPrimaryIndex);
      // Force immediate update after swap with new primary index
      setTimeout(() => {
        updateSplitScreenDisplay(users, newPrimaryIndex);
      }, 50);
    };
    
    overlayClickArea.addEventListener('click', handleOverlayClick);
    
    // Store reference for cleanup
    (overlayClickArea as any)._clickHandler = handleOverlayClick;
    
    // Add user info overlays
    users.forEach((user, index) => {
      const effectivePrimaryIndex = overridePrimaryIndex !== undefined ? overridePrimaryIndex : primaryUserIndex;
      const isMainVideo = (effectivePrimaryIndex === 0 && index === 0) || (effectivePrimaryIndex === 1 && index === 1);
      
      if (isMainVideo) {
        // Main video overlay
        const mainOverlay = document.createElement('div');
        mainOverlay.className = 'absolute bottom-4 left-4 bg-black/70 text-white px-3 py-1 rounded-lg text-sm z-20';
        mainOverlay.textContent = `${user.uid} (Main)`;
        pipContainer.appendChild(mainOverlay);
      } else if (index < 2) {
        // PiP video overlay
        const pipOverlay = document.createElement('div');
        pipOverlay.className = 'absolute top-5 right-5 bg-black/70 text-white px-2 py-0.5 rounded text-xs z-20';
        pipOverlay.textContent = String(user.uid);
        pipContainer.appendChild(pipOverlay);
      }
    });
    
    // Add placeholder if only one user
    if (users.length === 1) {
      const placeholder = document.createElement('div');
      placeholder.className = 'absolute top-4 right-4 w-1/3 h-1/3 flex items-center justify-center bg-gray-800/80 text-white/60 border-2 border-white/30 rounded-lg z-10';
      placeholder.innerHTML = `<div class="text-center">
        <div class="text-2xl mb-2">⏳</div>
        <div>Waiting for Robot B...</div>
      </div>`;
      pipContainer.appendChild(placeholder);
    }
    
    // Append video container to main PiP container
    pipContainer.appendChild(videoContainer);
    pipContainer.appendChild(overlayClickArea);
    
    // Add the PiP container to the main view
    mainViewRef.current.appendChild(pipContainer);
    
    console.log(`✅ Split screen updated with ${users.length} users`);
  };

  // Initialize split screen on connection
  useEffect(() => {
    if (isConnected && mainViewRef.current) {
      // Initialize empty split screen
      debouncedUpdateSplitScreenDisplay([]);
    }
  }, [isConnected]);

  // Disconnect from stream
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
      
      // Clean up split screen container
      const splitScreenContainer = document.getElementById('split-screen-container');
      if (splitScreenContainer) {
        splitScreenContainer.remove();
        if (mainViewRef.current) {
          mainViewRef.current.innerHTML = '';
        }
      
        // Clear video element cache and playing tracks
        videoElementCacheRef.current.clear();
        playingTracksRef.current.clear();
        console.log('🗑️ Cleared all cached video elements and playing tracks');
      
        setIsConnected(false);
        setLocalUid(null);
        setRemoteUsers(new Map());
        setHostUser(null);
        setViewerUsers(new Map());
        setSplitScreenUsers([]);
        console.log('Disconnected from Robo Rumble stream');
      }
      setViewerUsers(new Map());
      setSplitScreenUsers([]);
      console.log('Disconnected from Robo Rumble stream');
    } catch (error) {
      console.error('Error disconnecting from stream:', error);
    }
  };


  // Initialize blockchain service (for viewing RoboRumble state)
  useEffect(() => {
    const initializeBlockchain = async () => {
      try {
        console.log('🔗 Initializing RoboRumble blockchain integration for viewer...');
        
        let walletConnected = false;
        
        // Connect wallet for read-only RoboRumble state monitoring
        if (zkLoginSession && zkLoginAddress && enokiFlow) {
          console.log('🔐 Connecting RoboRumble viewer with Enoki zkLogin session...');
          try {
            const enokiSigner = async (transaction: any): Promise<any> => {
              try {
                transaction.setSender(zkLoginAddress);
                const txBytes = await transaction.build({ client: suiClient });
                
                const signer = await enokiFlow.getKeypair({
                  network: 'testnet',
                });
                const signature = await signer.signTransaction(txBytes);
                
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
                console.error('❌ Enoki RoboRumble viewer transaction failed:', error);
                throw error;
              }
            };
            
            // Note: RoboRumble would use its own service here when available
            walletConnected = true;
            console.log('✅ Enoki RoboRumble viewer wallet connected');
          } catch (enokiError) {
            console.warn('⚠️ Enoki RoboRumble viewer connection failed:', enokiError);
          }
        }
        
        if (!walletConnected && currentAccount && signAndExecuteTransaction) {
          console.log('🏦 Connecting RoboRumble viewer with dapp-kit wallet...');
          
          const dappKitSignAndExecute = (transaction: any): Promise<any> => {
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
          
          // Note: RoboRumble would use its own service here when available
          walletConnected = true;
          console.log('✅ dapp-kit RoboRumble viewer wallet connected');
        }
        
        console.log('🔍 RoboRumble Viewer Wallet Connection State:', {
          isConnected: walletConnected,
          isUsingEnoki: !!(zkLoginSession && zkLoginAddress),
          address: zkLoginAddress || currentAccount?.address,
          zkLoginSession: !!zkLoginSession,
          jwt: !!user
        });
        
        console.log('✅ RoboRumble viewer blockchain integration ready');
      } catch (error) {
        console.error('❌ RoboRumble viewer blockchain initialization failed:', error);
      }
    };
    
    initializeBlockchain();
  }, [currentAccount, signAndExecuteTransaction, zkLoginSession, zkLoginAddress, enokiFlow, user]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
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
              <p className="text-sm text-white/70">RoboRumble Stream</p>
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

      {/* Main Content Area */}
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
              <h3 className="text-lg font-medium text-white mb-2">Ready to Join RoboRumble Session</h3>
              <p className="text-sm mb-4">Connect to watch the synchronized RoboRumble demo with AR overlay</p>
              <p className="text-xs text-white/50">Channel: robot-video</p>
            </div>
          </div>
        ) : (
          <>
            {/* Left Side: Main Split Screen View Area */}
            <div className="flex-1 relative">
              {/* Split Screen Container - populated dynamically */}
              <div 
                ref={mainViewRef} 
                className="absolute inset-0 w-full h-full"
                style={{ zIndex: 1 }}
              />


              {/* Stream Info Overlay */}
              {isConnected && (
                <div className="absolute top-4 left-4 z-10 bg-black/60 backdrop-blur-sm rounded-lg p-3 text-white">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-sm font-medium">Split Screen View</span>
                  </div>
                  <div className="text-xs text-white/70">
                    Channel: robot-video<br />
                    Your UID: {localUid}<br />
                    Split Screen: {splitScreenUsers.length}/2<br />
                    Total Viewers: {remoteUsers.size}
                  </div>
                </div>
              )}
            </div>

            {/* Right Side: Battle Control Panel (Read-only for viewers) */}
            <div className="w-[28rem] bg-gray-900 text-white border-l border-white/10 flex flex-col overflow-hidden relative z-20">
              {/* Chat Header - Fixed */}
              <div className="flex-shrink-0 p-4 border-b border-white/10 relative z-10">
                <h2 className="text-lg font-bold text-white mb-1 relative z-10">Rumble Chat</h2>
                <p className="text-sm text-white/70 relative z-10">Chat with host and other viewers</p>
                {isConnected && (
                  <div className="mt-2 flex items-center gap-2 relative z-10">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-xs text-green-400">
                      {hostUser ? 'Host online' : 'Waiting for host'} • {Math.max(0, remoteUsers.size - (hostUser ? 1 : 0))} viewers
                    </span>
                  </div>
                )}
              </div>
              
              {/* Chat Messages - Scrollable */}
              <div className="flex-1 overflow-y-auto p-4 relative z-10">
                <div className="space-y-3 relative z-10">
                  {chatMessages.length === 0 ? (
                    <div className="text-center text-white/50 text-sm py-8 relative z-10">
                      {isConnected ? 'Chat is ready! Say hello...' : 'Connect to join the chat'}
                    </div>
                  ) : (
                    chatMessages.map((msg) => (
                      <div key={msg.id} className={`
                        flex flex-col gap-1 p-3 rounded-lg relative z-10
                        ${msg.isHost 
                          ? 'bg-blue-600/20 border-l-4 border-blue-400 mr-4' 
                          : msg.senderUid === localUid
                            ? 'bg-green-600/20 border-l-4 border-green-400 ml-4'
                            : 'bg-gray-800/50 border-l-4 border-purple-400 mr-4'
                        }
                      `}>
                        <div className="flex items-center justify-between relative z-10">
                          <div className="flex items-center gap-2 relative z-10">
                            <span className={`text-xs font-medium relative z-10 ${
                              msg.isHost ? 'text-blue-400' : 
                              msg.senderUid === localUid ? 'text-green-400' : 'text-purple-400'
                            }`}>
                              {msg.senderUid === localUid ? 'You' : msg.sender}
                            </span>
                            {msg.isHost && (
                              <span className="text-xs bg-blue-600 text-white px-1 py-0.5 rounded relative z-10">
                                HOST
                              </span>
                            )}
                            {msg.senderUid === localUid && (
                              <span className="text-xs bg-green-600 text-white px-1 py-0.5 rounded relative z-10">
                                YOU
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-white/50 relative z-10">{msg.timestamp}</span>
                        </div>
                        <div className="text-sm text-white break-words relative z-10">
                          {msg.message}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              
              {/* Chat Input - Fixed at bottom */}
              <div className="flex-shrink-0 p-4 border-t border-white/10 relative z-10">
                <div className="flex gap-2 relative z-10">
                  <input
                    type="text"
                    value={currentMessage}
                    onChange={(e) => setCurrentMessage(e.target.value)}
                    onKeyPress={handleChatKeyPress}
                    placeholder={isConnected ? "Type a message..." : "Connect to chat"}
                    disabled={!isConnected || isSendingMessage}
                    className="flex-1 bg-gray-800 border border-white/20 rounded px-3 py-2 text-white text-sm
                              placeholder-white/50 focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400
                              disabled:opacity-50 disabled:cursor-not-allowed relative z-10"
                    maxLength={200}
                  />
                  <button
                    onClick={sendChatMessage}
                    disabled={!isConnected || !currentMessage.trim() || isSendingMessage}
                    className={`
                      px-4 py-2 rounded text-sm font-medium transition-all duration-150 relative z-20 pointer-events-auto
                      ${(!isConnected || !currentMessage.trim() || isSendingMessage)
                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                        : 'bg-purple-600 hover:bg-purple-700 text-white shadow-lg hover:shadow-xl'
                      }
                    `}
                  >
                    {isSendingMessage ? (
                      <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    )}
                  </button>
                  <button
                    className="px-3 py-2 rounded text-sm font-medium transition-all duration-150 relative z-20 pointer-events-auto
                              bg-yellow-600 hover:bg-yellow-700 text-white"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M9 1L8 6l4-1 4 1-1-5-4 1.5L9 1z" />
                    </svg>
                  </button>
                </div>
                
                {/* Chat Status */}
                <div className="mt-2 text-xs text-white/50 relative z-10">
                  {isConnected ? (
                    <>
                      Press Enter to send • {currentMessage.length}/200 characters
                    </>
                  ) : (
                    'Connect to stream to enable chat'
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Bottom Viewer Panel */}
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
                    <div className="w-full h-full bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg overflow-hidden border-2 border-blue-400 relative">
                      {isCameraEnabled ? (
                        <video 
                          ref={localVideoRef}
                          className="w-full h-full object-cover"
                          autoPlay
                          playsInline
                          muted
                          style={{ transform: 'scaleX(-1)' }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white font-semibold text-xs">
                          YOU
                        </div>
                      )}
                    </div>
                    
                    {/* Status indicators */}
                    <div className="absolute -bottom-1 -right-1 flex gap-1">
                      <div className={`w-3 h-3 rounded-full border border-gray-900 ${isCameraEnabled ? 'bg-blue-400' : 'bg-gray-500'}`}></div>
                      <div className={`w-3 h-3 rounded-full border border-gray-900 ${isMicEnabled ? 'bg-green-400' : 'bg-gray-500'}`}></div>
                    </div>
                    
                    {/* UID label */}
                    <div className="absolute top-0 left-0 right-0 bg-black/60 text-white text-xs px-1 py-0.5 rounded-t-lg text-center truncate">
                      {localUid}
                    </div>
                  </div>
                )}
                
                {/* Other viewers - removed duplicate video rendering */}
                {Array.from(remoteUsers.entries())
                  .filter(([uid, user]) => uid !== hostUser?.uid)
                  .map(([uid, user]) => (
                    <div key={uid} className="flex-shrink-0 w-16 h-16 relative">
                      <div className="w-full h-full bg-gradient-to-br from-purple-500 to-purple-700 rounded-lg flex items-center justify-center text-white font-semibold text-xs overflow-hidden">
                        {/* Video rendering handled by updateSplitScreenDisplay function */}
                        {uid.toString().slice(-2)}
                      </div>
                      
                      {/* Status indicators */}
                      <div className="absolute -bottom-1 -right-1 flex gap-1">
                        <div className={`w-3 h-3 rounded-full border border-gray-900 ${user.hasVideo ? 'bg-blue-400' : 'bg-gray-500'}`}></div>
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