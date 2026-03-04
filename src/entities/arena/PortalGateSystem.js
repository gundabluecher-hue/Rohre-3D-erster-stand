import { PortalLayoutBuilder } from './portal/PortalLayoutBuilder.js';
import { PortalRuntimeSystem } from './portal/PortalRuntimeSystem.js';
import { SpecialGateRuntime } from './portal/SpecialGateRuntime.js';

export class PortalGateSystem {
    constructor(arena) {
        this.arena = arena;
        this.layoutBuilder = new PortalLayoutBuilder(arena);
        this.portalRuntime = new PortalRuntimeSystem(arena);
        this.specialGateRuntime = new SpecialGateRuntime(arena);
    }

    build(map, scale) {
        this.layoutBuilder.build(map, scale);
    }

    checkPortal(position, radius, entityId) {
        return this.portalRuntime.checkPortal(position, radius, entityId);
    }

    checkSpecialGates(position, previousPosition, radius, entityId) {
        return this.specialGateRuntime.checkSpecialGates(position, previousPosition, radius, entityId);
    }

    getPortalLevelsFallback() {
        return this.layoutBuilder.getPortalLevelsFallback();
    }

    getPortalLevels() {
        return this.layoutBuilder.getPortalLevels();
    }

    update(dt) {
        this.portalRuntime.update(dt);
        this.specialGateRuntime.update(dt);
    }
}
