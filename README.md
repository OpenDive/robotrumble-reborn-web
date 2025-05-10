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

## Project Structure

```
src/
├── engine/           # Core game engine (framework-agnostic)
│   ├── core/         # Main engine coordination
│   │   └── Engine.ts # Central engine manager
│   ├── renderer/     # Three.js rendering
│   │   ├── SceneManager.ts    # Scene and rendering
│   │   └── CameraManager.ts   # Camera handling
│   ├── ar/          # Augmented reality
│   │   └── ARManager.ts       # Marker detection/tracking
│   └── network/     # Real-time communication
│       └── WebRTCManager.ts   # Video streaming
├── components/      # React components (coming soon)
│   ├── hud/         # In-game overlays
│   └── ui/          # Menu interfaces
└── types/           # TypeScript definitions
    └── js-aruco.d.ts # AR library types
```

## Core Features

### Rendering Engine
- Three.js-based scene management
- Efficient resource handling and cleanup
- Automatic window resize handling
- Shadow and lighting support

### AR System
- Real-time marker detection using js-aruco
- 3D pose estimation from 2D markers
- Camera calibration support
- Smooth marker tracking

### Network Stack
- WebRTC video streaming
- Peer connection management
- Signaling protocol support
- Connection state handling

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

## Performance Targets

- 30 FPS AR overlay minimum
- < 200ms control latency
- Marker detection every 3rd frame
- Efficient memory management
- Mobile device optimization

## Browser Support

- Chrome (desktop & mobile)
- Firefox (desktop & mobile)
- Safari (desktop & iOS)

## Building for Production

```bash
npm run build
```

## Contributing

1. Maintain the hybrid architecture pattern
2. Keep real-time operations in the core engine
3. Use React only for non-critical UI
4. Follow TypeScript best practices
5. Document performance-critical code

## License

[License information pending]
