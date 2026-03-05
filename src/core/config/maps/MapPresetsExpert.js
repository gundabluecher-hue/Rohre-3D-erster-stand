import { MAP_PRESET_CATALOG } from './MapPresetCatalog.js';

const EXPERT_MAP_KEYS = ['mega_maze', 'mega_maze_xl'];

export const MAP_PRESETS_EXPERT = Object.freeze(
    EXPERT_MAP_KEYS.reduce((result, key) => {
        if (MAP_PRESET_CATALOG[key]) {
            result[key] = MAP_PRESET_CATALOG[key];
        }
        return result;
    }, {})
);

