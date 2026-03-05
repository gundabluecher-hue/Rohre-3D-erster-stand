import { MAP_PRESET_CATALOG } from './MapPresetCatalog.js';

const BASE_MAP_KEYS = [
    'standard',
    'custom',
    'empty',
    'maze',
    'complex',
    'pyramid',
    'vertical_maze',
    'trench',
    'foam_forest',
    'crossfire',
    'checkerboard',
    'the_pit',
    'core_fusion',
    'pillar_hall',
    'spiral_tower',
    'portal_madness',
    'the_loop',
    'upgrade_showcase',
];

export const MAP_PRESETS_BASE = Object.freeze(
    BASE_MAP_KEYS.reduce((result, key) => {
        if (MAP_PRESET_CATALOG[key]) {
            result[key] = MAP_PRESET_CATALOG[key];
        }
        return result;
    }, {})
);

