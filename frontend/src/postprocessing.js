import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

const crtShader = {
    uniforms: {
        tDiffuse: { value: null },
        time: { value: 0 },
        resolution: { value: new THREE.Vector2(1, 1) },
        scanlineDensity: { value: 780.0 },
        scanlineStrength: { value: 0.06 },
        chromaAmount: { value: 0.0012 },
        vignetteStrength: { value: 0.18 },
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float time;
        uniform vec2 resolution;
        uniform float scanlineDensity;
        uniform float scanlineStrength;
        uniform float chromaAmount;
        uniform float vignetteStrength;
        varying vec2 vUv;

        void main() {
            vec2 uv = vUv;

            float chromaOffset = chromaAmount + (sin(time * 0.6) * chromaAmount * 0.35);
            float r = texture2D(tDiffuse, uv + vec2(chromaOffset, 0.0)).r;
            float g = texture2D(tDiffuse, uv).g;
            float b = texture2D(tDiffuse, uv - vec2(chromaOffset, 0.0)).b;
            vec3 color = vec3(r, g, b);

            float scanline = sin((uv.y * scanlineDensity) + (time * 8.0));
            color *= 1.0 - ((scanline * 0.5 + 0.5) * scanlineStrength);

            float dist = distance(uv, vec2(0.5));
            float vignette = smoothstep(0.24, 0.82, dist);
            color *= (1.0 - vignette * vignetteStrength);

            gl_FragColor = vec4(color, 1.0);
        }
    `,
};

export function initPostProcessing(renderer, scene, camera) {
    const size = new THREE.Vector2(window.innerWidth, window.innerHeight);
    const composer = new EffectComposer(renderer);
    composer.setSize(size.x, size.y);
    composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    const bloomPass = new UnrealBloomPass(size, 0.55, 0.42, 0.7);
    composer.addPass(bloomPass);

    const crtPass = new ShaderPass(crtShader);
    crtPass.uniforms.resolution.value.set(size.x, size.y);
    composer.addPass(crtPass);

    return {
        render(elapsedTime) {
            crtPass.uniforms.time.value = elapsedTime;
            composer.render();
        },
        resize(width, height) {
            composer.setSize(width, height);
            crtPass.uniforms.resolution.value.set(width, height);
        },
        setBloomStrength(strength) {
            bloomPass.strength = strength;
        },
    };
}
