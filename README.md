# RobotRumble Reborn Web Client

A browser-based Mixed Reality (MR) racing game client that allows users to control physical Unmanned Ground Vehicles (UGVs) through an augmented reality interface.

## Technology Stack

- **Frontend Framework**: React with TypeScript
- **Build Tool**: Vite
- **3D Rendering**: three.js
- **AR Processing**: js-aruco for marker detection
- **Real-time Communication**: WebRTC, WebSocket
- **Styling**: Tailwind CSS
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
├── hooks/         # Custom React hooks
├── utils/         # Utility functions
└── types/         # TypeScript type definitions
    └── js-aruco.d.ts # AR library types
```

## UI Components

### Shared Components

- **Button**: Customizable button with variants (primary, secondary, danger), sizes, and loading state
- **Modal**: Accessible modal dialog with backdrop blur and dark theme
- **LoadingState**: Loading indicator with multiple variants and sizes

### Layout Components

- **AppLayout**: Base application layout with loading state management
- **GameLayout**: Game-specific layout with AR canvas and HUD layers

### Screen Components

- **WelcomeScreen**: Landing page with quick play, custom game, settings, and tutorial options
- **LobbyScreen**: (Coming soon) Browse and create race sessions
- **RaceScreen**: (Coming soon) Main game interface with AR view and controls
- **ResultsScreen**: (Coming soon) Post-race summary and leaderboard

### Styling

The project uses Tailwind CSS for styling, providing:

- Custom gaming theme with dark mode by default
- Responsive design utilities
- GPU-accelerated animations
- Modern backdrop blur effects
- Consistent spacing and typography

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

#### Marker Detection and Pose Estimation
The system uses js-aruco's POSIT (Pose from Orthography and Scaling with ITerations) algorithm for 3D pose estimation:

```typescript
interface Marker {
  id: number;
  corners: { x: number; y: number }[];
  center: { x: number; y: number };
  pose?: {
    bestError: number;
    bestRotation: number[][];    // 3x3 rotation matrix
    bestTranslation: number[];   // [x, y, z] translation vector
    alternativeError: number;
    alternativeRotation: number[][];
    alternativeTranslation: number[];
  };
}
```

#### Coordinate Systems and Transformations

The system handles three different coordinate spaces:

1. **Video Space (2D)**
   - Origin: Top-left corner of video
   - X: Right, Y: Down
   - Units: Pixels

2. **js-aruco POSIT Space (3D)**
   - Origin: Camera center
   - Y-axis: Down (screen coordinates)
   - Z-axis: Into marker (away from camera)
   - Units: Millimeters (based on MARKER_SIZE_MM)
   - Right-handed coordinate system

3. **THREE.js Scene Space (3D)**
   - Origin: Center of screen
   - Y-axis: Up
   - Z-axis: Toward camera
   - Units: Scene units (normalized)
   - Right-handed coordinate system

#### Coordinate Transformations

1. **Video to Scene Space (2D Positioning)**
```typescript
// For X coordinates
x = ((marker.x / videoWidth) - 0.5) * 2 * scaleX * VIDEO_SCALE
// For Y coordinates (flip Y axis)
y = (0.5 - (marker.y / videoHeight)) * 2 * scaleY * VIDEO_SCALE
```

2. **POSIT to THREE.js Rotation Matrix**
```typescript
// Convert POSIT rotation matrix to THREE.js coordinate system
rotationMatrix.set(
  r[0][0],   r[0][1],  -r[0][2],  0,  // Keep X, flip Z
  r[1][0],   r[1][1],  -r[1][2],  0,  // Keep X/Y, flip Z
  -r[2][0], -r[2][1],   r[2][2],  0,  // Flip X/Y for Z-up
  0,        0,          0,         1
);
```

#### Video Background Configuration
The video background can be configured with the following parameters:

```typescript
interface VideoPlaneConfig {
  distance?: number;     // Distance from camera (default: 0.1)
  baseHeight?: number;   // Base height in world units (default: 4.0)
  scale?: number;        // Additional scale factor (default: 1.0)
}
```

Example usage in ARManager:
```typescript
videoBackground.initialize(videoElement, {
  distance: 0.1,     // Closer to camera = larger view
  baseHeight: 2.0,   // Base size of video plane
  scale: 1.5        // Additional scaling if needed
});
```

Tips for configuration:
- Decrease `distance` to make video appear larger

#### Implementation Notes

1. **Marker Tracking**
   - Uses video coordinates for X/Y positioning to ensure accurate screen tracking
   - POSIT's Z-translation provides depth perception
   - Scale factor (0.0001) converts millimeters to scene units

2. **Rotation Handling**
   - Maintains proper axis alignment between coordinate systems
   - Preserves right-handed coordinate system properties
   - Correctly handles all rotation axes (X, Y, Z)

3. **Corner Visualization**
   - Corner markers follow marker in screen space
   - Positions updated relative to marker center
   - Transformed to local space for proper rotation

4. **Performance Optimization**
   - Marker detection every 3rd frame
   - Efficient matrix transformations
   - Minimal coordinate system conversions

## Debug Tools

The application includes debug tools to help with development and testing. These tools provide real-time information about video sources, AR marker detection, and system performance.

### Enabling Debug Mode

Debug tools can be enabled in three ways:

1. **Development Mode (Automatic)**
   - Debug tools are automatically enabled when running in development mode (`npm run dev`)

2. **Environment Variable**
   - Create a `.env.local` file in the project root:
     ```
     VITE_DEBUG_TOOLS_ENABLED=true
     ```
   - Or set the variable before running:
     ```bash
     VITE_DEBUG_TOOLS_ENABLED=true npm run dev
     ```

3. **Browser Storage**
   - Open browser console and run:
     ```javascript
     localStorage.setItem('DEBUG_TOOLS_ENABLED', 'true');
     ```
   - Refresh the page

### Available Debug Tools

1. **Video Source Debug Panel**
   - Video source status and controls
   - Resolution and frame rate information
   - Source switching options

2. **AR Debug Panel**
   - Marker detection statistics
   - Detection FPS counter
   - Current and total markers detected
   - Error tracking
   - Frame skip monitoring

3. **Visual Debugging**
   - Wireframe marker visualization
   - Corner point indicators
   - Axes helpers for orientation
   - Grid overlay for spatial reference
- Increase `baseHeight` for larger base size
- Use `scale` for fine-tuning the final size
- Keep `distance` > 0.1 to avoid z-fighting

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
