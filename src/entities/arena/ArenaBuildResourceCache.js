import * as THREE from 'three';

const CHECKER_TEXTURE_CACHE = new Map();
const MATERIAL_BUNDLE_CACHE = new Map();

function createCheckerTexture(lightColor, darkColor) {
    const size = 128;
    const half = size / 2;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext('2d');
    const light = `#${lightColor.toString(16).padStart(6, '0')}`;
    const dark = `#${darkColor.toString(16).padStart(6, '0')}`;

    ctx.fillStyle = light;
    ctx.fillRect(0, 0, half, half);
    ctx.fillRect(half, half, half, half);

    ctx.fillStyle = dark;
    ctx.fillRect(half, 0, half, half);
    ctx.fillRect(0, half, half, half);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestMipmapLinearFilter;
    texture.needsUpdate = true;
    return texture;
}

function getBaseCheckerTexture(lightColor, darkColor) {
    const key = `${lightColor}|${darkColor}`;
    if (!CHECKER_TEXTURE_CACHE.has(key)) {
        CHECKER_TEXTURE_CACHE.set(key, createCheckerTexture(lightColor, darkColor));
    }
    return CHECKER_TEXTURE_CACHE.get(key);
}

function round2(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
}

export function createArenaBuildSignature({ mapKey, scale, sx, sy, sz }) {
    return [
        String(mapKey || 'standard'),
        round2(scale),
        round2(sx),
        round2(sy),
        round2(sz),
    ].join('|');
}

export function getArenaMaterialBundle({
    checkerLightColor,
    checkerDarkColor,
    checkerWorldSize,
    sx,
    sy,
    sz,
}) {
    const bundleKey = [
        checkerLightColor,
        checkerDarkColor,
        round2(checkerWorldSize),
        round2(sx),
        round2(sy),
        round2(sz),
    ].join('|');

    if (MATERIAL_BUNDLE_CACHE.has(bundleKey)) {
        return MATERIAL_BUNDLE_CACHE.get(bundleKey);
    }

    const baseChecker = getBaseCheckerTexture(checkerLightColor, checkerDarkColor);
    const floorTexture = baseChecker.clone();
    floorTexture.needsUpdate = true;
    floorTexture.repeat.set(
        Math.max(1, sx / checkerWorldSize),
        Math.max(1, sz / checkerWorldSize)
    );

    const wallTexture = baseChecker.clone();
    wallTexture.needsUpdate = true;
    wallTexture.repeat.set(
        Math.max(1, sx / checkerWorldSize),
        Math.max(1, sy / checkerWorldSize)
    );

    const bundle = {
        floorTexture,
        wallTexture,
        wallMat: new THREE.MeshStandardMaterial({
            color: 0xffffff,
            map: wallTexture,
            transparent: true,
            opacity: 0.9,
            roughness: 0.75,
            metalness: 0.1,
            side: THREE.DoubleSide,
        }),
        floorMat: new THREE.MeshStandardMaterial({
            color: 0xffffff,
            map: floorTexture,
            roughness: 0.9,
            metalness: 0.05,
        }),
        obstacleMat: new THREE.MeshStandardMaterial({
            color: 0x2a2a4a,
            roughness: 0.4,
            metalness: 0.5,
            transparent: true,
            opacity: 0.6,
        }),
        foamMat: new THREE.MeshStandardMaterial({
            color: 0x2b5a49,
            roughness: 0.55,
            metalness: 0.15,
            transparent: true,
            opacity: 0.42,
        }),
        obstacleEdgeMat: new THREE.LineBasicMaterial({ color: 0x4466aa, transparent: true, opacity: 0.5 }),
        foamEdgeMat: new THREE.LineBasicMaterial({ color: 0x3ddc97, transparent: true, opacity: 0.42 }),
    };

    MATERIAL_BUNDLE_CACHE.set(bundleKey, bundle);
    return bundle;
}

