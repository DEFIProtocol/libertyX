# Token CRUD Operations Setup

## Architecture Overview

The token CRUD system is organized in three layers:

### 1. Backend (Server-Side) - PostgreSQL Routes
**File:** `server/routes/tokens.js`

CRUD endpoints already implemented:
- **POST** `/api/tokens` - Create new token
- **PUT** `/api/tokens/:symbol` - Update existing token
- **DELETE** `/api/tokens/:symbol` - Delete token
- **GET** `/api/tokens/:symbol` - Fetch single token
- **GET** `/api/tokens/db` - Fetch all tokens from database
- **GET** `/api/tokens/json` - Fetch all tokens from JSON file

### 2. Frontend Hook
**File:** `dex/src/hooks/useTokenCrud.js`

Custom React hook providing CRUD operations:
```javascript
import { useTokenCrud } from '../../hooks';

const { createToken, updateToken, deleteToken, getToken, loading, error, clearError } = useTokenCrud();
```

**Available Functions:**
- `createToken(tokenData)` - Create new token
- `updateToken(symbol, tokenData)` - Update token
- `deleteToken(symbol)` - Delete token
- `getToken(symbol)` - Fetch single token

All functions return:
```javascript
{
  success: boolean,
  data: object (on success) or undefined,
  error: string (on failure) or undefined,
  message: string (on success)
}
```

**Hook States:**
- `loading` - Boolean indicating API request in progress
- `error` - Current error message, if any
- `clearError()` - Function to clear error state

### 3. Components Using the Hook
**File:** `dex/src/components/Admin/AdminTokenManager.jsx`

Two modals implement CRUD operations:

#### EditTokenModal
- Uses `updateToken()` from the hook
- Sends only name, price, market_cap, volume_24h (symbol is read-only)
- Shows loading, success, and error states
- Auto-refreshes on success

#### AddTokenModal
- Uses `createToken()` from the hook
- Requires symbol and name fields
- Defaults: decimals='18', type='ERC-20'
- Shows loading, success, and error states
- Auto-refreshes on success

## Usage Example

```javascript
import { useTokenCrud } from '../../hooks';

function MyComponent() {
    const { createToken, updateToken, loading, error } = useTokenCrud();
    
    // Add token
    const handleAddToken = async () => {
        const result = await createToken({
            symbol: 'BTC',
            name: 'Bitcoin',
            price: '45000',
            market_cap: '880000000000',
            volume_24h: '28000000000',
            decimals: '8',
            type: 'Native'
        });
        
        if (result.success) {
            console.log('Token created:', result.data);
        } else {
            console.error('Failed:', result.error);
        }
    };
    
    // Update token
    const handleUpdateToken = async () => {
        const result = await updateToken('BTC', {
            name: 'Bitcoin Updated',
            price: '46000'
        });
        
        if (result.success) {
            console.log('Token updated:', result.data);
        }
    };
    
    return (
        <>
            {loading && <p>Loading...</p>}
            {error && <p>Error: {error}</p>}
            <button onClick={handleAddToken}>Add Token</button>
            <button onClick={handleUpdateToken}>Update Token</button>
        </>
    );
}
```

## Data Flow Diagram

```
Frontend User Input
        ↓
EditTokenModal / AddTokenModal
        ↓
useTokenCrud hook
        ↓
axios HTTP request
        ↓
Backend Express Routes (tokens.js)
        ↓
PostgreSQL Database
        ↓
Response back to Modal
        ↓
Success/Error UI Update
```

## Error Handling

Both modals handle errors gracefully:

**Success Response:**
- Shows checkmark (✅)
- Displays success message
- Auto-closes after 1.5 seconds
- Triggers page reload to show updated data

**Error Response:**
- Shows error state
- Displays error message
- Remains open for 3 seconds
- User can retry or cancel

## Database Fields

Tokens are stored in PostgreSQL with these fields:
- `symbol` (PRIMARY KEY, VARCHAR) - Unique token symbol
- `name` (VARCHAR) - Token name
- `price` (NUMERIC) - Current price
- `market_cap` (NUMERIC) - Market capitalization
- `volume_24h` (NUMERIC) - 24-hour trading volume
- `decimals` (INTEGER) - Token decimals
- `type` (VARCHAR) - Token type (e.g., ERC-20)
- `created_at` (TIMESTAMP) - Creation timestamp
- `updated_at` (TIMESTAMP) - Last update timestamp

## Integration with Existing Components

The CRUD operations are integrated into:

1. **AdminTokenManager** - Main admin component showing token list
2. **EditTokenModal** - Triggered by Edit button on each token
3. **AddTokenModal** - Triggered by "Add Token" button in header

Both modals use the same `useTokenCrud` hook and follow the same success/error patterns.

## Future Improvements

- Add optimistic UI updates (update UI before API response)
- Implement batch operations (bulk add/update/delete)
- Add undo/redo functionality
- Add token validation before submission
- Cache token data locally to reduce API calls
- Add confirmation dialogs for destructive operations (delete)
