import { KeyState } from '../../../shared/types/GameTypes';

export class InputController {
  private keysRef: KeyState = {
    forward: false,
    backward: false,
    left: false,
    right: false
  };
  
  private onKeysChanged?: (keys: KeyState) => void;

  initialize(canvas: HTMLCanvasElement, onKeysChanged?: (keys: KeyState) => void): void {
    this.onKeysChanged = onKeysChanged;
    
    // Focus the canvas so it can receive keyboard events
    canvas.focus();
    console.log('Canvas focused:', document.activeElement === canvas);

    // Handle keyboard input - attach to document instead of canvas
    document.addEventListener('keydown', this.handleKeyDown);
    document.addEventListener('keyup', this.handleKeyUp);
    
    // Focus the canvas when clicking on it
    canvas.addEventListener('click', () => {
      canvas.focus();
      console.log('Canvas clicked and focused');
    });
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    // Skip if typing in an input field
    if ((event.target as HTMLElement)?.tagName === 'INPUT' || 
        (event.target as HTMLElement)?.tagName === 'TEXTAREA') {
      return;
    }
    
    event.preventDefault();
    let newKeys = { ...this.keysRef };
    
    switch(event.code) {
      case 'ArrowUp':
      case 'KeyW':
        newKeys.forward = true;
        break;
      case 'ArrowDown':
      case 'KeyS':
        newKeys.backward = true;
        break;
      case 'ArrowLeft':
      case 'KeyA':
        newKeys.left = true;
        break;
      case 'ArrowRight':
      case 'KeyD':
        newKeys.right = true;
        break;
    }
    
    // Update the ref immediately
    this.keysRef = newKeys;
    
    // Only notify if keys changed
    if (this.onKeysChanged) {
      console.log('%cKeys:', 'color: #2196F3; font-weight: bold', newKeys);
      this.onKeysChanged(newKeys);
    }
  };

  private handleKeyUp = (event: KeyboardEvent): void => {
    // Skip if typing in an input field
    if ((event.target as HTMLElement)?.tagName === 'INPUT' || 
        (event.target as HTMLElement)?.tagName === 'TEXTAREA') {
      return;
    }
    
    event.preventDefault();
    let newKeys = { ...this.keysRef };
    
    switch(event.code) {
      case 'ArrowUp':
      case 'KeyW':
        newKeys.forward = false;
        break;
      case 'ArrowDown':
      case 'KeyS':
        newKeys.backward = false;
        break;
      case 'ArrowLeft':
      case 'KeyA':
        newKeys.left = false;
        break;
      case 'ArrowRight':
      case 'KeyD':
        newKeys.right = false;
        break;
    }
    
    // Update the ref immediately
    this.keysRef = newKeys;
    
    // Only notify if keys changed
    if (this.onKeysChanged) {
      console.log('%cKeys:', 'color: #2196F3; font-weight: bold', newKeys);
      this.onKeysChanged(newKeys);
    }
  };

  getKeys(): KeyState {
    return this.keysRef;
  }

  dispose(): void {
    document.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('keyup', this.handleKeyUp);
  }
} 