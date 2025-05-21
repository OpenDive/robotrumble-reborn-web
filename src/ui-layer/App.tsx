import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { LoginScreen } from './components/screens/LoginScreen';
import { DriversLicenseScreen } from './components/screens/DriversLicenseScreen';
import { WelcomeScreen } from './components/screens/WelcomeScreen';
import { LobbyScreen } from './components/screens/LobbyScreen';
import { RaceScreen } from './components/screens/RaceScreen';
import BabylonTestScreen from './components/screens/BabylonTestScreen';
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
    navigate('/welcome');
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

  return (
    <Routes>
      <Route path="/" element={<LoginScreen onLoginComplete={handleLoginComplete} />} />
      <Route path="/drivers-license" element={<DriversLicenseScreen onComplete={handleLicenseComplete} />} />
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
        />
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
