# Personal OKRs

A Progressive Web App (PWA) for tracking and managing personal Objectives and Key Results (OKRs).

## Features

- **Dashboard**: Overview of your current OKRs and progress
- **Check-in**: Regular progress tracking for your objectives
- **Coach**: AI-powered coaching assistance (powered by Claude API)
- **History**: Review past check-ins and progress over time
- **Settings**: Customize your experience

## Tech Stack

- **React** - UI library
- **TypeScript** - Type safety
- **Vite** - Fast build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **React Router** - Client-side routing
- **Lucide React** - Icon library
- **date-fns** - Date manipulation
- **@anthropic-ai/sdk** - Claude API integration

## Project Structure

```
src/
├── components/     # Reusable UI components
├── pages/          # Main application pages
├── hooks/          # Custom React hooks
├── utils/          # Helper functions
├── types/          # TypeScript interfaces
├── services/       # API and storage services
├── context/        # Global state management
└── lib/            # Theme configuration and constants
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

### Development

Run the development server:

```bash
npm run dev
```

The app will be available at [http://localhost:5173](http://localhost:5173)

### Build

Build for production:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## PWA Features

This app is configured as a Progressive Web App with:
- Installable on mobile and desktop
- Offline capability (when service worker is implemented)
- Responsive design with mobile-first approach
- App-like navigation (bottom tabs on mobile, sidebar on desktop)

## Dark Mode

The app supports dark mode with class-based toggling. The theme can be controlled through the Settings page.

## License

MIT
