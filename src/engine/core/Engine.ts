import { WebRTCManager } from '../network/WebRTCManager';
import { ARManager } from '../ar/ARManager';
import { SceneManager } from '../renderer/SceneManager';
import { CameraManager } from '../renderer/CameraManager';

interface EngineOptions {
    canvas: HTMLCanvasElement;
    showStats?: boolean;
    debugMode?: boolean;
}

export class Engine {
    private sceneManager: SceneManager;
    private cameraManager: CameraManager;
    private webrtc: WebRTCManager;
    private ar: ARManager;
    private isRunning: boolean = false;
    private readonly debugMode: boolean;
    private readonly showStats: boolean;
    
    constructor(options: EngineOptions) {
        this.debugMode = options.debugMode ?? false;
        this.showStats = options.showStats ?? false;
        
        // Initialize managers
        this.sceneManager = new SceneManager(options.canvas);
        this.cameraManager = new CameraManager();
        this.webrtc = new WebRTCManager();
        this.ar = new ARManager(this.sceneManager.getScene(), this.cameraManager.getCamera());

        // Initialize debug features if enabled
        if (this.debugMode) {
            console.log('Debug mode enabled');
            // TODO: Initialize debug tools
        }

        if (this.showStats) {
            console.log('Performance stats enabled');
            // TODO: Initialize performance stats
        }
    }
    

    
    public start(): void {
        if (!this.isRunning) {
            this.isRunning = true;
            this.animate();
        }
    }
    
    public stop(): void {
        this.isRunning = false;
    }
    
    private animate(): void {
        if (!this.isRunning) return;
        
        requestAnimationFrame(this.animate.bind(this));
        
        // Update components
        this.cameraManager.update();
        this.ar.update(this.webrtc.getVideoElement());
        
        // Render scene
        this.sceneManager.render(this.cameraManager.getCamera());
    }
    
    public dispose(): void {
        this.stop();
        this.webrtc.dispose();
        this.ar.dispose();
        this.sceneManager.dispose();
        this.cameraManager.dispose();
    }
}
