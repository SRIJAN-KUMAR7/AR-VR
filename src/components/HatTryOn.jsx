import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { FaceMesh } from '@mediapipe/face_mesh';
import { Camera as MpCamera } from '@mediapipe/camera_utils';
import { loadGLTF } from '../utils/threeHelpers';

// remove: import { FaceMesh } from '@mediapipe/face_mesh';
// add dynamic loader
async function ensureMediapipeScripts() {
  const base = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1646424915/';
  await loadScript(base + 'face_mesh_solution_packed_assets_loader.js');
  await loadScript(base + 'face_mesh.js');
}


function HatTryOn({ modelPath, deviceId }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const hatGroupRef = useRef(new THREE.Group());
  const mpCameraRef = useRef(null);

  useEffect(() => {
    let camera3, scene, renderer;
    let hatGroup = hatGroupRef.current;
    let currentModel = null;
    let faceMesh = null;
    let renderRaf = null;

    function initThree(width, height) {
      scene = new THREE.Scene();
      camera3 = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
      camera3.position.set(0, 0, 5);

      scene.add(new THREE.AmbientLight(0xffffff, 0.9));
      const dir = new THREE.DirectionalLight(0xffffff, 0.8);
      dir.position.set(0, 5, 10);
      scene.add(dir);

      hatGroup.position.set(0, 0, 0);
      hatGroup.scale.setScalar(1);
      scene.add(hatGroup);

      renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, alpha: true, antialias: true });
      renderer.setPixelRatio(window.devicePixelRatio || 1);
      renderer.setSize(width, height, false);
      renderer.outputEncoding = THREE.sRGBEncoding;

      // make canvas full-viewport CSS
      canvasRef.current.style.width = `${width}px`;
      canvasRef.current.style.height = `${height}px`;
    }

    function renderLoop() {
      if (renderer && scene && camera3) renderer.render(scene, camera3);
      renderRaf = requestAnimationFrame(renderLoop);
    }

    async function loadModel(path) {
      if (!path) return;
      try {
        const gltf = await loadGLTF(path);
        if (currentModel) {
          hatGroup.remove(currentModel);
          currentModel.traverse((c) => {
            if (c.geometry) c.geometry.dispose();
            if (c.material) {
              if (Array.isArray(c.material)) c.material.forEach(m => m.dispose && m.dispose());
              else m.material && m.material.dispose && m.material.dispose();
            }
          });
        }
        currentModel = gltf.scene;
        currentModel.position.set(0, 0, 0);
        currentModel.rotation.set(0, 0, 0);
        currentModel.scale.setScalar(1);
        hatGroup.add(currentModel);
        console.log('Model loaded:', path);
      } catch (err) {
        console.error('loadGLTF error', err);
      }
    }

    // onResults: uses landmarks to compute pose & scale and updates hatGroup
    function onResults(results) {
      if (!results || !results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
        hatGroup.visible = false;
        return;
      }
      hatGroup.visible = true;
      const lm = results.multiFaceLandmarks[0];

      const avgPoints = (idxs) => {
        const out = { x: 0, y: 0, z: 0 };
        idxs.forEach(i => { out.x += lm[i].x; out.y += lm[i].y; out.z += (lm[i].z ?? 0); });
        out.x /= idxs.length; out.y /= idxs.length; out.z /= idxs.length;
        return out;
      };

      const leftEye = avgPoints([33, 133]);
      const rightEye = avgPoints([362, 263]);
      const nose = lm[1];
      const chin = lm[152];
      const forehead = avgPoints([10, 109, 338]);

      const toVec = p => new THREE.Vector3(p.x - 0.5, 0.5 - p.y, p.z || 0);
      const eyeL = toVec(leftEye);
      const eyeR = toVec(rightEye);
      const noseV = toVec(nose);
      const chinV = toVec(chin);
      const foreheadV = toVec(forehead);

      const eyeDist = eyeL.distanceTo(eyeR);
      const estimatedDepth = 1.0; // camera plane depth approximation
      const halfHeight = estimatedDepth * Math.tan(THREE.MathUtils.degToRad(camera3.fov / 2));
      const halfWidth = halfHeight * camera3.aspect;
      const worldEyeDist = eyeDist * 2 * halfWidth;
      const k = 1.0; // model-size tuning constant if needed
      const targetScale = worldEyeDist * k;

      const right = new THREE.Vector3().subVectors(eyeR, eyeL).normalize();
      const forward = new THREE.Vector3().subVectors(chinV, noseV).normalize().negate();
      const up = new THREE.Vector3().crossVectors(forward, right).normalize();
      right.copy(new THREE.Vector3().crossVectors(up, forward).normalize());

      const rotMat = new THREE.Matrix4();
      rotMat.makeBasis(right, up, forward);
      const targetQuat = new THREE.Quaternion().setFromRotationMatrix(rotMat);

      const fx = foreheadV.x * 2 * halfWidth;
      const fy = foreheadV.y * 2 * halfHeight;
      const fWorld = new THREE.Vector3(fx, fy, 0);
      const crownOffset = 0.25 * targetScale;
      const targetPos = new THREE.Vector3().addVectors(fWorld, up.clone().multiplyScalar(crownOffset));

      // smoothing
      const posAlpha = 0.25, rotAlpha = 0.25, scaleAlpha = 0.25;
      hatGroup.position.lerp(targetPos, posAlpha);
      hatGroup.quaternion.slerp(targetQuat, rotAlpha);
      const curScale = hatGroup.scale.x || 1;
      const newScale = curScale + (targetScale - curScale) * scaleAlpha;
      hatGroup.scale.setScalar(newScale);
    }

    async function start() {
      const video = videoRef.current;
      if (!video) return console.error('videoRef not set');

      // request camera stream
      try {
        const constraints = deviceId
          ? { video: { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } } }
          : { video: { width: { ideal: 1280 }, height: { ideal: 720 } } };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;
      } catch (err) {
        console.error('getUserMedia failed', err);
        return;
      }

      // wait for video metadata (sizes)
      await new Promise((resolve) => {
        if (video.readyState >= 2 && video.videoWidth && video.videoHeight) return resolve();
        const onLoaded = () => { video.removeEventListener('loadedmetadata', onLoaded); resolve(); };
        video.addEventListener('loadedmetadata', onLoaded);
      });

      const width = window.innerWidth;
      const height = window.innerHeight;
      initThree(width, height);
      renderLoop();

      // Use a pinned mediapipe release for locateFile so tflite/wasm assets load correctly
      faceMesh = new FaceMesh({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1646424915/${file}`
      });
      faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.5
      });
      faceMesh.onResults(onResults);

      // Use Camera helper — it handles proper frame creation & timing
      try {
        mpCameraRef.current = new MpCamera(video, {
          onFrame: async () => {
            await faceMesh.send({ image: video });
          },
          width: 1280,
          height: 720
        });
        mpCameraRef.current.start();
      } catch (err) {
        console.error('MpCamera start error:', err);
        // fallback: we can attempt a manual loop but Camera is recommended
      }

      // load model (initial)
      if (modelPath) await loadModel(modelPath);
    }

    start().catch(err => console.error('start() error', err));

    // cleanup
    return () => {
      if (renderRaf) cancelAnimationFrame(renderRaf);
      if (mpCameraRef.current) {
        try { mpCameraRef.current.stop(); } catch (e) { /* ignore */ }
        mpCameraRef.current = null;
      }
      if (faceMesh) try { faceMesh.close(); } catch (e) { /* ignore */ }
      const v = videoRef.current;
      if (v && v.srcObject) {
        v.srcObject.getTracks().forEach(t => t.stop());
        v.srcObject = null;
      }
      if (renderer) try { renderer.dispose(); } catch (e) { /* ignore */ }
    };
  }, [deviceId, modelPath]);

  // hot-swap model when modelPath changes (keeps code simple)
  useEffect(() => {
    (async () => {
      if (!modelPath) return;
      try {
        const gltf = await loadGLTF(modelPath);
        const hatGroup = hatGroupRef.current;
        while (hatGroup.children.length) hatGroup.remove(hatGroup.children[0]);
        hatGroup.add(gltf.scene);
        console.log('Swapped model to', modelPath);
      } catch (err) {
        console.error('Failed to swap model', err);
      }
    })();
  }, [modelPath]);

  const videoStyle = {
    position: 'fixed',
    left: 0,
    top: 0,
    width: '100vw',
    height: '100vh',
    objectFit: 'cover',
    transform: 'scaleX(-1)', 
    zIndex: 1,
    opacity: 1 
  };
  const canvasStyle = {
    position: 'fixed',
    left: 0,
    top: 0,
    width: '100vw',
    height: '100vh',
    zIndex: 2,
    pointerEvents: 'none'
  };

  return (
    <>
      <video ref={videoRef} autoPlay playsInline muted style={videoStyle} />
      <canvas ref={canvasRef} style={canvasStyle} />
    </>
  );
}

export default HatTryOn;
