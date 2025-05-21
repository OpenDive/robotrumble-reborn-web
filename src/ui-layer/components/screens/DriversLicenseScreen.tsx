import React, { useState, useRef, useEffect } from 'react';

import { FaCamera, FaRedo } from 'react-icons/fa';

type CaptureState = 'camera' | 'preview';

interface DriversLicenseScreenProps {
  onComplete: () => void;
}

export const DriversLicenseScreen: React.FC<DriversLicenseScreenProps> = ({ onComplete }) => {

  const [captureState, setCaptureState] = useState<CaptureState>('camera');
  const [photoData, setPhotoData] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    startCamera();
    return () => {
      // Cleanup video stream when component unmounts
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

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

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (context) {
        // Set canvas size to match video dimensions
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Draw the video frame to canvas
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Convert to base64 string
        const photo = canvas.toDataURL('image/jpeg');
        setPhotoData(photo);
        setCaptureState('preview');

        // Stop the camera stream
        const stream = video.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
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
      <div className="relative">
        {/* Video element */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full rounded-xl bg-black"
        />

        {/* Camera frame overlay - positioned above video */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 border-2 border-neon-purple/50 rounded-xl shadow-[0_0_30px_rgba(178,75,243,0.3)]" />
          <div className="absolute inset-0 bg-gradient-to-r from-neon-purple/10 via-transparent to-neon-purple/10 animate-pulse-slow rounded-xl" />
        </div>
      </div>

      {/* Button - outside of overlay stack */}
      <button
        onClick={capturePhoto}
        className="w-full flex items-center justify-center px-6 py-4 text-lg font-bold rounded-2xl text-white bg-neon-purple hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neon-purple transition-all duration-200 active:animate-button-press shadow-[0_0_20px_-5px_rgba(178,75,243,0.5)] hover:shadow-[0_0_30px_-5px_rgba(178,75,243,0.8)]"
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
      <div className="relative w-full aspect-[1.75] bg-white rounded-xl overflow-hidden animate-float">
        {/* Red header */}
        <div className="absolute top-0 left-0 right-0 h-16 bg-racing-red">
          <h1 className="text-2xl font-black text-white p-4">ROBOT KARTS LIVE</h1>
        </div>

        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-racing-blue/5 to-transparent animate-pulse-slow" />

        <div className="absolute top-16 inset-x-0 bottom-0 flex p-6 gap-6">
          {/* Photo area */}
          <div className="w-1/3 aspect-[3/4] bg-gray-200 rounded-lg overflow-hidden">
            {photoData && (
              <img src={photoData} alt="Driver photo" className="w-full h-full object-cover" />
            )}
          </div>

          {/* License details */}
          <div className="flex-1 space-y-4">
            <div>
              <p className="text-sm font-medium text-game-600">NAME</p>
              <p className="text-xl font-bold text-game-900">Player 1</p>
            </div>
            <div>
              <p className="text-sm font-medium text-game-600">DATE OF ISSUE</p>
              <p className="text-xl font-bold text-game-900">
                {new Date().toLocaleDateString('en-US', { 
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-game-600">TYPE</p>
              <p className="text-xl font-bold text-game-900">Learner's Permit</p>
            </div>
          </div>
        </div>
      </div>

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
  );
};
