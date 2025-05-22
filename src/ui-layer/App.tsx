import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { LoginScreen } from './components/screens/LoginScreen';
import { DriversLicenseScreen } from './components/screens/DriversLicenseScreen';
import { WelcomeScreen } from './components/screens/WelcomeScreen';
import { LobbyScreen } from './components/screens/LobbyScreen';
import { GameMenuScreen } from './components/screens/GameMenuScreen';
import { RouteTransition } from './components/transitions/RouteTransition';
import { RaceScreen } from './components/screens/RaceScreen';
import BabylonTestScreen from './components/screens/BabylonTestScreen';
import { TestGameScreen } from './components/screens/TestGameScreen';
import './App.css';

function AppContent() {
  const navigate = useNavigate();

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

  const handleTestGame = () => {
    navigate('/test-game');
  };

  const handleStartRace = () => {
    navigate('/race');
  };

  const handleBackToMenu = () => {
    navigate('/welcome');
  };

  return (
    <Routes>
      <Route path="/" element={
        <RouteTransition route="login">
          <LoginScreen onLoginComplete={handleLoginComplete} />
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
          onTestGame={handleTestGame}
        />
      } />
      <Route path="/race" element={<RaceScreen onBack={handleBackToMenu} />} />
      <Route path="/babylon-test" element={<BabylonTestScreen />} />
      <Route path="/test-game" element={<TestGameScreen onBack={handleBackToMenu} />} />
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
