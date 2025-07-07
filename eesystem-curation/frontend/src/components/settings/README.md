# EESystem Settings UI Components

A comprehensive settings management system for the EESystem Content Curation Platform.

## Overview

The Settings UI provides a complete configuration interface for managing:

- **General Settings** - Application configuration and preferences
- **Database Settings** - AstraDB, PostgreSQL, and MongoDB configuration
- **API Key Settings** - LLM router, OpenAI, Anthropic, and other API configurations
- **Deployment Settings** - Railway, Vercel, and other deployment platform configurations
- **Environment Variables** - Comprehensive environment variable management

## Features

### 🎯 Core Features

- **Tabbed Interface** - Organized settings across different categories
- **Real-time Validation** - Comprehensive validation with error and warning feedback
- **Connection Testing** - Test database and API connections
- **Environment Variable Management** - Advanced environment variable management with filtering and grouping
- **Import/Export** - Settings export and import functionality
- **Auto-save** - Optional auto-save with configurable delays
- **Theme Support** - EESystem branding with dark/light theme support

### 🔧 Technical Features

- **TypeScript** - Fully typed with comprehensive interfaces
- **React Hooks** - Custom hooks for settings management and validation
- **Form Validation** - Real-time validation with detailed error messages
- **Responsive Design** - Mobile-friendly responsive layout
- **Accessibility** - ARIA compliant for screen readers
- **Performance** - Optimized rendering with useMemo and useCallback

## Components

### Main Components

#### `Settings.tsx`
The main settings page component with tabbed interface.

```tsx
import { Settings } from './components/settings'

function App() {
  return <Settings />
}
```

#### `GeneralSettings.tsx`
Application-wide settings and preferences.

**Features:**
- Application name and description
- Environment selection (development/staging/production)
- Debug mode and logging configuration
- File upload settings
- Theme and localization settings

#### `DatabaseSettings.tsx`
Database configuration and connection management.

**Features:**
- Multi-provider support (AstraDB, PostgreSQL, MongoDB)
- Connection testing with real-time status
- Performance metrics display
- Connection pool configuration
- Query logging and monitoring settings

#### `ApiKeySettings.tsx`
API key and service configuration.

**Features:**
- LLM Router configuration (Requesty.ai, OpenRouter, Together AI)
- OpenAI API configuration with model parameters
- Anthropic Claude configuration
- Additional services (ElevenLabs, Stability AI, Vercel)
- Rate limiting configuration
- Usage tracking and billing information

#### `DeploymentSettings.tsx`
Deployment platform configuration.

**Features:**
- Multi-platform support (Railway, Vercel, Netlify, AWS, GCP, Azure)
- Build settings configuration
- Environment variable management
- Deployment status monitoring
- Resource usage metrics

#### `EnvironmentVariableManager.tsx`
Comprehensive environment variable management.

**Features:**
- Variable filtering and search
- Category grouping
- Secret value masking
- Import/export functionality
- Bulk operations
- Validation and duplicate detection

### Utility Components

#### UI Components
- `Select` - Custom select component with Radix UI
- `Switch` - Toggle switch component
- `Tabs` - Tabbed interface component
- `Alert` - Alert and notification component
- `Label` - Form label component
- `Separator` - Visual separator component

### Custom Hooks

#### `useSettings.ts`
Main settings management hook.

**Features:**
- Settings state management
- Auto-save functionality
- Import/export operations
- Connection testing
- Validation integration

```tsx
const {
  settings,
  updateSettings,
  saveSettings,
  validationResult,
  isLoading,
  hasUnsavedChanges
} = useSettings({
  autoSave: true,
  autoSaveDelay: 2000,
  enableValidation: true
})
```

#### `useSettingsValidation.ts`
Comprehensive validation system.

**Features:**
- Real-time validation
- Field-level error tracking
- Warning and error categorization
- Validation summaries

```tsx
const {
  validationResult,
  getFieldErrors,
  hasFieldErrors,
  getValidationSummary
} = useSettingsValidation(settings)
```

## Types and Interfaces

### Core Types

#### `SettingsConfig`
Main settings configuration interface containing all settings sections.

#### `EnvironmentVariable`
Environment variable definition with validation rules.

#### `ValidationResult`
Validation result with errors and warnings.

#### `ConnectionTestResult`
Database and API connection test results.

### Provider-Specific Types

#### `AstraDbConfig`
DataStax AstraDB configuration and status.

#### `RequestyConfig`
Requesty.ai LLM router configuration.

#### `RailwayConfig`
Railway deployment platform configuration.

## Usage Examples

### Basic Settings Page

```tsx
import { Settings } from './components/settings'

function SettingsPage() {
  return (
    <div className="container mx-auto py-6">
      <Settings />
    </div>
  )
}
```

### Custom Settings Hook Usage

```tsx
import { useSettings } from './hooks/useSettings'

function CustomSettingsComponent() {
  const {
    settings,
    updateSection,
    saveSettings,
    validationResult,
    hasUnsavedChanges
  } = useSettings({
    autoSave: true,
    enableValidation: true
  })

  const handleDatabaseUpdate = (dbConfig: Partial<DatabaseSettings>) => {
    updateSection('database', dbConfig)
  }

  return (
    <div>
      {hasUnsavedChanges && (
        <div className="alert">Unsaved changes detected</div>
      )}
      {/* Settings form */}
    </div>
  )
}
```

### Environment Variable Management

```tsx
import { EnvironmentVariableManager } from './components/settings'

function EnvVarPage() {
  const [variables, setVariables] = useState<EnvironmentVariable[]>([])

  return (
    <EnvironmentVariableManager
      variables={variables}
      onChange={setVariables}
    />
  )
}
```

## Styling and Theming

### EESystem Branding

The settings UI uses the EESystem brand colors:
- Primary: `#43FAFF` (Cyan)
- Secondary: `#2DD4D9` (Darker Cyan)

### CSS Classes

- `.brand-gradient` - EESystem gradient background
- `.brand-text` - EESystem gradient text
- `.glass-effect` - Glass morphism effect

### Dark/Light Theme

Theme switching is handled automatically based on user preferences:

```css
:root {
  --primary: 191 100% 63%; /* #43FAFF */
}

.dark {
  --primary: 191 100% 63%; /* Same primary in dark mode */
}
```

## Validation Rules

### General Settings
- App name: Required, max 100 characters
- Max upload size: Must be > 0, warning if > 100MB
- File types: Warning if empty

### Database Settings
- AstraDB endpoint: Required, must be valid URL
- Application token: Required, should start with "AstraCS:"
- Connection pool: 1-100 connections
- Timeouts: 1s-5min recommended

### API Keys
- OpenAI: Should start with "sk-"
- Anthropic: Should start with "sk-ant-"
- Temperature: 0-2 range
- Max tokens: 1-128000 range
- Rate limits: Logical consistency checks

### Environment Variables
- Key format: Letters, numbers, underscores only
- No duplicate keys
- Required variables cannot be empty

## Security Features

### Secret Management
- Password-style inputs for secrets
- Show/hide toggle for sensitive values
- Copy to clipboard functionality
- Export excludes sensitive data by default

### Validation
- Real-time validation prevents invalid configurations
- Connection testing before saving
- Format validation for API keys and URLs

## Accessibility

### ARIA Support
- Proper labeling for all form elements
- Screen reader friendly validation messages
- Keyboard navigation support
- Focus management

### Responsive Design
- Mobile-first responsive layout
- Touch-friendly interface elements
- Collapsible sections on small screens

## Performance Optimizations

### React Optimizations
- `useMemo` for expensive calculations
- `useCallback` for event handlers
- Debounced auto-save
- Lazy loading for large settings sections

### Bundle Optimization
- Tree-shakeable exports
- Minimal external dependencies
- Code splitting ready

## Testing

### Unit Tests
```bash
npm test -- --testPathPattern=settings
```

### Integration Tests
```bash
npm run test:integration -- settings
```

### E2E Tests
```bash
npm run test:e2e -- --grep="settings"
```

## Contributing

### Adding New Settings

1. **Define Types** - Add interfaces in `types/settings.ts`
2. **Create Component** - Build the settings component
3. **Add Validation** - Update validation hook
4. **Update Main Component** - Add to tabbed interface
5. **Write Tests** - Add comprehensive tests

### Code Style

- Use TypeScript for all new code
- Follow existing naming conventions
- Add JSDoc comments for public APIs
- Use consistent error handling patterns

## Troubleshooting

### Common Issues

#### Settings Not Saving
- Check validation errors
- Verify localStorage permissions
- Check network connectivity for API saves

#### Connection Tests Failing
- Verify API credentials
- Check network connectivity
- Review CORS settings for browser requests

#### Validation Errors
- Check required fields
- Verify format requirements
- Review logical consistency rules

### Debug Mode

Enable debug mode in General Settings to see:
- Detailed validation logs
- Connection test details
- State change tracking
- Performance metrics

## API Reference

### Settings Hook

```typescript
interface UseSettingsReturn {
  settings: SettingsConfig
  updateSettings: (updates: Partial<SettingsConfig>) => void
  updateSection: <K extends keyof SettingsConfig>(section: K, data: Partial<SettingsConfig[K]>) => void
  saveSettings: () => Promise<void>
  loadSettings: () => Promise<void>
  resetSettings: () => void
  exportSettings: () => SettingsExport
  importSettings: (data: SettingsExport) => ImportResult
  testConnection: (provider: string, config: any) => Promise<ConnectionTestResult>
  isLoading: boolean
  isSaving: boolean
  hasUnsavedChanges: boolean
  lastSaved: Date | null
  validationResult: ValidationResult
  error: string | null
}
```

### Validation Hook

```typescript
interface UseSettingsValidationReturn {
  validationResult: ValidationResult
  validateField: (fieldPath: string, value: any) => ValidationResult
  getFieldErrors: (fieldPath: string) => ValidationError[]
  getFieldWarnings: (fieldPath: string) => ValidationWarning[]
  hasFieldErrors: (fieldPath: string) => boolean
  hasFieldWarnings: (fieldPath: string) => boolean
  getValidationSummary: () => ValidationSummary
  validateSettings: () => void
}
```

## License

This settings system is part of the EESystem Content Curation Platform and follows the same license terms.