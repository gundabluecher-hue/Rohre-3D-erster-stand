// ============================================
// Config.js - Zentrale Spielkonfiguration
// ============================================

import { CONFIG_SECTIONS } from './config/ConfigSections.js';
import { MAP_PRESETS } from './config/MapPresets.js';

export const CONFIG = {
    ...CONFIG_SECTIONS,
    MAPS: MAP_PRESETS,
};
