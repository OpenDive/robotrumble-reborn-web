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
        const emitter = BABYLON.MeshBuilder.CreateBox('emitter', { size: 0.1 }, scene);
        emitter.position = new BABYLON.Vector3(0, 0, -2);
        emitter.isVisible = false;

        // Set the particle emitter
        particleSystem.emitter = emitter;
        particleSystem.minEmitBox = new BABYLON.Vector3(-0.1, -0.1, -0.1);
        particleSystem.maxEmitBox = new BABYLON.Vector3(0.1, 0.1, 0.1);

        // Create a particle texture (simple circle)
        const particleTexture = new BABYLON.Texture(
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsTAAALEwEAmpwYAAAF0WlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgNy4yLWMwMDAgNzkuMWI2NWE3OWI0LCAyMDIyLzA2LzEzLTIyOjAxOjAxICAgICAgICAiPiA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPiA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtbG5zOnhtcE1NPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvbW0vIiB4bWxuczpzdEV2dD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL3NUeXBlL1Jlc291cmNlRXZlbnQjIiB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iIHhtbG5zOnBob3Rvc2hvcD0iaHR0cDovL25zLmFkb2JlLmNvbS9waG90b3Nob3AvMS4wLyIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgMjQuMCAoTWFjaW50b3NoKSIgeG1wOkNyZWF0ZURhdGU9IjIwMjMtMDUtMjBUMTY6MDY6NDctMDQ6MDAiIHhtcDpNZXRhZGF0YURhdGU9IjIwMjMtMDUtMjBUMTY6MDY6NDctMDQ6MDAiIHhtcDpNb2RpZnlEYXRlPSIyMDIzLTA1LTIwVDE2OjA2OjQ3LTA0OjAwIiB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOjNlZDU1OTEwLTU3NmMtNDY5ZC04ZTM1LTJmOGJhNzZhOTY5YyIgeG1wTU06RG9jdW1lbnRJRD0iYWRvYmU6ZG9jaWQ6cGhvdG9zaG9wOjM5YzI2ZTRiLTFjNmUtZGM0Yy1hMjA1LWEzNzY4NjM0MzE5NyIgeG1wTU06T3JpZ2luYWxEb2N1bWVudElEPSJ4bXAuZGlkOjNlZDU1OTEwLTU3NmMtNDY5ZC04ZTM1LTJmOGJhNzZhOTY5YyIgZGM6Zm9ybWF0PSJpbWFnZS9wbmciIHBob3Rvc2hvcDpDb2xvck1vZGU9IjMiPiA8eG1wTU06SGlzdG9yeT4gPHJkZjpTZXE+IDxyZGY6bGkgc3RFdnQ6YWN0aW9uPSJjcmVhdGVkIiBzdEV2dDppbnN0YW5jZUlEPSJ4bXAuaWlkOjNlZDU1OTEwLTU3NmMtNDY5ZC04ZTM1LTJmOGJhNzZhOTY5YyIgc3RFdnQ6d2hlbj0iMjAyMy0wNS0yMFQxNjowNjo0Ny0wNDowMCIgc3RFdnQ6c29mdHdhcmVBZ2VudD0iQWRvYmUgUGhvdG9zaG9wIDI0LjAgKE1hY2ludG9zaCkiLz4gPC9yZGY6U2VxPiA8L3htcE1NOkhpc3Rvcnk+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8P3hwYWNrZXQgZW5kPSJyIj8+aNWjKwAAA5BJREFUWIXtl11IU2EYx3/n7GxuabrNj2kuU8uPyjQjKzQiiaAgIYjo+iDBLoQgL7qIroS6CCLosqCbrgqCoLCbwsCLtGHRxzKtsD6c2Jy6fZh76zxdnB13ds5Sc4O6yD9sZ+d9n/f5/Z//85znfUUiQjhCKBQiFAoRDAYJBAIEg0H8fj8+nw+v14vH48HtduNyuXA6nTgcDhwOB3a7HZvNhtVqxWKxYDabMZlMGI1GDAYDer0enU6HVqtFo9Gg0WhQq9Wo1WpUKhVKpRKFQoFcLkcmk4UVSZIQEQk3JUnC7/fj8/nwer243W5cLhdOpxO73Y7NZsNqtWI2mzEajej1erRaLRqNBpVKhUKhQC6XIxKJkMlkyGQyRCIRYrEYiUSCVColISGBuLg44uLiiI2NJTo6mqioKCIjI4mIiEAulyOXy5HL5UgkEsRiMWKxGJFIhEgkQiQSIRaLEYvFiMViJBIJUqkUqVSKTCZDLpcjl8tRKBQoFAqUSiUqlQq1Wo1Go0Gr1aLT6dDr9RgMBgwGAwaDAaPRiNFoxGQyYTKZMJvNWCwWLBYLVqsVm82G3W7H4XDgdDpxuVy43W48Hg9erxefz4ff7ycQCBAMBgmFQoRCIUKhEJIkIYoIhUKEQiGCwSABvx+/34/P58Pr9eL1evF4PLjdblwuFw6HA7vdjs1mw2q1YjabMZlMGAwG9Ho9Op0OrVaLWq1GqVSiUCiQy+VIpVIkEgkSiQSxWIxIJEIkEiEWi5FIJEilUmQyGXK5HIVCgVKpRKVSoVarUSqVKJVKlEolKpUKtVqNRqNBq9Wi0+nQ6/UYDAaMRiMmkwmz2YzFYsFqtWKz2bDb7TidTlwuF263G4/Hg9frxefz4ff7CQQCBINBgsEgoVAISZIQEQqFCAaDBINBAoEAfr8fn8+H1+vF4/HgdrtxOp04HA5sNhtWqxWz2YzRaESv16PT6dBqtajVapRKJQqFArlcjlQqRSKRIBaLEYlEiEQixGIxEokEqVSKTCZDLpcjl8tRKBQolUpUKhVqtRqNRoNWq0Wn06HX6zEYDBiNRkwmE2azGYvFgtVqxWaz4XA4cDqduFwu3G43Ho8Hr9eL1+vF5/Ph9/sJBAIEg0GCwSChUAhJkhARCoUIBoMEAgH8fj8+nw+v14vH48HtduN0OnE4HNhsNqxWK2azGaPRiF6vR6fTodVqUavVKJVKFAoFcrkc2f/yGf4LfAWUEa5WxHMPzAAAAABJRU5ErkJggg==',
            scene
        );
        particleSystem.particleTexture = particleTexture;

        // Particle colors with more opacity
        particleSystem.color1 = new BABYLON.Color4(1, 0.5, 0, 1.0);
        particleSystem.color2 = new BABYLON.Color4(1, 0.2, 0, 1.0);
        particleSystem.colorDead = new BABYLON.Color4(0, 0, 0, 0.0);

        // Larger size for better visibility
        particleSystem.minSize = 0.2;
        particleSystem.maxSize = 0.4;
        particleSystem.minLifeTime = 0.5;
        particleSystem.maxLifeTime = 1.0;

        // More particles
        particleSystem.emitRate = 1000;
        particleSystem.minEmitPower = 3;
        particleSystem.maxEmitPower = 5;
        particleSystem.updateSpeed = 0.01;

        // Stronger upward motion
        particleSystem.gravity = new BABYLON.Vector3(0, 2, 0);
        particleSystem.direction1 = new BABYLON.Vector3(-1, 3, -1);
        particleSystem.direction2 = new BABYLON.Vector3(1, 3, 1);

        // Add some angular velocity for rotation
        particleSystem.minAngularSpeed = -Math.PI;
        particleSystem.maxAngularSpeed = Math.PI;

        // Use ADD blend mode for glow effect
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
                const particleSystem = particleSystemRef.current;
                if (!particleSystem?.emitter || !(particleSystem.emitter instanceof BABYLON.Mesh)) return;

                // Reset and start the particle system
                particleSystem.stop();
                particleSystem.reset();
                particleSystem.start();
                
                // Create a quick flash of light
                const light = new BABYLON.PointLight(
                    'explosionLight',
                    particleSystem.emitter.position.clone(),
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
                    if (particleSystem) {
                        particleSystem.stop();
                    }
                }, 1500);
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
