import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import AgoraRTC, { IAgoraRTCClient, IRemoteVideoTrack, IRemoteAudioTrack } from 'agora-rtc-sdk-ng';
import { Button } from '../shared/Button';
import { LoadingModal } from '../shared/LoadingModal';
import { ErrorModal } from '../shared/ErrorModal';
import { JoinGameView } from '../shared/JoinGameView';
import { RaceSession } from '../../../shared/types/race';
import { APP_ID, fetchToken } from '../../../shared/utils/agoraAuth';
import { EnhancedARDetector, DetectedMarker } from '../../../engine-layer/core/ar/EnhancedARDetector';
import { GameRenderSystem } from '../../../engine-layer/core/renderer/GameRenderSystem';
import { suiCrossyRobotService, GameState as SuiGameState } from '../../../shared/services/suiCrossyRobotService';
import { SuiWalletConnect } from '../shared/SuiWalletConnect';
import { useCurrentAccount, useSignAndExecuteTransaction, useSignTransaction, useSuiClient } from '@mysten/dapp-kit';
import { useEnokiFlow, useZkLogin, useZkLoginSession } from '@mysten/enoki/react';
import { useAuth } from '../../../shared/contexts/AuthContext';

import { AREffectsRenderer } from '../../../engine-layer/core/ar/AREffectsRenderer';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { robotWebSocketService, RobotFeedback, RobotCommand } from '../../services/RobotWebSocketService';

// Environment configuration for robot WebSocket
const ROBOT_WS_URL = 'wss://hurricane-laboratories-ddc1627c10dd.herokuapp.com/ws';
const ROBOT_ROOM_ID = 'default';
const ROBOT_WS_ENABLED = 'false';

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

interface ThreeJSKey {
  markerId: number;
  mesh: THREE.Object3D;
  lastSeen: number;
}

interface ARViewerScreenCrossyRoboState {
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  keyScale: number;
}

class ThreeViewerEngine {
  private hostVideoElement: HTMLVideoElement;
  private logMessage: (message: string) => void;
  private options: { keyScale: number };
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private animationFrameId: number | null = null;
  private assetsLoaded = false;
  private keyModelTemplate: THREE.Object3D | null = null;
  private keys: ThreeJSKey[] = [];
  private resizeHandler: () => void;

  constructor(hostVideoElement: HTMLVideoElement, logMessage: (message: string) => void, options: { keyScale: number } = { keyScale: 7.0 }) {
    this.hostVideoElement = hostVideoElement;
    this.logMessage = logMessage;
    this.options = options;

    // Setup canvas
    this.canvas = document.createElement('canvas');
    this.canvas.id = `ar-viewer-canvas-${hostVideoElement.id}`;
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = '10';
    this.canvas.style.backgroundColor = 'transparent';
    this.canvas.style.mixBlendMode = 'normal';

    // Find container and add canvas
    let container = hostVideoElement.parentElement;
    if (container) {
      if (getComputedStyle(container).position === 'static') {
        container.style.position = 'relative';
      }
      container.appendChild(this.canvas);
      this.logMessage('Added AR canvas to host video container');
    } else {
      document.body.appendChild(this.canvas);
      this.logMessage('Warning: Could not find proper container, added AR canvas to document body');
    }

    // Initialize ThreeJS
    this.initThreeJS();

    // Handle window resize
    this.resizeHandler = this.onResize.bind(this);
    window.addEventListener('resize', this.resizeHandler);

    this.logMessage('ThreeJS AR Viewer Engine initialized');
  }

  private initThreeJS(): void {
    // Create renderer with transparency
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      premultipliedAlpha: false,
      antialias: true
    });
    this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);
    this.renderer.setClearColor(0x000000, 0); // Transparent background

    // Create scene
    this.scene = new THREE.Scene();

    // Create camera
    this.camera = new THREE.PerspectiveCamera(
      75, // Field of view
      this.canvas.clientWidth / this.canvas.clientHeight, // Aspect ratio
      0.1, // Near clipping plane
      1000 // Far clipping plane
    );
    this.camera.position.z = 5;

    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(0, 1, 1);
    this.scene.add(directionalLight);

    // Start animation loop
    this.startRenderLoop();
  }

  private startRenderLoop(): void {
    const animate = () => {
      this.animationFrameId = requestAnimationFrame(animate);

      // Render the scene
      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera);
      }
    };

    animate();
  }

  private onResize(): void {
    if (this.canvas && this.renderer && this.camera) {
      // Get the current size of the container
      const width = this.canvas.clientWidth;
      const height = this.canvas.clientHeight;

      // Update camera aspect ratio
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();

      // Update renderer size
      this.renderer.setSize(width, height, false);
    }
  }

  async loadAssets(): Promise<boolean> {
    try {
      this.logMessage('Loading 3D key model for ThreeJS viewer...');

      // Try to load the actual key.glb model first
      const gltfLoader = new GLTFLoader();
      
      try {
        this.logMessage('Attempting to load key.glb model...');
        const gltf = await new Promise<any>((resolve, reject) => {
          gltfLoader.load(
            '/key.glb', // Path to the GLTF file in the public directory
            (gltf) => resolve(gltf),
            (progress) => {
              this.logMessage(`Loading key.glb: ${Math.round((progress.loaded / progress.total) * 100)}%`);
            },
            (error) => reject(error)
          );
        });

        // Successfully loaded GLTF model
        this.keyModelTemplate = gltf.scene.clone();
        if (this.keyModelTemplate) {
          this.keyModelTemplate.visible = false;
          // Scale the model appropriately
          this.keyModelTemplate.scale.set(0.5, 0.5, 0.5);
        }

        this.logMessage('Successfully loaded key.glb model');
      } catch (gltfError) {
        this.logMessage(`Failed to load key.glb: ${gltfError}. Using fallback key.`);
        
        // Create a fallback golden key if GLTF loading fails
        const createFallbackKey = (): THREE.Group => {
          this.logMessage('Creating fallback key model for viewer');
          const keyGroup = new THREE.Group();

          // Create gold material
          const goldMaterial = new THREE.MeshStandardMaterial({
            color: 0xffd700,
            metalness: 0.8,
            roughness: 0.2,
            emissive: 0x664800,
            emissiveIntensity: 0.2
          });

          // Create a simple key-like shape
          const shaftGeometry = new THREE.CylinderGeometry(0.1, 0.1, 1.0, 16);
          const shaft = new THREE.Mesh(shaftGeometry, goldMaterial);
          shaft.position.y = -0.5;
          keyGroup.add(shaft);

          const headGeometry = new THREE.BoxGeometry(0.6, 0.4, 0.2);
          const head = new THREE.Mesh(headGeometry, goldMaterial);
          head.position.y = 0.2;
          keyGroup.add(head);

          const teeth1Geometry = new THREE.BoxGeometry(0.15, 0.25, 0.2);
          const teeth1 = new THREE.Mesh(teeth1Geometry, goldMaterial);
          teeth1.position.set(-0.2, -1.0, 0);
          keyGroup.add(teeth1);

          const teeth2Geometry = new THREE.BoxGeometry(0.15, 0.35, 0.2);
          const teeth2 = new THREE.Mesh(teeth2Geometry, goldMaterial);
          teeth2.position.set(0, -1.0, 0);
          keyGroup.add(teeth2);

          // Scale the key appropriately
          keyGroup.scale.set(0.5, 0.5, 0.5);

          this.logMessage('Fallback key created with bright gold material');
          return keyGroup;
        };

        // Use fallback key
        this.keyModelTemplate = createFallbackKey();
        if (this.keyModelTemplate) {
          this.keyModelTemplate.visible = false;
        }
      }

      // Add to scene but keep hidden
      if (this.scene && this.keyModelTemplate) {
        this.scene.add(this.keyModelTemplate);
      }

      this.assetsLoaded = true;
      this.logMessage('ThreeJS assets loaded successfully for viewer');

      return true;
    } catch (error) {
      this.logMessage(`Error loading ThreeJS assets for viewer: ${error}`);
      return false;
    }
  }

  async addKey(markerId: number): Promise<ThreeJSKey> {
    // Make sure assets are loaded
    if (!this.assetsLoaded) {
      await this.loadAssets();
    }

    // Clone the key model template
    if (!this.keyModelTemplate || !this.scene) {
      throw new Error('Key template or scene not available');
    }

    const keyInstance = this.keyModelTemplate.clone();
    keyInstance.visible = false; // Initially hidden
    keyInstance.name = `viewer-key-${markerId}`;

    // Add to the scene
    this.scene.add(keyInstance);

    // Store key data
    const key: ThreeJSKey = {
      markerId,
      mesh: keyInstance,
      lastSeen: Date.now()
    };

    this.keys.push(key);
    this.logMessage(`Created ThreeJS key for marker ${markerId}`);
    return key;
  }

  private calculateDistanceScale(marker: DetectedMarker): number {
    // Calculate apparent size of marker
    if (!marker.corners || marker.corners.length < 4) return 1.0;

    const corners = marker.corners;
    const width = Math.abs(corners[1].x - corners[0].x);
    const height = Math.abs(corners[3].y - corners[0].y);
    const apparentSize = Math.sqrt(width * width + height * height);

    // Base expected size (you may need to adjust this based on your setup)
    const baseSize = 100;
    const sizeRatio = apparentSize / baseSize;

    // Apply logarithmic scaling for more natural distance perception
    return Math.max(0.1, Math.min(2.0, Math.log(sizeRatio + 1) + 0.5));
  }

  private calculateMarkerConstraints(marker: DetectedMarker): { scale: number; distanceScale: number; bounds?: any } {
    if (!marker.corners || marker.corners.length < 4) {
      return { scale: 1, distanceScale: 1 };
    }

    // Calculate marker dimensions in 2D space
    const corners = marker.corners;
    const xs = corners.map(c => c.x);
    const ys = corners.map(c => c.y);
    
    const bounds = {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys)
    };

    // Use marker size to determine appropriate scale
    const markerSize = Math.min(bounds.width, bounds.height);

    // Scale factor to keep key within marker bounds (with some padding)
    const maxKeySize = markerSize * 0.12; // 12% of marker size  
    const keyScale = maxKeySize / 90; // Divide by 90 to get the right scale

    // Calculate distance-based scale
    const distanceScale = this.calculateDistanceScale(marker);

    return {
      scale: Math.max(keyScale, 0.1), // Minimum scale to ensure visibility
      distanceScale: distanceScale,
      bounds: bounds
    };
  }

  private markerTo3DPosition(marker: DetectedMarker, depth: number = -1.0): THREE.Vector3 {
    if (!marker.center) {
      return new THREE.Vector3(0, 0, depth);
    }

    // Convert from screen coordinates to normalized device coordinates
    const videoWidth = this.hostVideoElement.videoWidth || 640;
    const videoHeight = this.hostVideoElement.videoHeight || 480;

    // Normalize coordinates to [-1, 1] range
    const normalizedX = (marker.center.x / videoWidth) * 2 - 1;
    const normalizedY = -((marker.center.y / videoHeight) * 2 - 1); // Flip Y axis

    // Convert to world coordinates based on camera position and field of view
    const aspectRatio = videoWidth / videoHeight;
    if (!this.camera) {
      return new THREE.Vector3(0, 0, depth);
    }
    const fov = this.camera.fov * Math.PI / 180; // Convert to radians
    const distance = Math.abs(depth);

    const worldY = Math.tan(fov / 2) * distance * normalizedY;
    const worldX = worldY * aspectRatio * normalizedX;

    return new THREE.Vector3(worldX, worldY, depth);
  }

  updateWithMarkers(markers: DetectedMarker[]): void {
    if (!this.assetsLoaded) return;

    const now = Date.now();

    if (markers && markers.length > 0) {
      // Filter out marker ID 0 and only process specific marker IDs (64, 1, 2, 3)
      const validMarkers = markers.filter(marker => 
        marker.id !== 0 && (marker.id === 64 || marker.id === 1 || marker.id === 2 || marker.id === 3)
      );

      // Process each valid marker
      validMarkers.forEach(marker => {
        // Find corresponding key for this marker
        let key = this.keys.find(k => k.markerId === marker.id);

        // If no key exists for this marker ID, create one
        if (!key) {
          this.addKey(marker.id).then(newKey => {
            key = newKey;
          });
          return;
        }

        // Show key
        key.mesh.visible = true;

        try {
          // Calculate constraints based on marker corners
          const constraints = this.calculateMarkerConstraints(marker);

          // Position the key based on marker center and constraints
          let position: THREE.Vector3;

          if (marker.poseMatrix) {
            // Use pose matrix if available for accurate 3D positioning
            const matrix = new THREE.Matrix4().fromArray(marker.poseMatrix.elements);
            const pos = new THREE.Vector3();
            const quaternion = new THREE.Quaternion();
            const scale = new THREE.Vector3();
            matrix.decompose(pos, quaternion, scale);

            // Apply constraints to keep key within marker bounds
            pos.multiplyScalar(0.01); // Bring it closer
            pos.z = Math.max(pos.z, -2.0); // Don't go too far back
            pos.z = Math.min(pos.z, -0.5); // Don't come too close

            position = pos;
            key.mesh.quaternion.copy(quaternion);
          } else {
            // Fallback to 2D-to-3D conversion using marker center
            position = this.markerTo3DPosition(marker, -1.0);
          }

          // Apply position
          key.mesh.position.copy(position);

          // Apply constrained scale based on marker size AND distance
          const baseScale = constraints.scale * this.options.keyScale;
          const finalScale = baseScale * constraints.distanceScale; // Apply distance scaling
          key.mesh.scale.set(finalScale, finalScale, finalScale);

          // Optional: Add slight rotation for visual effect, but keep it subtle
          key.mesh.rotation.y += 0.005; // Slower rotation to avoid distraction

          // Log positioning info for debugging
          this.logMessage(`ThreeJS Key ${marker.id} positioned at (${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)}) with scale ${finalScale.toFixed(2)} (base: ${baseScale.toFixed(2)}, distance: ${constraints.distanceScale.toFixed(2)})`);

        } catch (err) {
          this.logMessage(`Error positioning ThreeJS key: ${err}`);
        }

        key.lastSeen = now;
      });

      // Hide keys for markers that are no longer visible
      this.keys.forEach(key => {
        const markerVisible = validMarkers.some(m => m.id === key.markerId);
        const timeSinceLastSeen = now - key.lastSeen;

        if (!markerVisible || timeSinceLastSeen > 500) {
          key.mesh.visible = false;
        }
      });
    } else {
      // No markers detected - hide all keys
      this.keys.forEach(key => {
        key.mesh.visible = false;
      });
    }
  }

  dispose(): void {
    // Stop animation frame
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }

    // Dispose of ThreeJS resources
    if (this.scene) {
      // Remove and dispose all objects from the scene
      while(this.scene.children.length > 0) { 
        const object = this.scene.children[0];
        this.scene.remove(object);

        // Dispose geometries and materials
        if ((object as any).geometry) (object as any).geometry.dispose();
        if ((object as any).material) {
          if (Array.isArray((object as any).material)) {
            (object as any).material.forEach((material: any) => material.dispose());
          } else {
            (object as any).material.dispose();
          }
        }
      }
    }

    // Dispose renderer
    if (this.renderer) {
      this.renderer.dispose();
    }

    // Remove canvas
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }

    // Remove resize listener
    window.removeEventListener('resize', this.resizeHandler);

    this.logMessage('ThreeJS AR Viewer Engine disposed');
  }

  updateKeyScale(newScale: number): void {
    this.options.keyScale = newScale;
    this.logMessage(`Updated key scale to: ${newScale}`);
  }
}

export const ARViewerScreenCrossyRobo: React.FC<ARViewerScreenCrossyRoboProps> = ({ session, onBack }) => {
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
  
  // Connection state - unified for both video and robot
  const [gameState, setGameState] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
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

  // Add ThreeJS viewer imports
  const threeViewerEngineRef = useRef<ThreeViewerEngine | null>(null);
  const [arOverlayReady, setArOverlayReady] = useState(false);

  // AR effects renderer
  const arEffectsRendererRef = useRef<AREffectsRenderer | null>(null);

  // Add key scale state
  const [keyScale, setKeyScale] = useState(5.0);

  // Helper function to get the host video element
  const getHostVideoElement = (): HTMLVideoElement | null => {
    // Find all video elements and return the one with valid dimensions
    const allVideos = document.querySelectorAll('video') as NodeListOf<HTMLVideoElement>;
    
    // Filter for videos with valid dimensions that are playing
    const validVideos = Array.from(allVideos).filter(video => 
      video && 
      video.videoWidth > 0 && 
      video.videoHeight > 0 &&
      !video.paused &&
      video.currentTime > 0
    );
    
    if (validVideos.length > 0) {
      // Return the video with the largest dimensions (likely the main host video)
      const bestVideo = validVideos.reduce((best, current) => {
        const bestSize = best.videoWidth * best.videoHeight;
        const currentSize = current.videoWidth * current.videoHeight;
        return currentSize > bestSize ? current : best;
      });
      
      logMessage(`[AR Crossy Robo Viewer] Found valid host video: id="${bestVideo.id}", dimensions=${bestVideo.videoWidth}x${bestVideo.videoHeight}`);
      return bestVideo;
    }
    
    // Fallback: find any video with dimensions, even if paused
    const videosWithDimensions = Array.from(allVideos).filter(video => 
      video && video.videoWidth > 0 && video.videoHeight > 0
    );
    
    if (videosWithDimensions.length > 0) {
      const fallbackVideo = videosWithDimensions[0];
      logMessage(`[AR Crossy Robo Viewer] Using fallback video: id="${fallbackVideo.id}", dimensions=${fallbackVideo.videoWidth}x${fallbackVideo.videoHeight}`);
      return fallbackVideo;
    }
    
    // Debug logging
    logMessage(`[AR Crossy Robo Viewer] No valid video found. Found ${allVideos.length} total videos:`);
    allVideos.forEach((v, i) => {
      logMessage(`[AR Crossy Robo Viewer] Video ${i}: id="${v.id}", dimensions=${v.videoWidth}x${v.videoHeight}, playing=${!v.paused}`);
    });
    
    return null;
  };

  // Helper function for logging messages
  const logMessage = (message: string) => {
    console.log(message);
  };

  const initializeAROverlay = async () => {
    const video = getHostVideoElement();
    if (!video) {
      logMessage('[AR Crossy Robo Viewer] No host video element found');
      // Debug: Log all available video elements
      const allVideos = document.querySelectorAll('video');
      logMessage(`[AR Crossy Robo Viewer] Found ${allVideos.length} video elements in DOM`);
      allVideos.forEach((v, i) => {
        logMessage(`[AR Crossy Robo Viewer] Video ${i}: id="${v.id}", data-uid="${v.getAttribute('data-uid')}", dimensions=${v.videoWidth}x${v.videoHeight}`);
      });
      return;
    }

    logMessage(`[AR Crossy Robo Viewer] Found host video element: id="${video.id}", dimensions=${video.videoWidth}x${video.videoHeight}`);

    // Wait for video to be ready if dimensions aren't available yet
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      logMessage('[AR Crossy Robo Viewer] Video dimensions not ready yet, waiting...');
      setTimeout(() => initializeAROverlay(), 500);
      return;
    }

    try {
      // Initialize original AR detector for marker detection only
      if (!arDetectorRef.current) {
        arDetectorRef.current = new EnhancedARDetector((msg: string) => logMessage(`[AR Crossy Robo Viewer] ${msg}`));
        await arDetectorRef.current.initialize();
        logMessage('[AR Crossy Robo Viewer] AR Detector initialized');
      }

      // Initialize ThreeJS viewer engine for 3D key rendering
      if (!threeViewerEngineRef.current) {
        threeViewerEngineRef.current = new ThreeViewerEngine(
          video,
          (msg: string) => logMessage(`[AR Crossy Robo Viewer] ${msg}`),
          { keyScale: keyScale } // Use state value
        );
        
        // Wait for assets to load before proceeding
        const assetsLoaded = await threeViewerEngineRef.current.loadAssets();
        if (!assetsLoaded) {
          logMessage('[AR Crossy Robo Viewer] Failed to load ThreeJS assets');
          return;
        }
        
        // Pre-create keys for common marker IDs (matching reference implementation)
        await threeViewerEngineRef.current.addKey(1);
        await threeViewerEngineRef.current.addKey(2);
        await threeViewerEngineRef.current.addKey(3);
        
        logMessage('[AR Crossy Robo Viewer] ThreeJS Viewer Engine initialized with pre-created keys');
      }

      // Initialize other AR systems (effects, etc.)
      if (!arEffectsRendererRef.current) {
        arEffectsRendererRef.current = new AREffectsRenderer({ particleCount: 100 });
        if (renderSystemRef.current?.getScene()) {
          arEffectsRendererRef.current.initialize(renderSystemRef.current.getScene()!);
        }
        logMessage('[AR Crossy Robo Viewer] AR Effects Renderer initialized');
      }

      if (!renderSystemRef.current) {
        renderSystemRef.current = new GameRenderSystem();
        // Initialize with a canvas if needed
        if (canvasRef.current) {
          renderSystemRef.current.initialize(canvasRef.current);
        }
        logMessage('[AR Crossy Robo Viewer] Game Render System initialized');
      }

      setArOverlayReady(true);
      logMessage('[AR Crossy Robo Viewer] AR overlay initialized successfully');
      
      // Start AR rendering loop
      setArInitialized(true);
      startARRenderingLoop();
      logMessage('[AR Crossy Robo Viewer] AR rendering loop started');
    } catch (error) {
      logMessage(`[AR Crossy Robo Viewer] Failed to initialize AR overlay: ${error}`);
    }
  };

  // Start AR rendering loop
  const startARRenderingLoop = () => {
    let frameCount = 0;
    let lastLogTime = 0;

    const renderLoop = () => {
      frameCount++;
      
      const video = getHostVideoElement();
      if (!video || !arDetectorRef.current || !threeViewerEngineRef.current) {
        animationFrameRef.current = requestAnimationFrame(renderLoop);
        return;
      }

      try {
        // Check video readiness
        if (video.videoWidth === 0 || video.videoHeight === 0 || video.paused || video.ended) {
          animationFrameRef.current = requestAnimationFrame(renderLoop);
          return;
        }

        // Log progress every 5 seconds to show the loop is running
        const now = Date.now();
        if (now - lastLogTime > 5000) {
          logMessage(`[AR Crossy Robo Viewer] AR detection loop running - Frame ${frameCount}, Video: ${video.videoWidth}x${video.videoHeight}, ID: ${video.id}`);
          lastLogTime = now;
        }

        // Check video readiness periodically
        if (frameCount % 60 === 0) {
          logMessage(`[AR Crossy Robo Viewer] AR Render Loop Frame ${frameCount} - Video ready: ${video.videoWidth}x${video.videoHeight}, Current time: ${video.currentTime}, Paused: ${video.paused}`);
        }

        // Detect markers in the host video stream
        const detectedMarkers = arDetectorRef.current.detectMarkers(video);

        // Transform detected markers to the format expected by ThreeJS engine
        let formattedMarkers: DetectedMarker[] = [];
        
        // Debug: Log the raw detection results occasionally
        if (frameCount % 120 === 0) { // Every 2 seconds
          logMessage(`[AR Crossy Robo Viewer] Raw marker detection: ${detectedMarkers ? detectedMarkers.length : 'null'} markers found`);
          if (detectedMarkers && detectedMarkers.length > 0) {
            detectedMarkers.forEach((marker, idx) => {
              logMessage(`[AR Crossy Robo Viewer] Raw marker ${idx}: id=${marker.id}, corners=${marker.corners?.length}, center=${marker.center ? `(${marker.center.x.toFixed(1)}, ${marker.center.y.toFixed(1)})` : 'none'}`);
            });
          }
        }
        
        if (detectedMarkers && detectedMarkers.length > 0) {
          formattedMarkers = detectedMarkers.map(marker => {
            // Ensure marker has the required properties for ThreeJS engine
            const formattedMarker: DetectedMarker = {
              id: marker.id || 1, // Fallback to ID 1 if not provided
              corners: marker.corners || [],
              center: marker.center || {
                x: marker.corners && marker.corners.length > 0 ? 
                   marker.corners.reduce((sum, corner) => sum + corner.x, 0) / marker.corners.length : 
                   video.videoWidth / 2,
                y: marker.corners && marker.corners.length > 0 ? 
                   marker.corners.reduce((sum, corner) => sum + corner.y, 0) / marker.corners.length : 
                   video.videoHeight / 2
              },
              pose: marker.pose,
              poseMatrix: marker.poseMatrix
            };

            // Log the formatted marker data
            if (frameCount % 30 === 0) { // Log every 30 frames to avoid spam
              logMessage(`[AR Crossy Robo Viewer] Formatted marker ${formattedMarker.id}: center=(${formattedMarker.center.x.toFixed(1)}, ${formattedMarker.center.y.toFixed(1)}), corners=${formattedMarker.corners.length}, pose=${formattedMarker.poseMatrix ? 'YES' : 'NO'}`);
            }

            return formattedMarker;
          });

          logMessage(`[AR Crossy Robo Viewer] Detected ${formattedMarkers.length} markers on host stream`);
        } else {
          // No markers detected - do nothing
          if (frameCount % 300 === 0) { // Every 5 seconds
            logMessage(`[AR Crossy Robo Viewer] No markers detected`);
          }
        }
        
        // Update ThreeJS viewer with formatted markers for 3D key rendering
        threeViewerEngineRef.current.updateWithMarkers(formattedMarkers);

        // Also update AR effects (particles, etc.)
        if (renderSystemRef.current && arEffectsRendererRef.current && formattedMarkers.length > 0) {
          renderSystemRef.current.updateAREffects(formattedMarkers);
        }

        setDetectedMarkers(formattedMarkers);
      } catch (error) {
        if (frameCount % 60 === 0) { // Only log errors occasionally to avoid spam
          logMessage(`[AR Crossy Robo Viewer] Error in render loop: ${error}`);
        }
      }

      animationFrameRef.current = requestAnimationFrame(renderLoop);
    };

    logMessage('[AR Crossy Robo Viewer] Starting AR detection render loop');
    animationFrameRef.current = requestAnimationFrame(renderLoop);
  };

  const cleanupAROverlay = () => {
    try {
      // Stop animation loop
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      // Cleanup ThreeJS viewer engine
      if (threeViewerEngineRef.current) {
        threeViewerEngineRef.current.dispose();
        threeViewerEngineRef.current = null;
        logMessage('[AR Crossy Robo Viewer] ThreeJS Viewer Engine disposed');
      }

      // Cleanup other AR systems
      if (arDetectorRef.current) {
        arDetectorRef.current.dispose();
        arDetectorRef.current = null;
        logMessage('[AR Crossy Robo Viewer] AR Detector disposed');
      }

      if (arEffectsRendererRef.current) {
        arEffectsRendererRef.current.dispose();
        arEffectsRendererRef.current = null;
        logMessage('[AR Crossy Robo Viewer] AR Effects Renderer disposed');
      }

      if (renderSystemRef.current) {
        renderSystemRef.current.dispose();
        renderSystemRef.current = null;
        logMessage('[AR Crossy Robo Viewer] Game Render System disposed');
      }

      setArOverlayReady(false);
      setArInitialized(false);
      setDetectedMarkers([]);
      logMessage('[AR Crossy Robo Viewer] AR overlay cleanup completed');
    } catch (error) {
      logMessage(`[AR Crossy Robo Viewer] Error during AR overlay cleanup: ${error}`);
    }
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
  const connectToGame = async () => {
    setGameState('connecting');
    setConnectionError(null);
    
    try {
      // Step 1: Connect to Agora (video streaming)
      setLoadingMessage('Connecting to video stream...');
      await connectToAgoraStream();
      
      // Step 2: Connect to Robot WebSocket
      setLoadingMessage('Connecting to robot control...');
      await connectToRobot();
      
      // Step 3: Both connections successful
      setGameState('connected');
      console.log('✅ Full game connection established');
      
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
            
            // Determine if this is the host (first video publisher or has higher authority)
            // For simplicity, treat the first video publisher as host
            if (!hostUser) {
              console.log(`👑 User ${user.uid} is now the Crossy Robo HOST`);
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
                  // Remove mirroring for host video
                  hostVideo.id = `host-video-${user.uid}`;
                  hostVideo.setAttribute('data-uid', user.uid.toString()); // Add data-uid attribute for AR detection
                  mainContainer.appendChild(hostVideo);
                  
                  // Store reference for AR detection
                  hostVideoRef.current = hostVideo;
                  
                  // Add to main view container
                  if (mainViewRef.current) {
                    // Clear any existing content first
                    mainViewRef.current.innerHTML = '';
                    mainViewRef.current.appendChild(mainContainer);
                    
                    // Play video in main view
                    user.videoTrack!.play(hostVideo);
                    
                    console.log(`🎮 Crossy Robo host video displayed in main view for user ${user.uid}`);
                    
                    // Initialize AR overlay for host stream
                    setTimeout(() => {
                      const initializeARWhenReady = () => {
                        if (hostVideo.videoWidth > 0 && hostVideo.videoHeight > 0) {
                          console.log(`📐 Host video dimensions ready: ${hostVideo.videoWidth}x${hostVideo.videoHeight}`);
                          // Use the same logic as Force AR button for reliable initialization
                          setTimeout(() => {
                            initializeAROverlay();
                          }, 1000); // Give video a moment to be fully ready
                        } else {
                          setTimeout(initializeARWhenReady, 500);
                        }
                      };
                      
                      hostVideo.addEventListener('loadeddata', () => {
                        console.log('📹 Host video loadeddata event fired');
                        setTimeout(initializeARWhenReady, 200);
                      });
                      
                      hostVideo.addEventListener('playing', () => {
                        console.log('📹 Host video playing event fired');
                        setTimeout(initializeARWhenReady, 200);
                      });

                      // Also try to initialize periodically while video is loading
                      const checkInterval = setInterval(() => {
                        if (hostVideo.videoWidth > 0 && hostVideo.videoHeight > 0 && !hostVideo.paused) {
                          console.log('📹 Host video ready via interval check');
                          clearInterval(checkInterval);
                          setTimeout(() => {
                            initializeAROverlay();
                          }, 1000);
                        }
                      }, 1000);

                      // Stop checking after 30 seconds
                      setTimeout(() => clearInterval(checkInterval), 30000);
                      
                      // Start checking immediately
                      setTimeout(initializeARWhenReady, 2000);
                    }, 100);
                  }
                }, 100);
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
            cleanupAROverlay();
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
          cleanupAROverlay();
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

  // Send directional command via WebSocket (with optional blockchain payment)
  const sendCommand = async (direction: 'up' | 'down' | 'left' | 'right' | 'stop') => {
    if (!isControlEnabled) return;
    
    // Check robot WebSocket connection first
    if (!isRobotConnected || !robotWebSocketService.isConnected) {
      const errorMsg = 'Robot not connected';
      const errorCommand: RobotCommand = {
        id: `error-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        command: `❌ Error: ${errorMsg}`,
        status: 'failed',
        source: 'websocket'
      };
      setRobotCommands(prev => [errorCommand, ...prev].slice(0, 20));
      return;
    }
    
    const sendTimestamp = new Date().toLocaleTimeString();
    const commandId = `cmd-${Date.now()}`;
    
    // Map directions to robot commands
    const robotCommand = direction === 'up' ? 'forward' : 
                         direction === 'down' ? 'backward' :
                         direction === 'left' ? 'left' :
                         direction === 'right' ? 'right' : 'stop';
    
    // Add "sent" command to log immediately
    const sentCommand: RobotCommand = {
      id: commandId,
      timestamp: sendTimestamp,
      command: `🚀 Sending: ${robotCommand}`,
      status: 'sent',
      source: 'websocket'
    };
    
    setRobotCommands(prev => [sentCommand, ...prev].slice(0, 20));
    
    // Disable controls temporarily to prevent spam
    setIsControlEnabled(false);
    
    try {
      // Send WebSocket command (fast, ~10-50ms)
      const success = robotWebSocketService.sendControlCommand(robotCommand, 0.5);
      
      if (!success) {
        throw new Error('Failed to send WebSocket command');
      }
      
      // PERFORMANCE OPTIMIZATION: Fire blockchain transaction asynchronously without waiting
      // This decouples robot control (immediate) from blockchain payments (1-3 seconds)
      // Allows for rapid robot commands and stress testing of both systems independently
      if ((currentAccount || enokiAddress) && direction !== 'stop') {
        executeBlockchainPaymentAsync(commandId, direction);
      }
      
    } catch (error) {
      // Add "failed" command to log
      const failTimestamp = new Date().toLocaleTimeString();
      const failedCommand: RobotCommand = {
        id: `${commandId}-fail`,
        timestamp: failTimestamp,
        command: `❌ Command failed: ${error}`,
        status: 'failed',
        source: 'websocket'
      };
      
      setRobotCommands(prev => [failedCommand, ...prev].slice(0, 20));
      console.error('Failed to send robot command:', error);
    } finally {
      // Re-enable controls immediately after WebSocket command (not waiting for blockchain)
      // This enables rapid-fire commands for stress testing and responsive UX
      setIsControlEnabled(true);
    }
  };

  // Async blockchain payment handler (runs independently of robot commands)
  const executeBlockchainPaymentAsync = async (commandId: string, direction: string) => {
    try {
      // Import Transaction here for direct use
      const { Transaction } = await import('@mysten/sui/transactions');
      
      // Create a simple payment transaction
      const transaction = new Transaction();
      
      // Split 0.05 SUI (50,000,000 MIST) from gas coin for payment
      const [coin] = transaction.splitCoins(transaction.gas, [transaction.pure.u64(50_000_000)]);
      
      // Transfer the payment to the robot address
      transaction.transferObjects([coin], transaction.pure.address("0xcbdddb4e89a23e2ca51d41b5e05230fbfa502dc672cc58e298ec952d170b0901"));
      
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
      }
      
      // Add blockchain payment confirmation
      if (result) {
        const paymentCommand: RobotCommand = {
          id: `${commandId}-payment`,
          timestamp: new Date().toLocaleTimeString(),
          command: `💰 Payment sent: TX ${(result as any).digest?.substring(0, 8)}...`,
          status: 'acknowledged',
          source: 'blockchain'
        };
        setRobotCommands(prev => [paymentCommand, ...prev].slice(0, 20));
      }
    } catch (paymentError) {
      console.warn('Blockchain payment failed, but robot command was sent:', paymentError);
      const paymentFailCommand: RobotCommand = {
        id: `${commandId}-payment-fail`,
        timestamp: new Date().toLocaleTimeString(),
        command: `💰 Payment failed: ${paymentError}`,
        status: 'failed',
        source: 'blockchain'
      };
      setRobotCommands(prev => [paymentFailCommand, ...prev].slice(0, 20));
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

  // Add key scale slider handler
  const handleKeyScaleChange = (newScale: number) => {
    setKeyScale(newScale);
    if (threeViewerEngineRef.current) {
      threeViewerEngineRef.current.updateKeyScale(newScale);
    }
  };

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
              <p className="text-sm text-white/70">Crossy Robo Viewer {arInitialized && '(AR Active)'}</p>
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

            {/* AR Status */}
            {arInitialized && (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-blue-400 text-sm">AR Detection</span>
              </div>
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
                    <h3 className="text-lg font-medium text-white mb-2">Waiting for Crossy Robo Host</h3>
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
                    zIndex: 10,
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
              {isAgoraConnected && (
                <div className="absolute top-4 left-4 z-50 bg-black/60 backdrop-blur-sm rounded-lg p-3 text-white">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-sm font-medium">Watching Crossy Robo Stream</span>
                  </div>
                  <div className="text-xs text-white/70">
                    Channel: robot-video<br />
                    Your UID: {localUid}<br />
                    Host: {hostUser ? `User ${hostUser.uid}` : 'None'}<br />
                    Viewers: {remoteUsers.size}<br />
                    {arInitialized && (
                      <>
                        AR Status: Active<br />
                        Markers: {detectedMarkers.length}
                        {detectedMarkers.length > 0 && (
                          <span className="text-green-400"> ✓ RENDERING</span>
                        )}
                        <div className="mt-2">
                          <label className="block text-xs mb-1">Key Size: {keyScale.toFixed(1)}</label>
                          <input
                            type="range"
                            min="5.0"
                            max="20"
                            step="0.5"
                            value={keyScale}
                            onChange={(e) => handleKeyScaleChange(parseFloat(e.target.value))}
                            className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                          />
                        </div>
                      </>
                    )}
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
                        onClick={() => sendCommand('stop')}
                        disabled={!isControlEnabled}
                        className={`
                          w-16 h-16 rounded-lg flex items-center justify-center text-white font-bold text-xs
                          transition-all duration-150 relative z-20 pointer-events-auto
                          ${isControlEnabled 
                            ? 'bg-green-600 hover:bg-green-700 active:bg-green-800 shadow-lg hover:shadow-xl' 
                            : 'bg-gray-600 cursor-not-allowed opacity-50'
                          }
                        `}
                      >
                        Create<br/>Game
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
                        Each move: 0.05 SUI
                      </div>
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