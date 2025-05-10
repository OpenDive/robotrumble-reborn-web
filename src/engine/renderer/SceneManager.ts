import { Scene, WebGLRenderer, Camera, Object3D, Mesh, Material, BufferGeometry, Color, PCFSoftShadowMap, AmbientLight, DirectionalLight } from 'three';

export class SceneManager {
    private scene: Scene;
    private renderer: WebGLRenderer;

    constructor(canvas: HTMLCanvasElement) {
        // Initialize scene
        this.scene = new Scene();
        this.scene.background = new Color(0x000000);

        // Initialize renderer
        this.renderer = new WebGLRenderer({
            canvas,
            antialias: true,
            alpha: true // Enable transparency for AR
        });

        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = PCFSoftShadowMap;

        // Setup basic lighting
        this.setupLighting();

        // Handle window resize
        window.addEventListener('resize', this.onWindowResize.bind(this));
    }

    private setupLighting(): void {
        const ambientLight = new AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);

        const directionalLight = new DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 5, 5);
        directionalLight.castShadow = true;
        this.scene.add(directionalLight);
    }

    private onWindowResize(): void {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    public getScene(): Scene {
        return this.scene;
    }

    public getRenderer(): WebGLRenderer {
        return this.renderer;
    }

    public render(camera: Camera): void {
        this.renderer.render(this.scene, camera);
    }

    public dispose(): void {
        // Cleanup resources
        window.removeEventListener('resize', this.onWindowResize.bind(this));
        this.renderer.dispose();
        
        // Dispose of all materials and geometries in the scene
        this.scene.traverse((object: Object3D) => {
            if (object instanceof Mesh) {
                if (object.geometry instanceof BufferGeometry) {
                    object.geometry.dispose();
                }
                if (Array.isArray(object.material)) {
                    object.material.forEach((material: Material) => material.dispose());
                } else if (object.material instanceof Material) {
                    object.material.dispose();
                }
            }
        });
    }
}
