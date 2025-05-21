import React, { useState, useRef, useEffect } from 'react';
import { FaCamera, FaRedo } from 'react-icons/fa';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGamepad } from '@fortawesome/free-solid-svg-icons';
import { DriversLicenseCard } from '../cards/DriversLicenseCard';
import { CountdownOverlay } from '../overlays/CountdownOverlay';

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
        
        // Switch to preview state
        setCaptureState('preview');
        setCountdownState('idle');
      }
    }
  };

  const handleRetake = () => {
    setPhotoData(null);
    setCaptureState('camera');
    startCamera();
  };

  const handleDone = () => {
    // TODO: Save photo data and navigate to next screen
    console.log('Photo saved:', photoData);
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
            className="text-3xl text-neon-purple animate-bounce"
          />
          <p className="text-gray-800 text-lg">
            Point the kart's camera at your face, and press <span className="text-neon-purple font-bold">SPACE</span> or the <span className="text-neon-purple font-bold">Take Photo</span> button to snap a photo! 📸
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
          <div className="absolute inset-0 border-2 border-neon-purple/50 rounded-xl shadow-[0_0_30px_rgba(178,75,243,0.3)]" />
          <div className="absolute inset-0 bg-gradient-to-r from-neon-purple/10 via-transparent to-neon-purple/10 animate-pulse-slow rounded-xl" />
        </div>
      </div>

      {/* Button - outside of overlay stack */}
      <button
        onClick={startCountdown}
        disabled={countdownState !== 'idle'}
        className={`w-full flex items-center justify-center px-6 py-4 text-lg font-bold rounded-2xl text-white ${countdownState === 'idle' 
          ? 'bg-neon-purple hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neon-purple transition-all duration-200 active:animate-button-press shadow-[0_0_20px_-5px_rgba(178,75,243,0.5)] hover:shadow-[0_0_30px_-5px_rgba(178,75,243,0.8)]'
          : 'bg-gray-500 cursor-not-allowed opacity-50'
        }`}
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
          photoData={photoData}
          playerName="Player 1"
          issueDate={new Date()}
          licenseType="Learner's Permit"
          className="animate-float"
        />
      )}

      {/* Action buttons */}
      <div className="flex gap-4">
        <button
          onClick={handleRetake}
          className="flex-1 flex items-center justify-center px-6 py-4 text-lg font-bold rounded-2xl text-white bg-gray-800 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-800 transition-all duration-200 active:animate-button-press"
        >
          <FaRedo className="mr-3" /> Retake Photo
        </button>
        <button
          onClick={handleDone}
          className="flex-1 flex items-center justify-center px-6 py-4 text-lg font-bold rounded-2xl text-white bg-racing-yellow hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-racing-yellow transition-all duration-200 active:animate-button-press shadow-[0_0_20px_-5px_rgba(255,215,0,0.5)] hover:shadow-[0_0_30px_-5px_rgba(255,215,0,0.8)]"
        >
          Done
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-radial from-gray-900 via-gray-800 to-gray-900 p-4 overflow-hidden">
        {/* Racing pattern overlay */}
        <div className="absolute inset-0 bg-racing-pattern opacity-5 animate-pulse-slow" />

        {/* Main container */}
        <div className="relative w-full">
          {/* Instructions */}
          {captureState === 'camera' && (
            <div className="text-center mb-8 max-w-lg mx-auto">
              <h2 className="text-2xl font-bold text-white mb-2">Driver's License Photo</h2>
              <p className="text-gray-300">Position your face within the frame and click the button to take your photo.</p>
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
