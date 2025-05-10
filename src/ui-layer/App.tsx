import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
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
        <div className="min-h-screen bg-gradient-to-b from-game-900 to-game-800 text-white">
          <LobbyScreen 
            onStartRace={handleStartRace}
            onBack={handleBackToMenu}
          />
        </div>
      } />
      <Route path="/race" element={<RaceScreen />} />
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
