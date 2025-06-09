import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { LoginScreen } from './components/screens/LoginScreen';
import { VideoIntroScreen } from './components/screens/VideoIntroScreen';
import { DriversLicenseScreen } from './components/screens/DriversLicenseScreen';
import { WelcomeScreen } from './components/screens/WelcomeScreen';
import { LobbyScreen } from './components/screens/LobbyScreen';
import { GameMenuScreen } from './components/screens/GameMenuScreen';
import { TestGameScreen } from './components/screens/TestGameScreen';
import { ARStreamScreen } from './components/screens/ARStreamScreen';
import { ARViewerScreen } from './components/screens/ARViewerScreen';
import { ARStreamScreenCrossyRobo } from './components/screens/ARStreamScreenCrossyRobo';
import { ARViewerScreenCrossyRobo } from './components/screens/ARViewerScreenCrossyRobo';
import { ARStreamScreenRoboRumble } from './components/screens/ARStreamScreenRoboRumble';
import { ARViewerScreenRoboRumble } from './components/screens/ARViewerScreenRoboRumble';
import { TeamRegistrationScreen } from './components/screens/TeamRegistrationScreen';
import { RouteTransition } from './components/transitions/RouteTransition';
import { RaceScreen } from './components/screens/RaceScreen';
import BabylonTestScreen from './components/screens/BabylonTestScreen';
import { RaceSession } from '../shared/types/race';
import { AuthProvider, useAuth } from '../shared/contexts/AuthContext';
import { SuiClientProvider, WalletProvider } from '@mysten/dapp-kit';
import { getFullnodeUrl } from '@mysten/sui/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './App.css';

// Create a query client for React Query
const queryClient = new QueryClient();

// Sui network configuration
const networks = {
  devnet: { url: getFullnodeUrl('devnet') },
  testnet: { url: getFullnodeUrl('testnet') },
  mainnet: { url: getFullnodeUrl('mainnet') },
};

function AppContent() {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  const [selectedSession, setSelectedSession] = useState<RaceSession | null>(null);

  // Show loading screen while checking authentication
  if (isLoading) {
    return (
      <div className="w-full h-screen bg-[#0B0B1A] flex items-center justify-center text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  const handleLoginComplete = () => {
    // For new users, go to license screen
    // TODO: Check if user is new - for now, always go to license for demo
    navigate('/drivers-license');
  };

  const handleLicenseComplete = () => {
    navigate('/game-menu');
  };

  const handleQuickPlay = () => {
    navigate('/lobby');
  };

  const handleCustomGame = () => {
    navigate('/lobby');
  };

  const handleSettings = () => {
    // TODO: Navigate to settings screen once created
    console.log('Settings clicked');
  };

  const handleTutorial = () => {
    navigate('/babylon-test');
  };

  const handleStartRace = () => {
    navigate('/race');
  };

  const handleBackToMenu = () => {
    navigate('/welcome');
  };

  const handleStartARStream = (session: RaceSession) => {
    setSelectedSession(session);
    navigate('/ar-stream');
  };

  const handleJoinARStream = (session: RaceSession) => {
    setSelectedSession(session);
    navigate('/ar-viewer');
  };

  const handleBackToLobby = () => {
    setSelectedSession(null);
    navigate('/lobby');
  };

  const handleTeamRegistration = () => {
    navigate('/team-registration');
  };

  const handleTeamRegistrationComplete = (teamId: string, memberData: any) => {
    console.log('Team registration completed:', { teamId, memberData });
    // Store team data in localStorage or context for now
    localStorage.setItem('teamRegistration', JSON.stringify({ teamId, memberData }));
    // Navigate to lobby to select streams
    navigate('/lobby');
  };

  const handleBackToLogin = () => {
    navigate('/');
  };

  // Helper function to get the correct AR Stream component based on track name
  const getARStreamComponent = (session: RaceSession) => {
    switch (session.trackName) {
      case 'Crossy Robo':
        return (
          <ARStreamScreenCrossyRobo 
            session={session}
            onBack={handleBackToLobby}
          />
        );
      case 'Robo Rumble':
        return (
          <ARStreamScreenRoboRumble 
            session={session}
            onBack={handleBackToLobby}
          />
        );
      case 'Robo Delivery':
      default:
        return (
          <ARStreamScreen 
            session={session}
            onBack={handleBackToLobby}
          />
        );
    }
  };

  // Helper function to get the correct AR Viewer component based on track name
  const getARViewerComponent = (session: RaceSession) => {
    switch (session.trackName) {
      case 'Crossy Robo':
        return (
          <ARViewerScreenCrossyRobo 
            session={session}
            onBack={handleBackToLobby}
          />
        );
      case 'Robo Rumble':
        return (
          <ARViewerScreenRoboRumble 
            session={session}
            onBack={handleBackToLobby}
          />
        );
      case 'Robo Delivery':
      default:
        return (
          <ARViewerScreen 
            session={session}
            onBack={handleBackToLobby}
          />
        );
    }
  };

  return (
    <Routes>
      <Route path="/" element={
        <RouteTransition route="video-intro">
          <VideoIntroScreen onLoginComplete={handleLoginComplete} />
        </RouteTransition>
      } />
      <Route path="/test-game" element={
        <RouteTransition route="test-game">
          <TestGameScreen />
        </RouteTransition>
      } />
      <Route path="/drivers-license" element={
        <RouteTransition route="license">
          <DriversLicenseScreen onComplete={handleLicenseComplete} />
        </RouteTransition>
      } />
      <Route path="/team-registration" element={
        <RouteTransition route="team-registration">
          <TeamRegistrationScreen 
            onBack={handleBackToLogin} 
            onRegistrationComplete={handleTeamRegistrationComplete}
          />
        </RouteTransition>
      } />
      <Route path="/game-menu" element={
        <RouteTransition route="menu">
          <GameMenuScreen
            onBack={handleBackToMenu}
            onStartSinglePlayer={() => navigate('/lobby')}
            onStartMultiplayer={() => navigate('/lobby')}
          />
        </RouteTransition>
      } />
      <Route path="/welcome" element={
        <WelcomeScreen 
          onQuickPlay={handleQuickPlay}
          onCustomGame={handleCustomGame}
          onSettings={handleSettings}
          onTutorial={handleTutorial}
        />
      } />
      <Route path="/lobby" element={
        <LobbyScreen 
          onStartRace={handleStartRace}
          onBack={handleBackToMenu}
          onStartARStream={handleStartARStream}
          onJoinARStream={handleJoinARStream}
        />
      } />
      <Route path="/ar-stream" element={
        selectedSession ? (
          <RouteTransition route="ar-stream">
            {getARStreamComponent(selectedSession)}
          </RouteTransition>
        ) : (
          <div className="w-full h-screen bg-[#0B0B1A] flex items-center justify-center text-white">
            <div className="text-center">
              <h2 className="text-xl font-bold mb-2">No Session Selected</h2>
              <p className="text-white/70 mb-4">Please select a session from the lobby</p>
              <button 
                onClick={handleBackToLobby}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white"
              >
                Back to Lobby
              </button>
            </div>
          </div>
        )
      } />
      <Route path="/ar-viewer" element={
        selectedSession ? (
          <RouteTransition route="ar-viewer">
            {getARViewerComponent(selectedSession)}
          </RouteTransition>
        ) : (
          <div className="w-full h-screen bg-[#0B0B1A] flex items-center justify-center text-white">
            <div className="text-center">
              <h2 className="text-xl font-bold mb-2">No Session Selected</h2>
              <p className="text-white/70 mb-4">Please select a session from the lobby</p>
              <button 
                onClick={handleBackToLobby}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white"
              >
                Back to Lobby
              </button>
            </div>
          </div>
        )
      } />
      <Route path="/race" element={<RaceScreen onBack={handleBackToMenu} />} />
      <Route path="/babylon-test" element={<BabylonTestScreen />} />
      <Route path="/auth/callback" element={
        <RouteTransition route="login">
          <LoginScreen onLoginComplete={handleLoginComplete} />
        </RouteTransition>
      } />
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networks} defaultNetwork="testnet">
        <WalletProvider>
          <AuthProvider>
            <Router>
              <AppContent />
            </Router>
          </AuthProvider>
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}

export default App
