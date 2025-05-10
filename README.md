# RobotRumble Reborn Web Client

A browser-based Mixed Reality (MR) racing game client that allows users to control physical Unmanned Ground Vehicles (UGVs) through an augmented reality interface.

## Technology Stack

- **Frontend Framework**: React with TypeScript
- **Build Tool**: Vite
- **3D Rendering**: three.js
- **AR Processing**: js-aruco for marker detection
- **Real-time Communication**: WebRTC, WebSocket
- **Node Version**: v22.15.0 (LTS)
- **Package Manager**: npm v10.9.2

## Architecture

The application follows a hybrid architecture:
1. Core Engine (Vanilla TypeScript)
   - three.js rendering
   - WebRTC video streaming
   - Marker detection
   - Physics and game loop
   - WebSocket communication

2. UI Layer (React)
   - Game menus and settings
   - HUD overlays
   - Configuration panels
   - Session management

## Development Setup

1. Ensure you have Node.js installed (preferably using nvm)
```bash
nvm install           # Installs Node version from .nvmrc
nvm use              # Switches to the project's Node version
```

2. Install dependencies
```bash
npm install
```

3. Start development server
```bash
npm run dev
```

## Building for Production

```bash
npm run build
```

## License

[License information pending]