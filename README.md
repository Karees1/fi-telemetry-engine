# 🏁 F1 Telemetry Dashboard

**A futuristic, precision-driven F1 pit lane experience built for engineers who appreciate craft.**

---

## 🎯 Vision

This is not just a data visualization tool. It's a **crafted experience** that respects both the technical complexity of F1 and the engineer's appreciation for intentional design.

- **Dark + Neon Aesthetic**: Red (#EF1E24) and Cyan (#00D9FF) on deep black (#0A0E27)
- **Futuristic Typography**: Space Grotesk for display, Roboto Mono for data
- **Glassmorphism UI**: Frosted glass panels with subtle blur effects
- **Real-time & Historical**: Switch between live race data and past race analysis
- **Multiple 3D Visualizations**: Track paths, car models, telemetry curves, tire temps

---

## 🏗️ Architecture

```
f1-telemetry-app/
├── app/                          # Next.js frontend (React)
│   ├── components/
│   │   ├── Track3D/             # Three.js 3D track visualization
│   │   ├── Telemetry/           # Data panels for metrics
│   │   ├── Controls/            # Race picker, toggles, timeline
│   │   └── Layout/              # Layout wrapper
│   ├── api/                      # Next.js API routes
│   │   ├── races/               # GET list of races
│   │   ├── sessions/            # GET session data
│   │   └── telemetry/           # GET telemetry for a lap
│   ├── hooks/                   # React hooks (data fetching, state)
│   ├── layout.tsx               # Root layout with theme setup
│   ├── page.tsx                 # Main dashboard page
│   └── globals.css              # Global styles + design tokens
│
├── services/python/
│   ├── fastf1_service.py        # FastF1 API wrapper + data processing
│   ├── cache_manager.py         # Smart caching for 5GB data limit
│   └── data_worker.py           # Async data processing (optional)
│
├── lib/                          # Shared utilities
│   ├── api-client.ts            # Frontend API client
│   └── three-helpers.ts         # Three.js utilities
│
├── types/
│   └── index.ts                 # TypeScript types & interfaces
│
├── design-tokens.ts             # Design system (colors, fonts, spacing)
├── tsconfig.json                # TypeScript config
├── next.config.js               # Next.js config
├── package.json                 # Dependencies
└── README.md                    # This file
```

---

## 🎨 Design Direction

### Colors
- **Primary Red**: #EF1E24 (Ferrari/F1 standard)
- **Primary Cyan**: #00D9FF (Electric, futuristic)
- **Background**: #0A0E27 (Deep space black)
- **Accents**: Hot pink (#FF006E), Neon green (#06FFA5)

### Typography
- **Display**: Space Grotesk (bold, technical, geometric)
- **Body**: Roboto Mono (clean, monospace, readable)
- **Spacing**: Systematic scale (4px, 8px, 12px, 16px, 24px...)

### Components
All UI elements use **glassmorphism**:
- Semi-transparent backgrounds (rgba with 0.8 opacity)
- Backdrop blur (10px)
- Cyan border accents (0.2 opacity)
- Glow effects on hover

---

## 📊 Data Flow

### Frontend → Backend
1. User selects a race from the welcome screen
2. Frontend requests `/api/races` → Next.js API route
3. API route calls Python FastF1 service
4. Python fetches data from FastF1 API (cached locally)
5. Returns JSON data to frontend
6. React renders 3D visualization + telemetry panels

### Real-time vs Historical
- **Historical (Current)**: Fetch past race data via API calls
- **Real-time (Future)**: WebSocket connection during live F1 events

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Python 3.10+ (for FastF1 service)
- Vercel account (for deployment)

### Installation

```bash
# Clone the repo
git clone <repo-url>
cd f1-telemetry-app

# Install dependencies
npm install

# Install Python dependencies (optional, for local service)
pip install fastf1 numpy pandas matplotlib

# Run development server
npm run dev

# In another terminal, run Python service (optional)
python -m services.fastf1_service
```

Visit `http://localhost:3000`

---

## 🎬 Features (Roadmap)

### Phase 1: Core Dashboard
- [x] Welcome screen with race selection
- [ ] 3D track visualization (Three.js)
- [ ] Telemetry data panels (speed, throttle, brake, gear)
- [ ] Timeline scrubber for lap replay
- [ ] View toggle: "All metrics" vs "Single metric" focus
- [ ] FastF1 data integration

### Phase 2: Advanced Visualization
- [ ] 3D car model animation
- [ ] Tire temperature heatmap
- [ ] G-force vectors
- [ ] Brake pressure visualization
- [ ] Multiple driver comparison

### Phase 3: Real-time & Polish
- [ ] WebSocket for live race streaming
- [ ] Custom animations & micro-interactions
- [ ] Performance optimization (60fps target)
- [ ] Mobile responsiveness
- [ ] Dark theme + optional light theme

---

## 📦 Dependencies

**Frontend**:
- `next` - React framework
- `react-three/fiber` - React wrapper for Three.js
- `zustand` - State management
- `framer-motion` - Animations
- `axios` - HTTP client

**Backend (Python)**:
- `fastf1` - F1 API wrapper
- `numpy` - Data processing
- `pandas` - Data manipulation

---

## 🔐 Deployment

### Vercel (Recommended)

```bash
# Push to GitHub
git push origin main

# Deploy via Vercel dashboard or CLI
vercel deploy
```

Environment variables:
- `NEXT_PUBLIC_API_BASE` - Next.js API base URL
- `NEXT_PUBLIC_PYTHON_SERVICE` - Python service URL (if separate)

### Self-hosted
Deploy Next.js frontend to any Node.js host. Python service can run on same or separate machine.

---

## 💡 Design Philosophy

This project prioritizes **craft over convenience**:
- Every animation is intentional
- Every color choice has meaning
- Every component is polished
- No generic "AI slop" aesthetics
- Uncommon font choices + unexpected layouts
- Precision in details

The goal is not to build fast, but to build *right*. This is your portfolio piece that shows you don't just ship code — you *make* things.

---

## 🛠️ Development Notes

### Adding New Components
1. Create component in `app/components/`
2. Use design tokens from `design-tokens.ts`
3. Import CSS modules for styling
4. Use TypeScript for type safety

### Adding New API Routes
1. Create route in `app/api/[endpoint]/route.ts`
2. Follow pattern: fetch data → process → return JSON
3. Use types from `types/index.ts`

### Working with Three.js
- Use `@react-three/fiber` for React integration
- Keep geometries optimized (low polygon count)
- Use WebGL shaders for performance

---

## 📚 Resources

- [FastF1 Documentation](https://docs.fastf1.dev/)
- [Three.js Documentation](https://threejs.org/docs/)
- [Next.js Documentation](https://nextjs.org/docs/)
- [Design System Guide](./design-tokens.ts)

---

## 🤝 Contributing

This is a personal portfolio project. Feel free to fork and customize for your own needs.

---

## 📝 License

MIT

---

**Built with precision. Built with pride.** 🏁
