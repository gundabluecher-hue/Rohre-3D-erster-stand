import { CONFIG } from '../../core/Config.js';
import { VEHICLE_DEFINITIONS } from '../../entities/vehicle-registry.js';

function normalizeString(value, fallback = '') {
    const normalized = typeof value === 'string' ? value.trim() : '';
    return normalized || fallback;
}

function toNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

export function resolveMapCategory(mapDefinition) {
    const size = Array.isArray(mapDefinition?.size) ? mapDefinition.size : [];
    const width = toNumber(size[0], 80);
    const depth = toNumber(size[2], 80);
    const footprint = width * depth;
    if (footprint < 5000) return 'small';
    if (footprint > 10000) return 'large';
    return 'medium';
}

export function resolveVehicleCategory(vehicleDefinition) {
    const radius = toNumber(vehicleDefinition?.hitbox?.radius, 1.1);
    if (radius <= 1.0) return 'light';
    if (radius >= 1.35) return 'heavy';
    return 'medium';
}

export function listMapPreviewEntries() {
    return Object.entries(CONFIG?.MAPS || {}).map(([mapKey, mapDefinition]) => {
        const size = Array.isArray(mapDefinition?.size) ? mapDefinition.size : [80, 30, 80];
        const obstacles = Array.isArray(mapDefinition?.obstacles) ? mapDefinition.obstacles.length : 0;
        const portals = Array.isArray(mapDefinition?.portals) ? mapDefinition.portals.length : 0;
        return {
            key: mapKey,
            name: normalizeString(mapDefinition?.name, mapKey),
            sizeText: `${toNumber(size[0], 80)} x ${toNumber(size[1], 30)} x ${toNumber(size[2], 80)}`,
            obstacleCount: obstacles,
            portalCount: portals,
            category: resolveMapCategory(mapDefinition),
        };
    });
}

export function resolveMapPreview(mapKey) {
    const normalizedMapKey = normalizeString(mapKey, 'standard');
    const entry = listMapPreviewEntries().find((candidate) => candidate.key === normalizedMapKey);
    if (entry) return entry;
    return {
        key: normalizedMapKey,
        name: normalizedMapKey,
        sizeText: 'n/a',
        obstacleCount: 0,
        portalCount: 0,
        category: 'medium',
    };
}

export function listVehiclePreviewEntries() {
    return VEHICLE_DEFINITIONS.map((vehicle) => ({
        id: normalizeString(vehicle?.id),
        label: normalizeString(vehicle?.label, vehicle?.id || 'Vehicle'),
        hitboxRadius: toNumber(vehicle?.hitbox?.radius, 1.1),
        category: resolveVehicleCategory(vehicle),
    }));
}

export function resolveVehiclePreview(vehicleId) {
    const normalizedVehicleId = normalizeString(vehicleId);
    const vehicle = listVehiclePreviewEntries().find((candidate) => candidate.id === normalizedVehicleId);
    if (vehicle) return vehicle;
    return {
        id: normalizedVehicleId,
        label: normalizedVehicleId || 'Vehicle',
        hitboxRadius: 1.1,
        category: 'medium',
    };
}

