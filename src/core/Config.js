// ============================================
// Config.js - Zentrale Spielkonfiguration
// ============================================

import { GENERATED_LOCAL_MAPS } from '../entities/GeneratedLocalMaps.js';

export const CONFIG = {
    // ---- Allgemein ----
    TICK_RATE: 60,
    TIME_STEP: 1 / 60,
    MAX_UPDATES_PER_FRAME: 5,

    // ---- Arena ----
    ARENA: {
        SIZE: 80,
        WALL_HEIGHT: 30,
        WALL_THICKNESS: 2,
        FLOOR_COLOR: 0x0a0a1a,
        WALL_COLOR: 0x1a1a3a,
        GRID_COLOR: 0x1a1a2e,
        MAP_SCALE: 3,
        CHECKER_LIGHT_COLOR: 0xd9d9d9,
        CHECKER_DARK_COLOR: 0x5a5a5a,
        CHECKER_WORLD_SIZE: 18,
    },

    // ---- Spieler ----
    PLAYER: {
        SPEED: 18,
        TURN_SPEED: 2.2,
        ROLL_SPEED: 2.0,
        BOOST_MULTIPLIER: 1.8,
        BOOST_DURATION: 2.0,
        BOOST_COOLDOWN: 5.0,
        SPAWN_PROTECTION: 1.0,
        HITBOX_RADIUS: 0.8,
        MODEL_SCALE: 1.0,
        NOSE_CAMERA_LOCAL_X: 0,
        NOSE_CAMERA_LOCAL_Y: 0.05,
        NOSE_CAMERA_LOCAL_Z: -1.95,
        START_Y: 10,
        AUTO_ROLL: true,
        AUTO_ROLL_SPEED: 1.5,
        DEFAULT_VEHICLE_ID: 'ship5',
    },

    // ---- Gameplay Options ----
    GAMEPLAY: {
        PLANAR_MODE: false,
        PORTAL_COUNT: 0,
        PLANAR_LEVEL_COUNT: 5,
        PORTAL_BEAMS: false,
        PLANAR_AIM_INPUT_SPEED: 1.5,
        PLANAR_AIM_RETURN_SPEED: 0.6,
    },

    // ---- Trail (Schweifspur) ----
    TRAIL: {
        WIDTH: 0.6,
        UPDATE_INTERVAL: 0.07,
        GAP_CHANCE: 0.02,
        GAP_DURATION: 0.3,
        MAX_SEGMENTS: 5000,
    },

    // ---- Rendering ----
    RENDER: {
        MAX_PIXEL_RATIO: 1.35,
        SHADOW_MAP_SIZE: 512,
    },

    // ---- Powerups ----
    POWERUP: {
        SPAWN_INTERVAL: 3.0,
        MAX_ON_FIELD: 8,
        PICKUP_RADIUS: 2.5,
        SIZE: 1.5,
        ROTATION_SPEED: 2.0,
        BOUNCE_SPEED: 1.5,
        BOUNCE_HEIGHT: 0.5,
        MAX_INVENTORY: 5,
        DURATION: 5.0,

        TYPES: {
            SPEED_UP: { name: 'Schneller', color: 0x00ff66, icon: '⚡', duration: 4, multiplier: 1.6 },
            SLOW_DOWN: { name: 'Langsamer', color: 0xff3333, icon: '🐢', duration: 4, multiplier: 0.5 },
            THICK: { name: 'Dick', color: 0xffcc00, icon: '🧱', duration: 5, trailWidth: 1.8 },
            THIN: { name: 'Dünn', color: 0xaa44ff, icon: '✂', duration: 5, trailWidth: 0.2 },
            SHIELD: { name: 'Schild', color: 0x4488ff, icon: '🛡', duration: 3 },
            SLOW_TIME: { name: 'Zeitlupe', color: 0x44ff88, icon: '🕙', duration: 4, timeScale: 0.4 },
            GHOST: { name: 'Geist', color: 0xff66cc, icon: '👻', duration: 3 },
            INVERT: { name: 'Invertieren', color: 0xff00ff, icon: '🔀', duration: 4 },
        }
    },

    // ---- Bots ----
    BOT: {
        DEFAULT_DIFFICULTY: 'NORMAL',
        ACTIVE_DIFFICULTY: 'NORMAL',
        REACTION_TIME: 0.13,
        LOOK_AHEAD: 13,
        AGGRESSION: 0.58,
        DIFFICULTY_PROFILES: {
            EASY: {
                reactionTime: 0.24,
                lookAhead: 11,
                aggression: 0.36,
                errorRate: 0.24,
                probeSpread: 0.62,
                probeStep: 2.3,
                turnCommitTime: 0.14,
                stuckCheckInterval: 0.45,
                stuckTriggerTime: 1.7,
                minProgressDistance: 0.85,
                minForwardProgress: 0.35,
                recoveryDuration: 0.95,
                recoveryCooldown: 1.9,
                itemUseCooldown: 1.25,
                itemShootCooldown: 0.8,
                targetRefreshInterval: 0.28,
                portalInterest: 0.35,
                portalSeekDistance: 60,
                portalEntryDotMin: 0.22,
                portalIntentThreshold: 0.25,
                portalIntentDuration: 0.9,
                boostChance: 0.0025,
                // Neue Parameter
                probeCount: 7,
                projectileAwareness: 0,
                pursuitEnabled: false,
                pursuitRadius: 0,
                pursuitAimTolerance: 0.95,
                heightBias: 0,
                spacingWeight: 0,
                itemContextWeight: 0.2,
            },
            NORMAL: {
                reactionTime: 0.14,
                lookAhead: 13,
                aggression: 0.58,
                errorRate: 0.11,
                probeSpread: 0.74,
                probeStep: 1.6,
                turnCommitTime: 0.18,
                stuckCheckInterval: 0.4,
                stuckTriggerTime: 1.2,
                minProgressDistance: 0.9,
                minForwardProgress: 0.45,
                recoveryDuration: 1.3,
                recoveryCooldown: 1.55,
                itemUseCooldown: 0.95,
                itemShootCooldown: 0.62,
                targetRefreshInterval: 0.2,
                portalInterest: 0.56,
                portalSeekDistance: 72,
                portalEntryDotMin: 0.28,
                portalIntentThreshold: 0.2,
                portalIntentDuration: 1.15,
                boostChance: 0.0045,
                // Neue Parameter
                probeCount: 10,
                projectileAwareness: 0.6,
                pursuitEnabled: true,
                pursuitRadius: 35,
                pursuitAimTolerance: 0.85,
                heightBias: 0.15,
                spacingWeight: 0.3,
                itemContextWeight: 0.7,
            },
            HARD: {
                reactionTime: 0.08,
                lookAhead: 16,
                aggression: 0.74,
                errorRate: 0.04,
                probeSpread: 0.9,
                probeStep: 1.4,
                turnCommitTime: 0.24,
                stuckCheckInterval: 0.35,
                stuckTriggerTime: 1.0,
                minProgressDistance: 1.0,
                minForwardProgress: 0.5,
                recoveryDuration: 1.25,
                recoveryCooldown: 1.2,
                itemUseCooldown: 0.78,
                itemShootCooldown: 0.48,
                targetRefreshInterval: 0.12,
                portalInterest: 0.74,
                portalSeekDistance: 84,
                portalEntryDotMin: 0.35,
                portalIntentThreshold: 0.14,
                portalIntentDuration: 1.35,
                boostChance: 0.0065,
                // Neue Parameter
                probeCount: 12,
                projectileAwareness: 0.95,
                pursuitEnabled: true,
                pursuitRadius: 50,
                pursuitAimTolerance: 0.75,
                heightBias: 0.25,
                spacingWeight: 0.5,
                itemContextWeight: 1.0,
            },
        },
    },

    // ---- Projektile (Item-Schuss) ----
    PROJECTILE: {
        SPEED: 45,
        RADIUS: 0.7,
        LIFE_TIME: 3.0,
        MAX_DISTANCE: 140,
        COOLDOWN: 0.45,
        PLANAR_AIM_MAX_ANGLE_DEG: 18,
    },

    // ---- Portale ----
    PORTAL: {
        RADIUS: 4.0,
        COOLDOWN: 1.2,
        RING_SIZE: 4.0,
        ROTATION_SPEED: 2.0,
        MIN_PAIR_DISTANCE: 15,
        MIN_PAIR_DISTANCE_PLANAR: 4,
    },

    // ---- Homing (Zielsuchend) ----
    HOMING: {
        LOCK_ON_ANGLE: 15,       // Grad – Lock-On-Kegel
        TURN_RATE: 3.0,          // Wie schnell Rakete zum Ziel lenkt (Rad/s)
        MAX_LOCK_RANGE: 100,     // Maximale Lock-On-Entfernung
    },

    // ---- Farben ----
    COLORS: {
        PLAYER_1: 0x00aaff,
        PLAYER_2: 0xff8800,
        BOT_COLORS: [0xff4444, 0x44ff44, 0xffff44, 0xff44ff, 0x44ffff],
        BACKGROUND: 0x080812,
        AMBIENT_LIGHT: 0x334466,
        POINT_LIGHT: 0xffffff,
    },

    // ---- Kamera ----
    CAMERA: {
        FOV: 75,
        NEAR: 0.1,
        FAR: 200,
        FOLLOW_DISTANCE: 12,
        FOLLOW_HEIGHT: 6,
        LOOK_AHEAD: 5,
        SMOOTHING: 0.08,
        MODES: ['THIRD_PERSON', 'FIRST_PERSON', 'TOP_DOWN'],
        FIRST_PERSON_LOCK_TO_NOSE: true,
        FIRST_PERSON_NOSE_CLEARANCE: 0.3,
        FIRST_PERSON_OFFSET: 4.0, // Kamera vor dem Flugzeug
        FIRST_PERSON_BOOST_OFFSET: 1.45, // waehrend Boost naeher an die Nase
        FIRST_PERSON_BOOST_BLEND_SPEED: 8.5,
        COLLISION_RADIUS: 0.45,
        COLLISION_BACKOFF: 0.04,
        COLLISION_STEPS: 8,
    },

    // ---- Maps ----
    MAPS: {
        standard: {
            name: 'Standard Arena',
            size: [80, 30, 80],
            obstacles: [
                { pos: [0, 5, 0], size: [4, 10, 4] },
                { pos: [20, 5, 20], size: [3, 10, 3] },
                { pos: [-20, 5, -20], size: [3, 10, 3] },
                { pos: [20, 5, -20], size: [3, 10, 3] },
                { pos: [-20, 5, 20], size: [3, 10, 3] },
            ],
            portals: [
                { a: [-30, 12, 0], b: [30, 12, 0], color: 0x00ffcc },
            ]
        },
        custom: {
            name: 'Custom (Editor gespeichert)',
            size: [80, 30, 80],
            obstacles: [],
            portals: [],
        },
        empty: {
            name: 'Leer',
            size: [50, 25, 50],
            obstacles: [],
            portals: []
        },
        maze: {
            name: 'Labyrinth',
            size: [80, 25, 80],
            obstacles: [
                { pos: [-20, 5, -20], size: [20, 10, 2] },
                { pos: [20, 5, -20], size: [20, 10, 2] },
                { pos: [0, 5, 0], size: [30, 10, 2] },
                { pos: [-20, 5, 20], size: [20, 10, 2] },
                { pos: [20, 5, 20], size: [20, 10, 2] },
                { pos: [-20, 5, 0], size: [2, 10, 20] },
                { pos: [20, 5, 0], size: [2, 10, 20] },
                { pos: [0, 5, -20], size: [2, 10, 15] },
                { pos: [0, 5, 20], size: [2, 10, 15] },
            ],
            portals: [
                { a: [-30, 10, -30], b: [30, 10, 30], color: 0xff66ff },
                { a: [30, 10, -30], b: [-30, 10, 30], color: 0x66ccff },
            ]
        },
        complex: {
            name: 'Komplex',
            size: [90, 30, 90],
            obstacles: [
                { pos: [0, 5, 0], size: [6, 12, 6] },
                { pos: [-25, 5, -25], size: [10, 8, 2] },
                { pos: [25, 5, -25], size: [2, 8, 10] },
                { pos: [-25, 5, 25], size: [2, 8, 10] },
                { pos: [25, 5, 25], size: [10, 8, 2] },
                { pos: [-15, 5, 0], size: [2, 15, 15] },
                { pos: [15, 5, 0], size: [2, 15, 15] },
                { pos: [0, 5, -15], size: [15, 15, 2] },
                { pos: [0, 5, 15], size: [15, 15, 2] },
                { pos: [-30, 3, 0], size: [5, 6, 5] },
                { pos: [30, 3, 0], size: [5, 6, 5] },
            ],
            portals: [
                { a: [-35, 12, -35], b: [35, 12, 35], color: 0xffaa00 },
                { a: [35, 12, -35], b: [-35, 12, 35], color: 0x00aaff },
            ]
        },
        pyramid: {
            name: 'Pyramide',
            size: [80, 35, 80],
            obstacles: [
                { pos: [0, 2, 0], size: [20, 4, 20] },
                { pos: [0, 6, 0], size: [15, 4, 15] },
                { pos: [0, 10, 0], size: [10, 4, 10] },
                { pos: [0, 14, 0], size: [5, 4, 5] },
                { pos: [-30, 5, -30], size: [3, 10, 3] },
                { pos: [30, 5, -30], size: [3, 10, 3] },
                { pos: [-30, 5, 30], size: [3, 10, 3] },
                { pos: [30, 5, 30], size: [3, 10, 3] },
            ],
            portals: [
                { a: [0, 25, -30], b: [0, 25, 30], color: 0xff44ff },
            ]
        },
        vertical_maze: {
            name: 'Vertikales Labyrinth',
            size: [100, 45, 100],
            obstacles: [
                // Pfeiler vom Boden
                { pos: [30, 15, 30], size: [8, 30, 8] },
                { pos: [-30, 15, -30], size: [8, 30, 8] },
                { pos: [-30, 15, 30], size: [8, 30, 8] },
                { pos: [30, 15, -30], size: [8, 30, 8] },
                // Zentraler Block
                { pos: [0, 35, 0], size: [24, 20, 24] },
                // Wechselnde vertikale Wände
                { pos: [-40, 35, 0], size: [4, 20, 60] }, // Decke Links
                { pos: [40, 10, 0], size: [4, 20, 60] },  // Boden Rechts
                { pos: [0, 35, 40], size: [60, 20, 4] },  // Decke Vorne
                { pos: [0, 10, -40], size: [60, 20, 4] }   // Boden Hinten
            ],
            portals: [
                { a: [-40, 10, -40], b: [40, 35, 40], color: 0x00ffcc },
                { a: [40, 10, -40], b: [-40, 35, 40], color: 0xff00ff }
            ]
        },
        trench: {
            name: 'Der Graben',
            size: [60, 40, 160],
            obstacles: [
                // Hohe Seitenwände für Graben-Gefühl
                { pos: [-25, 20, 0], size: [4, 40, 160] },
                { pos: [25, 20, 0], size: [4, 40, 160] },
                // Hindernisse im Graben
                { pos: [0, 10, -40], size: [20, 4, 4] },
                { pos: [0, 30, 0], size: [20, 4, 4] },
                { pos: [0, 10, 40], size: [20, 4, 4] },
            ],
            portals: []
        },
        foam_forest: {
            name: 'Schaumwald',
            size: [100, 30, 100],
            obstacles: [
                { pos: [15, 15, 15], size: [3, 30, 3], kind: 'foam' },
                { pos: [-15, 15, 15], size: [3, 30, 3], kind: 'foam' },
                { pos: [15, 15, -15], size: [3, 30, 3], kind: 'foam' },
                { pos: [-15, 15, -15], size: [3, 30, 3], kind: 'foam' },
                { pos: [30, 15, 0], size: [3, 30, 3], kind: 'foam' },
                { pos: [-30, 15, 0], size: [3, 30, 3], kind: 'foam' },
                { pos: [0, 15, 30], size: [3, 30, 3], kind: 'foam' },
                { pos: [0, 15, -30], size: [3, 30, 3], kind: 'foam' },
                { pos: [0, 8, 0], size: [10, 16, 10], kind: 'foam' }
            ],
            portals: []
        },
        crossfire: {
            name: 'Kreuzfeuer',
            size: [120, 40, 120],
            obstacles: [
                { pos: [0, 20, 0], size: [120, 20, 4] }, // Zentrales Kreuz Z
                { pos: [0, 20, 0], size: [4, 20, 120] }, // Zentrales Kreuz X
            ],
            portals: [
                { a: [-50, 20, -50], b: [50, 20, 50], color: 0xffff00 },
                { a: [50, 20, -50], b: [-50, 20, 50], color: 0x00ffff }
            ]
        },
        checkerboard: {
            name: 'Schachbrett',
            size: [100, 40, 100],
            obstacles: [
                // Boden-Hindernisse
                { pos: [-25, 10, -25], size: [15, 20, 15] },
                { pos: [25, 10, 25], size: [15, 20, 15] },
                // Decken-Hindernisse
                { pos: [25, 30, -25], size: [15, 20, 15] },
                { pos: [-25, 30, 25], size: [15, 20, 15] }
            ],
            portals: []
        },
        the_pit: {
            name: 'Die Arena',
            size: [120, 30, 120],
            obstacles: [
                { pos: [0, 4, 0], size: [40, 8, 40], kind: 'foam' } // Zentrales Bouncing Pad
            ],
            portals: [
                { a: [-55, 15, 0], b: [55, 15, 0], color: 0xff0000 },
                { a: [0, 15, -55], b: [0, 15, 55], color: 0x0000ff }
            ]
        },
        core_fusion: {
            name: 'Kern-Fusion',
            size: [100, 40, 100],
            obstacles: [
                { pos: [0, 20, 0], size: [50, 20, 50], kind: 'foam' } // Riesiger Schaumkern
            ],
            portals: [
                { a: [-45, 10, -45], b: [45, 30, 45], color: 0x00ff00 },
                { a: [45, 10, -45], b: [-45, 30, 45], color: 0xff8800 }
            ]
        },
        pillar_hall: {
            name: 'Saeulen-Halle',
            size: [100, 30, 100],
            obstacles: [
                { pos: [-30, 15, -30], size: [4, 30, 4] }, { pos: [-30, 15, 0], size: [4, 30, 4] }, { pos: [-30, 15, 30], size: [4, 30, 4] },
                { pos: [0, 15, -30], size: [4, 30, 4] }, { pos: [0, 15, 0], size: [4, 30, 4] }, { pos: [0, 15, 30], size: [4, 30, 4] },
                { pos: [30, 15, -30], size: [4, 30, 4] }, { pos: [30, 15, 0], size: [4, 30, 4] }, { pos: [30, 15, 30], size: [4, 30, 4] }
            ],
            portals: []
        },
        spiral_tower: {
            name: 'Spiralen-Turm',
            size: [80, 70, 80],
            obstacles: [
                { pos: [0, 10, 20], size: [20, 4, 10] },
                { pos: [20, 25, 0], size: [10, 4, 20] },
                { pos: [0, 40, -20], size: [20, 4, 10] },
                { pos: [-20, 55, 0], size: [10, 4, 20] }
            ],
            portals: [
                { a: [0, 5, 0], b: [0, 65, 0], color: 0xffffff } // Vertikaler Lift
            ]
        },
        portal_madness: {
            name: 'Portal-Wahnsinn',
            size: [100, 40, 100],
            obstacles: [
                { pos: [0, 20, 0], size: [10, 10, 10] }
            ],
            portals: [
                { a: [-40, 10, 0], b: [40, 10, 0], color: 0xff0000 },
                { a: [0, 10, -40], b: [0, 10, 40], color: 0x00ff00 },
                { a: [-40, 30, 0], b: [40, 30, 0], color: 0x0000ff },
                { a: [0, 30, -40], b: [0, 30, 40], color: 0xffff00 },
                { a: [-30, 20, -30], b: [30, 20, 30], color: 0xff00ff },
                { a: [30, 20, -30], b: [-30, 20, 30], color: 0x00ffff }
            ]
        },
        the_loop: {
            name: 'Die Schleife',
            size: [120, 30, 120],
            obstacles: [
                // Innerer Block
                { pos: [0, 15, 0], size: [60, 30, 60] },
                // Äußere Ring-Elemente
                { pos: [0, 25, 55], size: [120, 10, 4] },
                { pos: [0, 25, -55], size: [120, 10, 4] },
                { pos: [55, 25, 0], size: [4, 10, 120] },
                { pos: [-55, 25, 0], size: [4, 10, 120] }
            ],
            portals: []
        },
        upgrade_showcase: {
            name: 'Upgrade Showcase',
            size: [100, 40, 100],
            obstacles: [
                { pos: [0, 2, 0], size: [20, 4, 20], kind: 'foam' }
            ],
            gates: [
                // Ein Boost-Portal in der Mitte
                {
                    type: 'boost',
                    pos: [0, 12, -20],
                    forward: [0, 0, -1],
                    params: { duration: 1.5, forwardImpulse: 45, bonusSpeed: 60 }
                },
                // Ein Slingshot-Gate
                {
                    type: 'slingshot',
                    pos: [20, 15, 0],
                    forward: [1, 0, 0],
                    up: [0, 1, 0],
                    params: { duration: 2.0, forwardImpulse: 30, liftImpulse: 8 }
                },
                // Ein weiteres Boost-Portal (Rückweg)
                {
                    type: 'boost',
                    pos: [0, 20, 20],
                    forward: [0, 0, 1],
                    params: { duration: 1.2, forwardImpulse: 40 }
                }
            ],
            portals: []
        },
        mega_maze: {
            name: 'Mega-Labyrinth',
            size: [100, 35, 100],
            obstacles: [
                // ========================================================
                // 5x5 Grid-Labyrinth mit alternierenden Boden/Decken-Wänden
                // Bodenwand: pos Y=12, H=24 → Y 0-24, Lücke oben (24-35)
                // Deckenwand: pos Y=23, H=24 → Y 11-35, Lücke unten (0-11)
                // Zellen: A(-40) B(-20) C(0) D(20) E(40)
                // Wandlinien: -30, -10, 10, 30
                // ========================================================

                // --- Horizontale Wände (E-W laufend, dünn in Z) ---

                // Z=-30 (Reihe 1→2)
                { pos: [-40, 12, -30], size: [20, 24, 3] },     // ↑ Boden: A1↔A2 blockiert
                { pos: [0, 23, -30], size: [20, 24, 3] },       // ↓ Decke: C1↔C2 blockiert
                { pos: [40, 12, -30], size: [20, 24, 3] },      // ↑ Boden: E1↔E2 blockiert

                // Z=-10 (Reihe 2→3)
                { pos: [-20, 23, -10], size: [20, 24, 3] },     // ↓ Decke: B2↔B3 blockiert
                { pos: [20, 12, -10], size: [20, 24, 3] },      // ↑ Boden: D2↔D3 blockiert

                // Z=10 (Reihe 3→4)
                { pos: [-40, 12, 10], size: [20, 24, 3] },      // ↑ Boden: A3↔A4 blockiert
                { pos: [0, 23, 10], size: [20, 24, 3] },        // ↓ Decke: C3↔C4 blockiert
                { pos: [20, 12, 10], size: [20, 24, 3] },       // ↑ Boden: D3↔D4 blockiert

                // Z=30 (Reihe 4→5)
                { pos: [-20, 23, 30], size: [20, 24, 3] },      // ↓ Decke: B4↔B5 blockiert
                { pos: [0, 12, 30], size: [20, 24, 3] },        // ↑ Boden: C4↔C5 blockiert

                // --- Vertikale Wände (N-S laufend, dünn in X) ---

                // X=-30 (Spalte A↔B)
                { pos: [-30, 23, -40], size: [3, 24, 20] },     // ↓ Decke: A1↔B1 blockiert
                { pos: [-30, 12, 0], size: [3, 24, 20] },       // ↑ Boden: A3↔B3 blockiert
                { pos: [-30, 23, 20], size: [3, 24, 20] },      // ↓ Decke: A4↔B4 blockiert

                // X=-10 (Spalte B↔C)
                { pos: [-10, 12, -20], size: [3, 24, 20] },     // ↑ Boden: B2↔C2 blockiert
                { pos: [-10, 23, 20], size: [3, 24, 20] },      // ↓ Decke: B4↔C4 blockiert
                { pos: [-10, 12, 40], size: [3, 24, 20] },      // ↑ Boden: B5↔C5 blockiert

                // X=10 (Spalte C↔D)
                { pos: [10, 23, -40], size: [3, 24, 20] },      // ↓ Decke: C1↔D1 blockiert
                { pos: [10, 12, 0], size: [3, 24, 20] },        // ↑ Boden: C3↔D3 blockiert

                // X=30 (Spalte D↔E)
                { pos: [30, 12, -20], size: [3, 24, 20] },      // ↑ Boden: D2↔E2 blockiert
                { pos: [30, 23, 0], size: [3, 24, 20] },        // ↓ Decke: D3↔E3 blockiert
                { pos: [30, 12, 30], size: [3, 24, 20] },       // ↑ Boden: D5↔E5 blockiert (Sackgasse)

                // --- Orientierungs-Pfeiler (Boden→Decke durchgehend) ---
                { pos: [-45, 17.5, -45], size: [3, 35, 3] },    // Ecke NW
                { pos: [45, 17.5, -45], size: [3, 35, 3] },     // Ecke NO
                { pos: [-45, 17.5, 45], size: [3, 35, 3] },     // Ecke SW
                { pos: [45, 17.5, 45], size: [3, 35, 3] },      // Ecke SO
            ],
            portals: [
                { a: [-40, 5, -40], b: [40, 30, 40], color: 0x00ffcc },    // NW unten → SO oben
                { a: [40, 5, -40], b: [-40, 30, 40], color: 0xff66ff },    // NO unten → SW oben
                { a: [-40, 30, 0], b: [40, 5, 0], color: 0xffaa00 },      // W oben → O unten
                { a: [0, 5, -40], b: [0, 30, 40], color: 0x44ff88 },      // N unten → S oben
            ]
        },
        ...GENERATED_LOCAL_MAPS,
    },

    // ---- Tastenbelegung ----
    KEYS: {
        PLAYER_1: {
            UP: 'KeyW',
            DOWN: 'KeyS',
            LEFT: 'KeyA',
            RIGHT: 'KeyD',
            ROLL_LEFT: 'KeyQ',
            ROLL_RIGHT: 'KeyE',
            BOOST: 'ShiftLeft',
            SHOOT: 'KeyF',
            NEXT_ITEM: 'KeyR',
            DROP: 'KeyG',
            CAMERA: 'KeyC',
        },
        PLAYER_2: {
            UP: 'ArrowUp',
            DOWN: 'ArrowDown',
            LEFT: 'ArrowLeft',
            RIGHT: 'ArrowRight',
            ROLL_LEFT: 'KeyN',
            ROLL_RIGHT: 'KeyM',
            BOOST: 'ShiftRight',
            SHOOT: 'KeyJ',
            NEXT_ITEM: 'KeyL',
            DROP: 'KeyH',
            CAMERA: 'KeyV',
        }
    }
};
