import React, { useEffect, useRef } from 'react';
import * as BABYLON from '@babylonjs/core';

const BabylonTestScreen: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<BABYLON.Engine | null>(null);
    const sceneRef = useRef<BABYLON.Scene | null>(null);
    const videoTextureRef = useRef<BABYLON.VideoTexture | null>(null);
    const leftArrowRef = useRef<BABYLON.Mesh | null>(null);
    const rightArrowRef = useRef<BABYLON.Mesh | null>(null);

    useEffect(() => {
        if (!canvasRef.current) return;

        // Initialize Babylon Engine
        engineRef.current = new BABYLON.Engine(canvasRef.current, true);
        const engine = engineRef.current;

        // Create Scene
        const scene = new BABYLON.Scene(engine);
        sceneRef.current = scene;

        // Setup orthographic camera for proper 2D-style viewing
        const camera = new BABYLON.FreeCamera('camera', new BABYLON.Vector3(0, 2, -2), scene);
        camera.setTarget(new BABYLON.Vector3(0, -1, 2)); // Look at track center
        camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
        
        // Set clipping planes to ensure all objects are visible
        camera.minZ = 0.1;
        camera.maxZ = 10;
        
        // Set initial ortho scale based on screen size
        const width = engine.getRenderWidth();
        const height = engine.getRenderHeight();
        const aspectRatio = width / height;
        
        // Use width as the base for scaling to maintain video proportions
        const orthoWidth = 2;
        const orthoHeight = orthoWidth / aspectRatio;
        
        camera.orthoLeft = -orthoWidth;
        camera.orthoRight = orthoWidth;
        camera.orthoBottom = -orthoHeight;
        camera.orthoTop = orthoHeight;
        
        // Handle window resize
        const handleResize = () => {
            const width = engine.getRenderWidth();
            const height = engine.getRenderHeight();
            const aspectRatio = width / height;
            
            // Use width as the base for scaling
            const orthoWidth = 2;
            const orthoHeight = orthoWidth / aspectRatio;
            
            // Update camera orthographic settings
            camera.orthoLeft = -orthoWidth;
            camera.orthoRight = orthoWidth;
            camera.orthoBottom = -orthoHeight;
            camera.orthoTop = orthoHeight;
            
            // Scale video plane to match orthographic view
            if (videoPlane) {
                videoPlane.scaling.x = orthoWidth * 2;
                videoPlane.scaling.y = orthoHeight * 2;
            }
            
            // Scale track and arrows
            if (trackPlane) {
                trackPlane.scaling.x = 2;
                trackPlane.scaling.z = 1.5;
            }
            
            // Update arrow positions
            const arrowOffset = 1.2;
            if (leftArrowRef.current) {
                leftArrowRef.current.position.x = -arrowOffset;
                leftArrowRef.current.position.y = 0;
                leftArrowRef.current.position.z = 0;
            }
            if (rightArrowRef.current) {
                rightArrowRef.current.position.x = arrowOffset;
                rightArrowRef.current.position.y = 0;
                rightArrowRef.current.position.z = 0;
            }
        };
        
        window.addEventListener('resize', handleResize);

        // Add lights
        new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), scene);

        // Create background video plane
        const videoPlane = BABYLON.MeshBuilder.CreatePlane('videoPlane', {
            width: 1,
            height: 1,
            sideOrientation: BABYLON.Mesh.DOUBLESIDE
        }, scene);
        videoPlane.position.z = 1; // Put video behind other elements
        
        // Ensure engine is ready before initial resize
        engine.runRenderLoop(() => {
            handleResize();
            scene.render();
        });

        // Setup webcam video texture
        navigator.mediaDevices.getUserMedia({ video: true })
            .then((stream) => {
                const video = document.createElement('video');
                video.srcObject = stream;
                video.play();

                videoTextureRef.current = new BABYLON.VideoTexture(
                    'webcam',
                    video,
                    scene,
                    true,
                    false
                );
                
                const videoMaterial = new BABYLON.StandardMaterial('videoMat', scene);
                videoMaterial.diffuseTexture = videoTextureRef.current;
                videoMaterial.emissiveTexture = videoTextureRef.current;
                videoMaterial.backFaceCulling = false;
                videoPlane.material = videoMaterial;
            });

        // Create track plane
        const trackPlane = BABYLON.MeshBuilder.CreateGround('trackPlane', {
            width: 2,
            height: 6
        }, scene);
        trackPlane.position.y = -1; // Lower the track
        trackPlane.position.z = 2; // Move track back for perspective
        trackPlane.rotation.x = Math.PI / 3.5; // Steeper angle for horizon effect

        const trackMaterial = new BABYLON.StandardMaterial('trackMat', scene);
        trackMaterial.diffuseColor = new BABYLON.Color3(0.5, 0.5, 0.5);
        trackMaterial.alpha = 0.7;
        trackPlane.material = trackMaterial;

        // Create turn indicators (arrows)
        const createArrow = (isLeft: boolean) => {
            const points = [
                new BABYLON.Vector3(0, 0, 0),
                new BABYLON.Vector3(isLeft ? -0.3 : 0.3, 0, -0.3),
                new BABYLON.Vector3(isLeft ? -0.6 : 0.6, 0, 0)
            ];
            
            const arrow = BABYLON.MeshBuilder.CreateTube(
                `${isLeft ? 'left' : 'right'}Arrow`,
                {
                    path: points,
                    radius: 0.05,
                    updatable: true
                },
                scene
            );

            const arrowMaterial = new BABYLON.StandardMaterial(
                `${isLeft ? 'left' : 'right'}ArrowMat`,
                scene
            );
            arrowMaterial.emissiveColor = new BABYLON.Color3(1, 1, 0);
            arrow.material = arrowMaterial;
            
            arrow.position.y = -0.2;
            arrow.position.z = 0.02; // Slightly in front of track
            arrow.position.x = isLeft ? -0.8 : 0.8;
            
            return arrow;
        };

        leftArrowRef.current = createArrow(true);
        rightArrowRef.current = createArrow(false);

        // Handle keyboard input
        // Track key states
        const keyStates = {
            left: false,
            right: false
        };

        const updateArrowColor = (arrow: BABYLON.Mesh | null, isActive: boolean) => {
            if (!arrow) return;
            
            const material = arrow.material;
            if (!(material instanceof BABYLON.StandardMaterial)) return;

            // Create animation for smooth color transition
            const animation = new BABYLON.Animation(
                'colorAnimation',
                'material.emissiveColor',
                30, // fps
                BABYLON.Animation.ANIMATIONTYPE_COLOR3,
                BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
            );

            const keys = [{
                frame: 0,
                value: material.emissiveColor.clone()
            }, {
                frame: 10,
                value: isActive ? new BABYLON.Color3(1, 0, 0) : new BABYLON.Color3(1, 1, 0)
            }];

            animation.setKeys(keys);
            arrow.animations = [animation];
            scene.beginAnimation(arrow, 0, 10, false);
        };

        const keyDownHandler = (event: KeyboardEvent) => {
            // Prevent default browser behavior
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                event.preventDefault();
            }

            if (event.key === 'ArrowLeft' && !keyStates.left) {
                keyStates.left = true;
                updateArrowColor(leftArrowRef.current, true);
            }
            if (event.key === 'ArrowRight' && !keyStates.right) {
                keyStates.right = true;
                updateArrowColor(rightArrowRef.current, true);
            }
        };

        const keyUpHandler = (event: KeyboardEvent) => {
            if (event.key === 'ArrowLeft') {
                keyStates.left = false;
                updateArrowColor(leftArrowRef.current, false);
            }
            if (event.key === 'ArrowRight') {
                keyStates.right = false;
                updateArrowColor(rightArrowRef.current, false);
            }
        };

        window.addEventListener('keydown', keyDownHandler);
        window.addEventListener('keyup', keyUpHandler);



        // Handle window resize
        window.addEventListener('resize', () => {
            engine.resize();
        });

        // Cleanup
        return () => {
            window.removeEventListener('keydown', keyDownHandler);
            window.removeEventListener('keyup', keyUpHandler);
            window.removeEventListener('resize', handleResize);
            scene.dispose();
            engine.dispose();
            if (videoTextureRef.current) {
                videoTextureRef.current.dispose();
            }
        };
    }, []);

    return (
        <div style={{ 
            width: '100vw', 
            height: '100vh', 
            overflow: 'hidden',
            background: 'black',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        }}>
            <canvas 
                ref={canvasRef} 
                style={{ 
                    width: '100%',
                    height: '100%',
                    display: 'block'
                }} 
            />
        </div>
    );
};

export default BabylonTestScreen;
