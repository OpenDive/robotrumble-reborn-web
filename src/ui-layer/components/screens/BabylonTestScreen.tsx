import React, { useEffect, useRef } from 'react';
import * as BABYLON from '@babylonjs/core';
import '@babylonjs/core/Particles';

const BabylonTestScreen: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<BABYLON.Engine | null>(null);
    const sceneRef = useRef<BABYLON.Scene | null>(null);
    const videoTextureRef = useRef<BABYLON.VideoTexture | null>(null);
    const leftArrowRef = useRef<BABYLON.Mesh | null>(null);
    const rightArrowRef = useRef<BABYLON.Mesh | null>(null);
    const particleSystemRef = useRef<BABYLON.ParticleSystem | null>(null);

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

        // Create a particle system
        const particleSystem = new BABYLON.ParticleSystem('explosion', 2000, scene);
        particleSystemRef.current = particleSystem;

        // Create a particle emitter as a sphere
        const emitter = BABYLON.MeshBuilder.CreateSphere('emitter', { diameter: 0.1 }, scene);
        emitter.position = new BABYLON.Vector3(0, 0, -2);
        emitter.isVisible = false;

        // Set the particle emitter
        particleSystem.emitter = emitter;
        particleSystem.minEmitBox = new BABYLON.Vector3(-0.1, -0.1, -0.1);
        particleSystem.maxEmitBox = new BABYLON.Vector3(0.1, 0.1, 0.1);

        // Create a default particle texture
        const texture = new BABYLON.Texture('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAAXNSR0IArs4c6QAAAAZiS0dEAP8A/wD/oL2nkwAAAAlwSFlzAAALEwAACxMBAJqcGAAAAAd0SU1FB9oFBxMWGxXhZY0AAAAZdEVYdENvbW1lbnQAQ3JlYXRlZCB3aXRoIEdJTVBXgQ4XAAAAJUlEQVQY02NgYGD4z0AEYCJGEQMDAwMjjM0EFRhgAOYgKYgpBQBnNgmWk/JKZAAAAABJRU5ErkJggg==', scene);
        particleSystem.particleTexture = texture;

        // Particle colors
        particleSystem.color1 = new BABYLON.Color4(1, 0.5, 0, 1.0);
        particleSystem.color2 = new BABYLON.Color4(1, 0.2, 0, 1.0);
        particleSystem.colorDead = new BABYLON.Color4(0, 0, 0, 0.0);

        // Size and lifetime
        particleSystem.minSize = 0.1;
        particleSystem.maxSize = 0.3;
        particleSystem.minLifeTime = 0.5;
        particleSystem.maxLifeTime = 1.0;

        // Emission properties
        particleSystem.emitRate = 500;
        particleSystem.minEmitPower = 2;
        particleSystem.maxEmitPower = 4;
        particleSystem.updateSpeed = 0.01;

        // Gravity and direction
        particleSystem.gravity = new BABYLON.Vector3(0, 1, 0);
        particleSystem.direction1 = new BABYLON.Vector3(-1, 2, -1);
        particleSystem.direction2 = new BABYLON.Vector3(1, 2, 1);

        // Blend mode for better visual effect
        particleSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;

        // Start the system in stopped state
        particleSystem.stop();

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
            if (event.key === ' ') { // Spacebar
                event.preventDefault();
                if (particleSystemRef.current) {
                    // Reset and start the particle system
                    particleSystemRef.current.stop();
                    particleSystemRef.current.reset();
                    particleSystemRef.current.start();
                    
                    // Create a quick flash of light
                    const light = new BABYLON.PointLight('explosionLight', 
                        particleSystemRef.current.emitter.position, 
                        scene
                    );
                    light.intensity = 2;
                    light.diffuse = new BABYLON.Color3(1, 0.5, 0);
                    
                    // Animate light intensity down and remove it
                    const lightAnim = new BABYLON.Animation(
                        'lightAnim',
                        'intensity',
                        60,
                        BABYLON.Animation.ANIMATIONTYPE_FLOAT,
                        BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
                    );
                    
                    const lightKeys = [
                        { frame: 0, value: 2 },
                        { frame: 30, value: 0 }
                    ];
                    
                    lightAnim.setKeys(lightKeys);
                    light.animations = [lightAnim];
                    
                    scene.beginAnimation(light, 0, 30, false, 1, () => {
                        light.dispose();
                    });
                    
                    // Stop particles after 1.5 seconds
                    setTimeout(() => {
                        if (particleSystemRef.current) {
                            particleSystemRef.current.stop();
                        }
                    }, 1500);
                }
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
