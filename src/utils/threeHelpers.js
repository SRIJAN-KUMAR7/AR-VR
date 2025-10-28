import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { Vector3 } from 'three';

/**
 * Load a GLTF model from given URL (expects public/models directory).
 */
export function loadGLTF(path) {
  const loader = new GLTFLoader();
  return new Promise((resolve, reject) => {
    loader.load(path, (gltf) => {
      resolve(gltf);
    }, undefined, (error) => {
      console.error('Error loading GLTF model:', error);
      reject(error);
    });
  });
}

/**
 * Smoothly interpolate current vector towards target (exponential smoothing).
 * alpha between 0 and 1 (e.g., 0.2 for moderate smoothing).
 */
export function smoothVector(current, target, alpha) {
  current.lerp(target, alpha);
}
