import * as THREE from 'three';
import { CONFIG } from '../../core/Config.js';

export function createBoostPortalMesh(position, rotation, color, renderer) {
    const group = new THREE.Group();

    const ringMat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 1.0,
        roughness: 0.25,
        metalness: 0.65,
    });
    const innerMat = new THREE.MeshBasicMaterial({
        color: 0xfff0a8,
        transparent: true,
        opacity: 0.28,
        side: THREE.DoubleSide,
    });

    const outerRing = new THREE.Mesh(new THREE.TorusGeometry(3.25, 0.22, 12, 48), ringMat);
    group.add(outerRing);

    const innerDisk = new THREE.Mesh(new THREE.RingGeometry(1.2, 2.95, 40, 1), innerMat);
    group.add(innerDisk);

    const spines = [];
    const spineGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.95, 6);
    const spineMat = new THREE.MeshBasicMaterial({ color: 0xffd17c, transparent: true, opacity: 0.65 });
    for (let i = 0; i < 6; i++) {
        const spine = new THREE.Mesh(spineGeo, spineMat);
        const angle = (Math.PI * 2 * i) / 6;
        spine.position.set(Math.cos(angle) * 1.75, Math.sin(angle) * 1.75, 0);
        spine.rotation.z = angle;
        spine.rotation.x = Math.PI / 2;
        group.add(spine);
        spines.push(spine);
    }

    group.userData.spines = spines;
    group.userData.outerRing = outerRing;
    group.userData.innerDisk = innerDisk;

    group.position.copy(position);
    group.quaternion.setFromEuler(rotation);
    renderer.addToScene(group);
    return group;
}

export function createSlingshotGateMesh(position, rotation, color, renderer) {
    const group = new THREE.Group();

    const ringMatA = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.95,
        roughness: 0.3,
        metalness: 0.6,
    });
    const ringMatB = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: color,
        emissiveIntensity: 0.6,
        roughness: 0.4,
        metalness: 0.45,
    });

    const frontRing = new THREE.Mesh(new THREE.TorusGeometry(2.9, 0.12, 10, 44), ringMatA);
    frontRing.position.z = 0.55;
    group.add(frontRing);

    const backRing = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.1, 10, 36), ringMatB);
    backRing.position.z = -0.55;
    group.add(backRing);

    const axisBeam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 2.1, 8),
        new THREE.MeshBasicMaterial({ color: 0xa7fcff, transparent: true, opacity: 0.25 }),
    );
    axisBeam.rotation.x = Math.PI / 2;
    group.add(axisBeam);

    group.userData.frontRing = frontRing;
    group.userData.backRing = backRing;
    group.userData.axisBeam = axisBeam;

    group.position.copy(position);
    group.quaternion.setFromEuler(rotation);
    renderer.addToScene(group);
    return group;
}

export function createPortalMesh(position, color, direction, renderer) {
    const group = new THREE.Group();
    const ringSize = CONFIG.PORTAL.RING_SIZE;

    let displayColor = color;
    if (direction === 'UP') displayColor = 0x00ff00;
    if (direction === 'DOWN') displayColor = 0xff0000;

    const torusGeo = new THREE.TorusGeometry(ringSize, 0.3, 16, 32);
    const torusMat = new THREE.MeshStandardMaterial({
        color: displayColor,
        emissive: displayColor,
        emissiveIntensity: 1.2,
        roughness: 0.2,
        metalness: 0.8,
    });
    const torus = new THREE.Mesh(torusGeo, torusMat);
    group.add(torus);

    const discGeo = new THREE.CircleGeometry(ringSize * 0.85, 32);
    const discMat = new THREE.MeshBasicMaterial({
        color: displayColor,
        transparent: true,
        opacity: 0.15,
        side: THREE.DoubleSide,
    });
    const disc = new THREE.Mesh(discGeo, discMat);
    group.add(disc);

    const innerTorusGeo = new THREE.TorusGeometry(ringSize * 0.6, 0.15, 12, 24);
    const innerTorusMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: displayColor,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.6,
    });
    const innerTorus = new THREE.Mesh(innerTorusGeo, innerTorusMat);
    group.add(innerTorus);

    if (direction !== 'NEUTRAL') {
        const arrowGeo = new THREE.ConeGeometry(0.8, 2.5, 8);
        const arrowMat = new THREE.MeshBasicMaterial({
            color: displayColor,
            transparent: true,
            opacity: 0.8,
        });
        const arrow = new THREE.Mesh(arrowGeo, arrowMat);

        if (direction === 'UP') {
            arrow.position.y = 0;
        } else if (direction === 'DOWN') {
            arrow.rotation.x = Math.PI;
            arrow.position.y = 0;
        }

        group.add(arrow);
        group.userData.arrow = arrow;
        group.userData.direction = direction;
    }

    group.position.copy(position);
    renderer.addToScene(group);
    return group;
}
