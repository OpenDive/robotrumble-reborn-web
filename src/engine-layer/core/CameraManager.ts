import { PerspectiveCamera, Vector3 } from 'three';

export class CameraManager {
    private camera: PerspectiveCamera;
    private target: Vector3 | null = null;

    constructor() {
        this.camera = new PerspectiveCamera(
            75, // FOV
            window.innerWidth / window.innerHeight,
            0.1, // Near plane
            1000 // Far plane
        );
        
        // Set initial position
        this.camera.position.set(0, 2, 5);
        this.camera.lookAt(0, 0, 0);

        // Handle window resizing
        window.addEventListener('resize', this.onWindowResize.bind(this));
    }

    private onWindowResize(): void {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
    }

    public getCamera(): PerspectiveCamera {
        return this.camera;
    }

    public setTarget(target: Vector3): void {
        this.target = target;
    }

    public update(): void {
        if (this.target) {
            // Implement smooth camera following here
            this.camera.lookAt(this.target);
        }
    }

    // Update camera parameters for AR
    public updateCameraParameters(intrinsics: { fx: number; fy: number; cx: number; cy: number }): void {
        const { fx, fy, cx, cy } = intrinsics;
        
        // Convert intrinsic parameters to Three.js camera properties
        const near = 0.1;
        const far = 1000;
        const aspect = window.innerWidth / window.innerHeight;
        
        // Update projection matrix for AR
        this.camera.projectionMatrix.makePerspective(
            -cx / fx * aspect,
            (window.innerWidth - cx) / fx * aspect,
            -(window.innerHeight - cy) / fy,
            cy / fy,
            near,
            far
        );
    }

    public dispose(): void {
        window.removeEventListener('resize', this.onWindowResize.bind(this));
    }
}
