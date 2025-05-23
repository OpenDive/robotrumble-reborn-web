# ArUco Marker AR Feature

This project now includes an enhanced ArUco marker detection system that shows a 3D golden key model when ArUco marker ID 0 is detected in the camera feed.

## How to Use

### 1. Start the Application

```bash
npm run dev
```

### 2. Navigate to Test Game

- Go to the test game screen in the application
- Click the "Enter AR" button to enable AR mode
- Allow camera permissions when prompted

### 3. Use the Test Marker

- Open `/public/aruco-marker-0.html` in a browser on another device or print it
- Point the camera at the ArUco marker ID 0
- You should see a golden key appear on the marker and track its movement

## Features

### Enhanced AR Detection System

The new `EnhancedARDetector` provides:

- **Advanced ArUco marker detection** using js-aruco library
- **3D model rendering** with ThreeJS integration
- **Real-time pose estimation** with accurate positioning
- **Automatic model loading** from key.glb or fallback procedural model
- **Performance optimized** marker tracking

### Key Components

1. **EnhancedARDetector** (`src/engine-layer/core/ar/EnhancedARDetector.ts`)
   - Core AR detection and 3D rendering
   - Handles marker detection and pose estimation
   - Manages 3D model lifecycle

2. **TestGameScreen** (`src/ui-layer/components/screens/TestGameScreen.tsx`)
   - Updated to use the enhanced AR system
   - Integrates with existing game rendering pipeline

3. **GameRenderSystem** (`src/engine-layer/core/renderer/GameRenderSystem.ts`)
   - Added methods to expose scene and camera for AR integration
   - Maintains compatibility with existing rendering

## Marker Requirements

- **Marker ID**: Only marker ID 0 will show the key model
- **Size**: Markers should be at least 5cm x 5cm for good detection
- **Quality**: Print on white paper with black ink for best contrast
- **Lighting**: Ensure good, even lighting on the marker
- **Flatness**: Keep markers flat and unfolded for accurate tracking

## Troubleshooting

### Marker Not Detected
- Check lighting conditions (avoid shadows and glare)
- Ensure marker is flat and not curved
- Try adjusting distance (20cm - 1m works best)
- Check browser console for AR debug messages

### Poor Tracking
- Ensure marker stays in camera view
- Avoid fast movements
- Check for camera focus issues
- Verify marker print quality

### Performance Issues
- Close other browser tabs
- Check browser hardware acceleration
- Reduce marker detection frequency if needed

## Development

### Adding New Marker IDs

To add support for other marker IDs:

1. Update the marker ID check in `updateARModels()` method
2. Add different 3D models for different markers
3. Create corresponding test markers

### Customizing 3D Models

- Replace `key.glb` in the project root with your own model
- Ensure models are optimized for web (low poly count)
- Models should be centered at origin

### Debug Messages

Enable debug logging in the browser console to see:
- Marker detection events
- Pose estimation data
- Model loading status
- Performance metrics

## Browser Compatibility

- **Chrome/Edge**: Full support
- **Firefox**: Full support
- **Safari**: Limited support (requires HTTPS for camera access)
- **Mobile**: Supported on modern mobile browsers

## Future Enhancements

- Multiple marker support with different models
- Improved pose estimation accuracy
- Model animation and interaction
- Multiplayer AR synchronization
- Custom marker generation tools 