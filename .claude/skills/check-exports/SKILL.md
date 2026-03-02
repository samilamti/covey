---
name: check-exports
description: Verify cross-module imports match actual exports in the backend. Use after wiring changes, adding new imports, or renaming functions.
argument-hint: "[file path]"
---

Verify cross-module imports match actual exports. This addresses the project's #1 documented pain point: function name mismatches between modules that cause runtime errors but not import-time errors.

### If a specific file is given in `$ARGUMENTS`:
1. Read the file
2. Find all `import { ... } from '...'` statements
3. For each imported module (relative paths only, skip node_modules):
   - Read the target file
   - List its `export function`, `export const`, `export default` declarations
   - Compare imported names against actual exports
   - Flag any mismatches

### If no file is given:
Scan all `.js` and `.jsx` files in `backend/src/` (including subdirectories). For each file:
1. Find all named imports: `import { foo, bar } from './module'`
2. Find all namespace imports: `import * as name from './module'` — then check property accesses like `name.foo()` against the module's exports
3. Resolve the target module path
4. Verify each imported name exists as an export in the target
5. Report mismatches

### Common mismatch patterns to check
- **Function renames**: e.g., module exports `processLocationUpdate()` but consumer imports `relayLocation()`
- **Missing named imports**: `import { findById } from './repo'` when repo only exports `findByUserId`
- **Namespace property access**: `import * as repo from './repo'` then calling `repo.getById()` when repo exports `findById()`

### Output
List any mismatches found:
```
MISMATCH: backend/src/handlers.js
  imports { relayLocation } from ./services/geolocation.js
  but geolocation.js exports: processLocationUpdate, validateCoordinates
```

If no mismatches: report "All cross-module imports verified."

## Notes
- Backend uses ES modules (`import`/`export`), NOT CommonJS
- Frontend also uses ES modules — can be checked too but less critical since Vite catches these at build time
- Focus on backend where Node.js only fails at runtime when the import is first used
- Namespace imports (`import * as repo`) need their property accesses checked too
