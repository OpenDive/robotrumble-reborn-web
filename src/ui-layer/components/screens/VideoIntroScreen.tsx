import React, { useState, useRef, useEffect } from 'react';
import { LoginScreen } from './LoginScreen';

interface VideoIntroScreenProps {
  onLoginComplete: () => void;
}

export const VideoIntroScreen: React.FC<VideoIntroScreenProps> = ({ onLoginComplete }) => {
  const [showLanding, setShowLanding] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [showSoundPrompt, setShowSoundPrompt] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleVideoEnd = () => {
      setShowLanding(true);
    };

    const handleVideoError = () => {
      console.error('Video failed to load, showing landing page immediately');
      setVideoError(true);
      setShowLanding(true);
    };

    const handleUserInteraction = () => {
      // Try to play with sound after user interaction
      video.muted = false;
      video.play().catch((error) => {
        console.warn('Video play with sound failed, falling back to muted:', error);
        video.muted = true;
        video.play();
      });
      // Hide the sound prompt
      setShowSoundPrompt(false);
      // Remove the event listener after first interaction
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
    };

    video.addEventListener('ended', handleVideoEnd);
    video.addEventListener('error', handleVideoError);

    // Try to auto-play with sound first
    video.muted = false;
    video.play().catch(() => {
      console.log('Autoplay with sound failed, trying muted autoplay');
      // If autoplay with sound fails, try muted autoplay
      video.muted = true;
      video.play().catch(() => {
        console.error('Video autoplay failed completely, showing landing page immediately');
        setVideoError(true);
        setShowLanding(true);
      });
      
      // Show sound prompt and listen for user interaction to enable sound
      setShowSoundPrompt(true);
      document.addEventListener('click', handleUserInteraction);
      document.addEventListener('keydown', handleUserInteraction);
      document.addEventListener('touchstart', handleUserInteraction);
    });

    return () => {
      video.removeEventListener('ended', handleVideoEnd);
      video.removeEventListener('error', handleVideoError);
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
    };
  }, []);

  const handleSkipVideo = () => {
    setShowLanding(true);
  };

  if (showLanding) {
    return (
      <div className="relative">
        {/* Landing page with greyed out overlay */}
        <div className="filter grayscale brightness-75 pointer-events-none">
          <LoginScreen onLoginComplete={onLoginComplete} />
        </div>
        
        {/* Popup overlay */}
        <div className="fixed inset-0 bg-black/30 backdrop-blur-xs flex items-center justify-center z-50">
          <div className="bg-[#0B0B1A]/80 backdrop-blur-md border border-purple-400/50 rounded-2xl p-8 max-w-md mx-4 text-center shadow-[0_0_50px_rgba(178,75,243,0.4)]">
            <div className="mb-6">
              <div className="mx-auto mb-4">
                <img 
                  src="/assets/robot_racing_sideview_transparent.png" 
                  alt="Robot racing tournament"
                  className="w-16 h-16 object-contain mx-auto"
                />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Robots Searching for Tournament Venue</h2>
              <p className="text-white/70">
                Our robot racers are currently looking for the perfect arena to compete in. 
                Stay tuned for the ultimate onchain robotic racing experience!
              </p>
            </div>
            
            <div className="flex items-center justify-center gap-2 mb-6">
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
            </div>
            
            <div className="text-sm text-white/50">
              Tournament updates coming soon...
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center relative overflow-hidden">
      {/* Video container */}
      <div className="relative w-full h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-center">
        <div className="relative w-full aspect-video max-h-[80vh] flex items-center justify-center">
          <video
            ref={videoRef}
            className="w-full h-full object-contain rounded-lg shadow-2xl"
            playsInline
            onError={() => setVideoError(true)}
          >
            <source src="/assets/videos/robot-racing-video.mp4" type="video/mp4" />
            Your browser does not support the video tag.
          </video>
          
          {/* Skip button */}
          <button
            onClick={handleSkipVideo}
            className="absolute top-2 right-2 sm:top-4 sm:right-4 bg-black/50 backdrop-blur-sm text-white px-3 py-2 sm:px-4 sm:py-2 rounded-lg hover:bg-black/70 transition-colors duration-200 text-xs sm:text-sm z-10"
          >
            Skip Video
          </button>

          {/* Sound prompt */}
          {showSoundPrompt && (
            <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 bg-black/70 backdrop-blur-sm text-white px-4 py-2 sm:px-6 sm:py-3 rounded-lg flex items-center gap-2 animate-pulse text-xs sm:text-sm z-10 mx-4 max-w-[calc(100%-2rem)]">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.816L4.88 13.5H2a1 1 0 01-1-1v-3a1 1 0 011-1h2.88l3.503-3.316a1 1 0 011.617.816zM12 8.414l1.293-1.293a1 1 0 011.414 1.414L13.414 10l1.293 1.293a1 1 0 01-1.414 1.414L12 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L10.586 10l-1.293-1.293a1 1 0 011.414-1.414L12 8.414z" clipRule="evenodd" />
              </svg>
              <span className="truncate">Click anywhere to enable sound</span>
            </div>
          )}
        </div>
        
        {videoError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black text-white">
            <div className="text-center">
              <p className="mb-4">Video failed to load</p>
              <button
                onClick={handleSkipVideo}
                className="bg-purple-600 hover:bg-purple-700 px-6 py-3 rounded-lg transition-colors duration-200"
              >
                Continue to Game
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}; 