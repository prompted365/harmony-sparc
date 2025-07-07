# Quick Wins Action Plan for Error Resolution

## 🎯 Immediate Fixes (9 errors in 15 minutes)

### 1. Fix api/index.ts imports (7 errors)
**File**: `api/index.ts`
**Action**: Add these imports at the top:
```typescript
import { config } from './config';
import { Server } from './server';
```

### 2. Fix typo in api/server.ts (1 error)
**File**: `api/server.ts` line 141
**Action**: Change `listening` to `listen`
```typescript
// Change from: app.listening
// To: app.listen
```

### 3. Fix parseGwei import (1 error)
**File**: `core/finance/payment/processors/multi-token-processor.ts` line 7
**Action**: Update import to use parseUnits
```typescript
// Change from: import { parseGwei } from 'ethers';
// To: import { parseUnits } from 'ethers';
// Then replace parseGwei(value) with parseUnits(value, 'gwei')
```

## 📊 Next Priority Fixes (19 errors in 30 minutes)

### 4. Property Initializers (9 errors)
**Files**:
- `core/finance/fees/fee-distributor.ts` (lines 69-70)
- `core/finance/fees/fee-engine.ts` (lines 69-70)
- `core/finance/payment/api/payment-routes.ts` (lines 59-62)

**Action**: Add initializers or definite assignment assertion
```typescript
// Option 1: Initialize in constructor
this.property = defaultValue;

// Option 2: Definite assignment assertion
private property!: Type;
```

### 5. Type Assignment Fixes (10 errors)
**Key Files**:
- `adapters/qudag/examples/` - Add missing properties to ResourceOrder
- `core/finance/fees/fee-engine.test.ts` - Add missing properties to PaymentRequest

## 🔧 Complex Fixes (29 errors in 45 minutes)

### 6. Export Conflicts in index.ts (8 errors)
**Strategy**: Use namespace imports or explicit re-exports
```typescript
// Instead of: export * from './module';
// Use: export { SpecificExport as ModuleSpecificExport } from './module';
```

### 7. Contract Interface Updates (5 errors)
**File**: `core/finance/payment/escrow/escrow-contract.ts`
**Action**: Update contract type definitions or use type assertions

### 8. Remaining Type Issues (16 errors)
- Status type mismatches
- Null checks for signatures
- Index type errors

## 🚀 Recommended Execution Order

1. **Agent 1**: Handle Quick Wins (api/index.ts, server.ts, parseGwei)
2. **Agent 2**: Fix Property Initializers
3. **Agent 3**: Fix Type Assignments
4. **Agent 4**: Resolve Export Conflicts
5. **Agent 5**: Handle Contract & Complex Types

This approach allows parallel execution while minimizing conflicts.