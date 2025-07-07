# EESystem Content Curation Platform - Frontend

A modern React frontend for the EESystem Content Curation Platform, built with TypeScript, Vite, TailwindCSS, and shadcn/ui components.

## 🚀 Features

### Core UI Components
- **Dashboard**: Content overview, analytics, and real-time monitoring
- **Document Upload**: Drag-and-drop file upload with processing status
- **Content Generator**: AI-powered content generation with agent controls
- **Publication Calendar**: Interactive scheduling and content planning
- **Analytics**: Performance visualization and metrics tracking
- **Brand Management**: Brand profile and style customization
- **Real-time Updates**: WebSocket integration for live notifications

### Technical Features
- **Responsive Design**: Mobile-first, fully responsive interface
- **Dark/Light Mode**: System-aware theme switching
- **Real-time Communication**: WebSocket integration for live updates
- **File Upload**: Drag-and-drop with progress tracking
- **Type Safety**: Full TypeScript implementation
- **Modern UI**: shadcn/ui components with TailwindCSS
- **Performance**: Optimized with React 19 and Vite

## 🛠️ Tech Stack

- **React 19** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **TailwindCSS** - Utility-first CSS framework
- **Radix UI** - Headless UI components
- **Recharts** - Data visualization
- **React Router** - Client-side routing
- **Axios** - HTTP client
- **React Dropzone** - File upload
- **Date-fns** - Date manipulation
- **Lucide React** - Icons

## 📦 Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 🏗️ Project Structure

```
src/
├── components/           # React components
│   ├── ui/              # Base UI components (Button, Card, etc.)
│   ├── dashboard/       # Dashboard components
│   ├── upload/          # File upload components
│   ├── content/         # Content generation components
│   ├── calendar/        # Calendar and scheduling
│   ├── analytics/       # Charts and metrics
│   ├── notifications/   # Notification system
│   └── layout/          # Layout components
├── contexts/            # React contexts
│   ├── AuthContext.tsx  # Authentication state
│   └── WebSocketContext.tsx # Real-time updates
├── hooks/               # Custom React hooks
│   ├── useTheme.ts      # Theme management
│   ├── useFileUpload.ts # File upload logic
│   └── useContentGeneration.ts # Content generation
├── services/            # API and external services
│   ├── api.ts           # REST API client
│   └── websocket.ts     # WebSocket service
├── types/               # TypeScript type definitions
├── lib/                 # Utility functions
└── globals.css          # Global styles and CSS variables
```

## 🎨 Design System

### Colors
- **Primary**: #43FAFF (EESystem brand color)
- **Secondary**: #2DD4D9
- **Brand Gradient**: Linear gradient from #43FAFF to #2DD4D9

### Components
- Built with shadcn/ui for consistency
- Fully accessible with Radix UI primitives
- Responsive design patterns
- Dark mode support

## 🔧 Configuration

### Environment Variables
Copy `.env.example` to `.env` and configure:

```env
VITE_API_URL=http://localhost:3000/api
VITE_WS_URL=ws://localhost:3001
VITE_APP_NAME="EESystem Content Curation Platform"
```

This frontend provides a complete, production-ready interface for the EESystem Content Curation Platform with modern UX patterns and real-time capabilities.