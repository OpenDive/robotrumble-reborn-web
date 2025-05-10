import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { WelcomeScreen } from './components/screens/WelcomeScreen';
import { LobbyScreen } from './components/screens/LobbyScreen';
import { RaceScreen } from './components/screens/RaceScreen';
import './App.css';

function AppContent() {
  const navigate = useNavigate();

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
    // TODO: Navigate to tutorial screen once created
    console.log('Tutorial clicked');
  };

  const handleStartRace = () => {
    navigate('/race');
  };

  const handleBackToMenu = () => {
    navigate('/');
  };

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={
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
        <Route path="/race" element={<RaceScreen />} />
      </Routes>
    </AppLayout>
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
