import { Arena } from './js/modules/Arena.js';
import { CONFIG } from './js/modules/Config.js';
import * as THREE from 'three';

global.document = {
    createElement: () => ({
        getContext: () => ({
            fillRect: () => { },
            fillStyle: ''
        }),
        width: 128,
        height: 128
    })
};

const mockRenderer = {
    addToScene: () => { },
    removeFromScene: () => { },
    createCamera: () => { }
};

try {
    const arena = new Arena(mockRenderer);
    arena.portalsEnabled = true;

    // Baue minimale Map
    CONFIG.MAPS.testmap = {
        name: 'test',
        size: [80, 30, 80],
        obstacles: [],
        portals: [
            { a: [-30, 12, 0], b: [30, 12, 0], color: 0xff0000 }
        ]
    };

    arena.build('testmap');

    console.log("Portal Count:", arena.portals.length);
    if (arena.portals.length > 0) {
        console.log("Portal A:", arena.portals[0].posA);
        console.log("Portal B:", arena.portals[0].posB);
    }

    // Simuliere Spieler
    const playerRadius = 0.8;
    const playerIndex = 0;

    // Setze Spieler genau in Trigger-Distanz von posA
    // trigger = 3.5 + 0.8 = 4.3
    // posA ist bei -90, 36, 0 (wegen SCALE = 3)
    const playerPos = new THREE.Vector3(-90, 36, 2.0); // distSq = 4.0 < 18.49
    console.log("Player Initial Position:", playerPos);

    const result = arena.checkPortal(playerPos, playerRadius, playerIndex);
    console.log("Portal Check Result:", result ? "HIT (Teleporting to " + JSON.stringify(result.target) + ")" : "MISS");

    if (result) {
        console.log("Cooldown von Entity 0 nach Hit:", arena.portals[0].cooldowns.get(0));
    }
} catch (e) {
    console.error("TEST FAILED WITH ERROR:", e);
}
