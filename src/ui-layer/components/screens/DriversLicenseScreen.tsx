import React, { useState, useRef, useEffect } from 'react';
import { FaCamera, FaRedo } from 'react-icons/fa';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGamepad } from '@fortawesome/free-solid-svg-icons';
import { DriversLicenseCard } from '../cards/DriversLicenseCard';
import { CountdownOverlay } from '../overlays/CountdownOverlay';
import { triggerNeonConfetti } from '../../utils/confetti';
import SuiWalletConnect from '../shared/SuiWalletConnect';

type CaptureState = 'camera' | 'preview';
type CountdownState = 'idle' | 'counting' | 'capturing';

interface DriversLicenseScreenProps {
  onComplete: () => void;
}

export const DriversLicenseScreen: React.FC<DriversLicenseScreenProps> = ({ onComplete }) => {
  const [captureState, setCaptureState] = useState<CaptureState>('camera');
  const [photoData, setPhotoData] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFlashing, setIsFlashing] = useState(false);
  const [countdownState, setCountdownState] = useState<CountdownState>('idle');
  const [countdownNumber, setCountdownNumber] = useState<number>(3);
  const [showPreviewAnimation, setShowPreviewAnimation] = useState(false);

  useEffect(() => {
    startCamera();

    // Add keyboard listeners for spacebar and flash test
    const handleKeyPress = async (event: KeyboardEvent) => {
      if (captureState === 'camera') {
        if (event.code === 'Space' && countdownState === 'idle') {
          await startCountdown();
        } else if (event.code === 'Escape' && countdownState === 'counting') {
          setCountdownState('idle');
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);

    return () => {
      // Cleanup: stop the camera and remove event listener when component unmounts
      if (videoRef.current) {
        const stream = videoRef.current.srcObject as MediaStream;
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
      }
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [captureState]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setError('Unable to access camera. Please make sure you have granted camera permissions.');
      console.error('Error accessing camera:', err);
    }
  };

  const startCountdown = async () => {
    if (countdownState !== 'idle') return;
    
    setCountdownState('counting');
    setCountdownNumber(3);

    // Start countdown
    for (let i = 3; i > 0; i--) {
      setCountdownNumber(i);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Take photo after countdown
    await capturePhoto();
  };

  const capturePhoto = async () => {
    setCountdownState('capturing');
    if (videoRef.current) {
      const video = videoRef.current;
      
      // Trigger flash effect
      setIsFlashing(true);
      
      // Create a promise that resolves after the flash duration
      const flashDuration = 750; // ms
      await new Promise(resolve => {
        // Pause the video during the flash
        video.pause();
        
        setTimeout(() => {
          setIsFlashing(false);
          resolve(null);
        }, flashDuration);
      });

      // Capture the photo
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 400;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        // Calculate dimensions for zoomed crop (matching our 150% zoom)
        const zoomLevel = 1.5;
        const cropSize = Math.min(video.videoWidth, video.videoHeight) / zoomLevel;
        
        // Center the crop in the video
        const sourceX = (video.videoWidth - cropSize) / 2;
        const sourceY = (video.videoHeight - cropSize) / 2;
        
        // Draw the zoomed portion
        ctx.drawImage(
          video,
          sourceX, sourceY,           // Start at center
          cropSize, cropSize,         // Take a square crop at our zoom level
          0, 0,                      // Place at top-left of canvas
          canvas.width, canvas.height // Fill the canvas
        );
        
        const photoData = canvas.toDataURL('image/jpeg');
        setPhotoData(photoData);
        
        // Resume video playback before changing state
        video.play();
        
        // Switch to preview state with animation
        setCaptureState('preview');
        setCountdownState('idle');
        setShowPreviewAnimation(true);
      }
    }
  };

  const handleRetake = () => {
    setShowPreviewAnimation(false);
    setPhotoData(null);
    setCaptureState('camera');
    startCamera();
  };

  const handleDone = async () => {
    // Stop camera before animations
    if (videoRef.current) {
      const stream = videoRef.current.srcObject as MediaStream;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    }

    // Play confetti animation
    triggerNeonConfetti();
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Navigate to game menu
    onComplete();
  };

  const renderCamera = () => (
    <div className="relative w-full max-w-2xl mx-auto space-y-6">
      {/* Speech bubble */}
      <div className="relative bg-white rounded-2xl p-6 shadow-lg mb-4 animate-float">
        {/* Speech bubble arrow */}
        <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2">
          <div className="w-8 h-8 bg-white rotate-45 transform origin-center"></div>
        </div>
        
        <div className="flex items-center gap-4">
          <FontAwesomeIcon 
            icon={faGamepad} 
            className="text-3xl text-[#4C9EFF] animate-bounce"
          />
          <p className="text-[#4C9EFF] text-lg">
            Point the kart's camera at your face, and press <span className="text-[#4C9EFF] font-bold">SPACE</span> or the <span className="text-[#4C9EFF] font-bold">Take Photo</span> button to snap a photo! 📸
          </p>
        </div>
      </div>
      <div className="relative h-[400px] overflow-hidden">
        {/* Countdown overlay */}
        <CountdownOverlay 
          number={countdownNumber}
          isVisible={countdownState === 'counting'}
        />
        {/* Video element */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="absolute w-[150%] h-[150%] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-xl bg-black object-cover"
        />

        {/* Camera frame overlay - positioned above video */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 border-2 border-[#4C9EFF]/50 rounded-xl shadow-[0_0_30px_rgba(76,158,255,0.3)]" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#4C9EFF]/10 via-transparent to-[#4C9EFF]/10 animate-pulse-slow rounded-xl" />
        </div>
      </div>

      {/* Button - outside of overlay stack */}
      <button
        onClick={startCountdown}
        disabled={countdownState !== 'idle'}
        className={`w-full flex items-center justify-center px-6 py-4 text-lg font-bold rounded-2xl text-black bg-[#FFD700] hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#FFD700] transition-all duration-200 active:animate-button-press shadow-[0_0_20px_-5px_rgba(255,215,0,0.5)] hover:shadow-[0_0_30px_-5px_rgba(255,215,0,0.8)]`}
      >
        <FaCamera className="mr-3" /> Take Photo
      </button>

      {/* Hidden canvas for photo capture */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );

  const renderLicensePreview = () => (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* License card */}
      {photoData && (
        <DriversLicenseCard
          animate={showPreviewAnimation}
          photoData={photoData}
          playerName="Player 1"
          issueDate={new Date()}
          licenseType="Learner's Permit"
          className="animate-float"
        />
      )}

      {/* Action buttons */}
      <div className="flex gap-4 max-w-lg mx-auto">
        <button
          onClick={handleRetake}
          className="group relative flex-1 flex items-center justify-center px-6 py-4 text-lg font-bold rounded-xl text-white bg-black/40 hover:bg-black/60 backdrop-blur-sm border border-white/5 transition-all duration-200 active:scale-95 overflow-hidden"
        >
          {/* Vertical indicator */}
          <div className="absolute left-0 top-2 bottom-2 w-1 bg-[#4C9EFF] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
          
          {/* Icon container */}
          <div className="flex items-center justify-center gap-3">
            <div className="relative">
              <FaRedo className="relative z-10 transition-transform duration-200 group-hover:rotate-180" />
              <div className="absolute inset-0 blur-sm bg-[#4C9EFF] opacity-0 group-hover:opacity-50 transition-opacity duration-200" />
            </div>
            <span>Retake Photo</span>
          </div>

          {/* Hover glow effect */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
            <div className="absolute inset-0 bg-[#4C9EFF] blur-2xl opacity-10" />
          </div>
        </button>

        <button
          onClick={handleDone}
          className="group relative flex-1 flex items-center justify-center px-6 py-4 text-lg font-bold rounded-xl text-black bg-racing-yellow hover:bg-opacity-90 transition-all duration-200 active:scale-95 overflow-hidden shadow-[0_0_30px_-5px_rgba(255,215,0,0.3)] hover:shadow-[0_0_30px_-5px_rgba(255,215,0,0.5)]"
        >
          {/* Vertical indicator */}
          <div className="absolute left-0 top-2 bottom-2 w-1 bg-black rounded-full opacity-0 group-hover:opacity-30 transition-opacity duration-200" />
          
          {/* Content */}
          <span className="relative z-10">Done</span>

          {/* Hover glow effect */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
            <div className="absolute inset-0 bg-white blur-2xl opacity-10" />
          </div>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Flash overlay - covers entire viewport */}
      <div 
        className={`fixed inset-0 bg-white pointer-events-none transition-opacity duration-750 z-50
          ${isFlashing ? 'opacity-60' : 'opacity-0'}`}
      />
      
      {/* Wallet address button - positioned at top right */}
      <div className="fixed top-6 right-6 z-50">
        <SuiWalletConnect />
      </div>

      <div className="min-h-screen flex items-center justify-center bg-[#0B0B1A] relative overflow-hidden">
        {/* Background grid effect */}
        <div className="absolute inset-0 w-[200%] h-[200%] -top-1/2 -left-1/2">
          <div 
            className="absolute inset-0 opacity-80"
            style={{
              backgroundImage: `
                linear-gradient(to right, #B24BF3 1px, transparent 1px),
                linear-gradient(to bottom, #B24BF3 1px, transparent 1px)
              `,
              backgroundSize: '40px 40px',
              transform: 'perspective(1000px) rotateX(60deg)',
              transformOrigin: 'center center',
            }}
          />
        </div>

        {/* Animated glow overlay */}
        <div 
          className="absolute inset-0 opacity-30"
          style={{
            background: `
              radial-gradient(circle at 50% 50%, #B24BF3 0%, transparent 50%),
              radial-gradient(circle at 0% 0%, #4C9EFF 0%, transparent 40%),
              radial-gradient(circle at 100% 100%, #FFD700 0%, transparent 40%)
            `
          }}
        />

        {/* Radial gradient overlay */}
        <div className="absolute inset-0 bg-gradient-radial from-transparent via-[#0B0B1A]/90 to-[#0B0B1A]"/>

        {/* Main container */}
        <div className="relative w-full z-10">
          {/* Instructions */}
          {captureState === 'camera' && (
            <div className="text-center mb-8 max-w-lg mx-auto">
              <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-white/80 mb-2">Driver's License Photo</h2>
              <div className="h-1 w-32 mx-auto bg-racing-yellow rounded-full mt-4 mb-6 relative">
                <div className="absolute inset-0 animate-pulse-slow bg-racing-yellow blur-md opacity-50" />
              </div>
              {/* <p className="text-white/80">Position your face within the frame and click the button to take your photo.</p> */}
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="text-racing-red text-center mb-4">
              {error}
            </div>
          )}

          {/* Main content */}
          {captureState === 'camera' ? renderCamera() : renderLicensePreview()}
        </div>
      </div>
    </>
  );
};
