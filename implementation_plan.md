## Phase 12 Block A (12.1-12.6)

### Goals
- Split `Config.js` into map presets and composable config sections without API changes.
- Split `PortalGateSystem` into mesh factory and placement/resolver ops modules.
- Split `EditorMapManager` into serializer and mesh/registry helper modules while preserving behavior.

### File-Level Scope
- `src/core/Config.js`
- `src/core/config/MapPresets.js` (new)
- `src/core/config/ConfigSections.js` (new)
- `src/entities/arena/PortalGateSystem.js`
- `src/entities/arena/PortalGateMeshFactory.js` (new)
- `src/entities/arena/PortalPlacementOps.js` (new)
- `editor/js/EditorMapManager.js`
- `editor/js/EditorMapSerializer.js` (new)
- `editor/js/EditorMeshFactory.js` (new)
- `editor/js/EditorObjectRegistry.js` (new)
- `docs/Umsetzungsplan.md`

### Risk
- Medium: refactor touches core/editor wiring and method binding.

### Verification
- After 12.2: `npm run test:core`, `npm run test:physics`, `npm run docs:sync`, `npm run docs:check`
- After 12.4: `npm run test:core`, `npm run test:physics`, `npm run smoke:selftrail`, `npm run docs:sync`, `npm run docs:check`
- After 12.6: `npm run test:core`, `npm run test:physics`, `npm run docs:sync`, `npm run docs:check`
