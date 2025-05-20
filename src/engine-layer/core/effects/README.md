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
