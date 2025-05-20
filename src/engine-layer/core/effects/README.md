# Particle Effects System

This directory contains the particle effects system for RobotRumble Reborn. The effects are designed for first-person AR racing perspective and are optimized for visibility and impact.

## Available Effects

### Smoke Effect
**Activation**: Press 'S' key (for testing)

**Visual Characteristics**:
- Continuous emission of particles in a cone shape
- Starts small (0.3-0.5 units) and expands (0.8-1.2 units)
- Gradual fade from dense white core to transparent edges
- Particles drift upward with light turbulence
- Duration: Individual particles last 1.5-2.5 seconds
- Emission Rate: 50 particles per second
- Maximum Particles: 200

**Expected Experience**:
- Should appear as a dense, billowing cloud
- Maintains consistent density through continuous emission
- Particles should spread out naturally as they rise
- Visible from 2+ units away without overwhelming the view
- Useful for: tire smoke, engine exhaust, boost trails

### Explosion Effect
**Activation**: Press 'E' key (for testing)

**Visual Characteristics**:
- One-shot burst of 100 particles in a sphere shape
- Large initial size (0.8-1.2 units) that shrinks as it fades (0.3-0.5 units)
- Bright orange/yellow core transitioning to red edges
- High initial velocity with upward drift
- Duration: Particles last 1.0-1.5 seconds
- Burst Count: 100 particles per explosion
- Maximum Particles: 300

**Expected Experience**:
- Should create a dramatic, expanding fireball
- Initial bright flash that quickly expands outward
- Particles should spread spherically from origin
- Visible from 2+ units away with good depth perception
- Useful for: collisions, power-ups, victory effects

### Checkpoint Effect
**Activation**: Automatic when passing through checkpoint

**Visual Characteristics**:
- Three-part effect combining beam, ring, and number display
- Beam Effect:
  - Holographic cylinder with pulsing glow
  - Color varies by checkpoint type (blue: normal, gold: final lap)
  - Height configurable via config
- Ring Effect:
  - Expanding ring from center
  - Matches beam color
  - Fades out as it expands
- Number Display:
  - 3D text showing checkpoint number
  - Configurable colors for both base and glow
  - Camera-facing with slight upward tilt
  - Gentle floating animation
  - Default colors:
    - Normal: Blue base (#00CCFF) with cyan glow (#00FFFF)
    - Final Lap: Gold base (#FFD700) with orange glow (#FFA500)

**Configuration Options**:
```typescript
interface CheckpointConfig {
  checkpointNumber: number;     // Number to display
  isFinalLap: boolean;         // Affects color scheme
  height: number;              // Beam height
  numberColor?: THREE.Color;    // Custom number color
  numberGlowColor?: THREE.Color; // Custom glow color
}
```

**Expected Experience**:
- Clear visual indicator of checkpoint position
- Easily readable checkpoint number
- Distinctive appearance for final lap checkpoints
- Smooth animations for all components
- Visible from multiple angles
- Useful for: race checkpoints, lap markers, course navigation

### Boost Trail Effect
**Activation**: Press 'B' key (for testing)

**Visual Characteristics**:
- Two-part effect combining particles and speed lines
- Core Effect:
  - Small energy particles (0.1-0.15 units)
  - Yellow-red color gradient
  - Tight cone formation (7.5 degrees)
  - Quick lifetime (0.3-0.5 seconds)
- Speed Lines:
  - V-shaped formation with 5 emission points
  - Length scales with velocity
  - Color varies by position (yellow center to red edges)
  - Animated width pulsing
  - Dynamic spacing based on speed

**Formation Pattern**:
```
    O   O    (Outer red lines)
   O  O  O   (Inner orange/yellow lines)
     [V]     (Vehicle position)
```

**Expected Experience**:
- Classic racing game boost visual
- Clear directional indication
- Speed lines create sense of motion
- V-formation suggests forward thrust
- Colors suggest heat/energy
- Intensity and spacing adapt to speed

## Viewing Distance and Perspective

Effects are positioned 2 units away from the camera by default, which provides:
- Good depth perception
- Natural particle distribution
- No particles lost behind the camera
- Consistent apparent sizes
- Optimal viewing angle for the full effect

## Technical Notes

- Effects use the BaseEffect system with different emission modes:
  - Smoke: Continuous emission with steady rate
  - Explosion: One-shot burst with all particles at once
- Both effects support color interpolation and size changes over lifetime
- Physics includes gravity, drag, and turbulence for natural movement
- Particle counts are optimized for mobile AR performance
