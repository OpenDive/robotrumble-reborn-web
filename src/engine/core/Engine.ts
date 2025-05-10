import { WebRTCManager } from '../network/WebRTCManager';
import { ARManager } from '../ar/ARManager';
import { Scene, PerspectiveCamera, WebGLRenderer } from 'three';

export class Engine {
    private scene: Scene;
    private camera: PerspectiveCamera;
    private renderer: WebGLRenderer;
    private webrtc: WebRTCManager;
    private ar: ARManager;
    private isRunning: boolean = false;
    
    constructor(container: HTMLElement) {
        // Initialize three.js
        this.scene = new Scene();
        this.camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        container.appendChild(this.renderer.domElement);
        
        // Initialize managers
        this.webrtc = new WebRTCManager();
        this.ar = new ARManager(this.scene, this.camera);
        
        // Handle window resize
        window.addEventListener('resize', this.onWindowResize.bind(this));
    }
    
    private onWindowResize(): void {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
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
        
        // Update AR tracking
        this.ar.update();
        
        // Render scene
        this.renderer.render(this.scene, this.camera);
    }
    
    public dispose(): void {
        this.stop();
        window.removeEventListener('resize', this.onWindowResize.bind(this));
        this.webrtc.dispose();
        this.ar.dispose();
        this.renderer.dispose();
    }
}
