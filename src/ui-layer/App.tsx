import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { LoginScreen } from './components/screens/LoginScreen';
import { DriversLicenseScreen } from './components/screens/DriversLicenseScreen';
import { WelcomeScreen } from './components/screens/WelcomeScreen';
import { LobbyScreen } from './components/screens/LobbyScreen';
import { GameMenuScreen } from './components/screens/GameMenuScreen';
import { TestGameScreen } from './components/screens/TestGameScreen';
import { ARStreamScreen } from './components/screens/ARStreamScreen';
import { ARViewerScreen } from './components/screens/ARViewerScreen';
import { RouteTransition } from './components/transitions/RouteTransition';
import { RaceScreen } from './components/screens/RaceScreen';
import BabylonTestScreen from './components/screens/BabylonTestScreen';
import { RaceSession } from '../shared/types/race';
import './App.css';

function AppContent() {
  const navigate = useNavigate();
  const [selectedSession, setSelectedSession] = useState<RaceSession | null>(null);

  const handleLoginComplete = () => {
    // For new users, go to license screen
    // TODO: Check if user is new
    const isNewUser = true;
    if (isNewUser) {
      navigate('/drivers-license');
    } else {
      navigate('/welcome');
    }
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

  return (
    <Routes>
      <Route path="/" element={
        <RouteTransition route="login">
          <LoginScreen onLoginComplete={handleLoginComplete} />
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
            <ARStreamScreen 
              session={selectedSession}
              onBack={handleBackToLobby}
            />
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
            <ARViewerScreen 
              session={selectedSession}
              onBack={handleBackToLobby}
            />
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
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App
