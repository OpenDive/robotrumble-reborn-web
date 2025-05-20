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

        // Setup camera
        const camera = new BABYLON.FreeCamera('camera', new BABYLON.Vector3(0, 2, -5), scene);
        camera.setTarget(BABYLON.Vector3.Zero());

        // Add lights
        new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), scene);

        // Create background video plane
        const videoPlane = BABYLON.MeshBuilder.CreatePlane('videoPlane', {
            width: 4,
            height: 3
        }, scene);
        videoPlane.position.z = 2;

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
        const trackPlane = BABYLON.MeshBuilder.CreateGround('track', {
            width: 2,
            height: 4
        }, scene);
        trackPlane.position.y = -0.5;
        trackPlane.rotation.x = Math.PI / 8; // Tilt towards horizon

        const trackMaterial = new BABYLON.StandardMaterial('trackMat', scene);
        trackMaterial.diffuseColor = new BABYLON.Color3(0.5, 0.5, 0.5);
        trackMaterial.alpha = 0.7;
        trackPlane.material = trackMaterial;

        // Create turn indicators (arrows)
        const createArrow = (isLeft: boolean) => {
            const points = [
                new BABYLON.Vector3(0, 0, 0),
                new BABYLON.Vector3(isLeft ? -0.5 : 0.5, 0, -0.5),
                new BABYLON.Vector3(isLeft ? -1 : 1, 0, 0)
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
            
            arrow.position.y = -0.3;
            arrow.position.z = -1;
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

        // Start render loop
        engine.runRenderLoop(() => {
            scene.render();
        });

        // Handle window resize
        window.addEventListener('resize', () => {
            engine.resize();
        });

        // Cleanup
        return () => {
            window.removeEventListener('keydown', keyDownHandler);
            window.removeEventListener('keyup', keyUpHandler);
            scene.dispose();
            engine.dispose();
            if (videoTextureRef.current) {
                videoTextureRef.current.dispose();
            }
        };
    }, []);

    return (
        <div className="w-full h-full">
            <canvas ref={canvasRef} className="w-full h-full" />
        </div>
    );
};

export default BabylonTestScreen;
