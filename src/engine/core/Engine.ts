import { WebRTCManager } from '../network/WebRTCManager';
import { ARManager } from '../ar/ARManager';
import { SceneManager } from '../renderer/SceneManager';
import { CameraManager } from '../renderer/CameraManager';

export class Engine {
    private sceneManager: SceneManager;
    private cameraManager: CameraManager;
    private webrtc: WebRTCManager;
    private ar: ARManager;
    private isRunning: boolean = false;
    
    constructor(container: HTMLElement) {
        // Initialize managers
        this.sceneManager = new SceneManager(container);
        this.cameraManager = new CameraManager();
        this.webrtc = new WebRTCManager();
        this.ar = new ARManager(this.sceneManager.getScene(), this.cameraManager.getCamera());
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
