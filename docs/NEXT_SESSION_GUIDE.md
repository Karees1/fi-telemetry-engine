# Next Session Guide — Race Replay + Oracle Cloud

## What was completed this session

| File | Status |
|------|--------|
| `services/python/fastf1_server.py` | ✅ Added `/api/race/positions` SSE endpoint |
| `app/api/race/positions/route.ts` | ✅ Created Edge proxy |
| `lib/team-colors.ts` | ✅ 2024 F1 team colors |
| `hooks/useRacePositions.ts` | ✅ SSE consumer hook |
| `store/dashboardStore.ts` | ✅ Added `raceMode`, `raceTimeSeconds`, `totalRaceTime` |
| `app/components/Track3D/RaceCarDot/` | ✅ Colored disc + HTML driver label + trail |
| `app/components/Track3D/TrackRibbon/` | ✅ Flat wide ribbon mesh |
| `app/components/Track3D/Scene.tsx` | ✅ Dual-mode scene (lap analysis + race replay) |

---

## What still needs building (in order)

### 1. Update `TimelineScrubber.tsx`

Replace the existing file. Key changes:
- Accept `raceMode?: boolean` and `totalRaceTime?: number` props
- In race mode: subscribe to `store.raceTimeSeconds` (not `frameIndex`)
- Format time as `H:MM:SS` for race mode (not lap time `M:SS.mmm`)
- Speed options in race mode: `[1, 5, 10, 30, 60]` (need 60× to watch a full race in 1.5 min)
- Reset on play: if `raceTimeSeconds >= totalRaceTime`, reset to 0

```tsx
// Race mode time formatter
function formatRaceTime(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

// In useEffect — subscribe to the right store key
const unsub = useDashboardStore.subscribe(
  s => raceMode ? s.raceTimeSeconds : s.frameIndex,
  (val) => {
    const total = raceMode ? (totalRaceTime ?? 1) : (totalFrames - 1);
    const pct = (val / total) * 100;
    if (fillRef.current) fillRef.current.style.width = `${pct.toFixed(2)}%`;
    if (timeRef.current) {
      timeRef.current.textContent = raceMode
        ? formatRaceTime(val as number)
        : formatLapTime((val / (totalFrames - 1)) * lapTimeMs);
    }
  }
);

// Scrub handler
const handleMouseDown = (e) => {
  const ratio = (e.clientX - rect.left) / rect.width;
  if (raceMode) setRaceTimeSeconds(ratio * totalRaceTime);
  else          setFrameIndex(ratio * (totalFrames - 1));
};

// Play button
onClick={() => {
  if (raceMode) {
    if (store.raceTimeSeconds >= totalRaceTime) setRaceTimeSeconds(0);
  } else {
    if (store.frameIndex >= totalFrames - 1) setFrameIndex(0);
  }
  setIsPlaying(!isPlaying);
}}

// Speed options
const SPEEDS     = [0.25, 0.5, 1, 2, 4];        // lap mode
const RACE_SPEEDS = [1, 5, 10, 30, 60];          // race mode
```

---

### 2. Update `TopBar.tsx`

Add a RACE REPLAY toggle button next to TRACK LINE / SPEED MAP:

```tsx
import { useDashboardStore } from '@/store/dashboardStore';

// Inside TopBar:
const raceMode    = useDashboardStore(s => s.raceMode);
const setRaceMode = useDashboardStore(s => s.setRaceMode);

// After the heatmap toggle button:
<div className={styles.divider} />
<button
  className={`${styles.toggleBtn} ${raceMode ? styles.toggleBtnActive : ''}`}
  onClick={() => setRaceMode(!raceMode)}
>
  {raceMode ? 'RACE LIVE' : 'RACE REPLAY'}
</button>
```

Use the same CSS classes as the existing heatmap toggle (`styles.toggleBtn` / `styles.toggleBtnActive`).

---

### 3. Update `Dashboard.tsx`

This is the main wiring step.

```tsx
import { useRacePositions } from '@/hooks/useRacePositions';
import { useDashboardStore } from '@/store/dashboardStore';

export function Dashboard({ loadState, race, session, onBack, onLoadLap }) {
  const { setPrimaryDriver, reset, raceMode, setRaceMode, setTotalRaceTime, setRaceTimeSeconds } = useDashboardStore();
  const { state: racePos, load: loadRace, reset: resetRace } = useRacePositions();

  // When raceMode turns on, start loading race positions
  useEffect(() => {
    if (raceMode) {
      loadRace(race, session);
    } else {
      resetRace();
      setRaceTimeSeconds(0);
    }
  }, [raceMode]);

  // When race data fully loads, set totalRaceTime in store
  useEffect(() => {
    if (racePos.stage === 'complete' && racePos.data) {
      setTotalRaceTime(racePos.data.totalTime);
    }
  }, [racePos.stage, racePos.data]);

  // ... existing primaryDriver auto-select logic ...

  return (
    <div className={styles.root}>
      <div className={styles.canvasLayer}>
        {loadState.track ? (
          <Track3DScene
            track={loadState.track}
            telemetry={loadState.telemetry}
            racePositions={racePos.data}   // <-- new prop
          />
        ) : /* empty state */ ...}
      </div>

      <TopBar ... />

      <TelemetrySidebar ... />

      <footer className={styles.timelineBar}>
        {(totalFrames > 0 || raceMode) && (
          <TimelineScrubber
            totalFrames={totalFrames}
            lapTimeMs={lapTimeMs}
            raceMode={raceMode}
            totalRaceTime={racePos.data?.totalTime ?? 0}
          />
        )}
      </footer>

      {/* Race loading overlay */}
      {raceMode && racePos.stage === 'loading' && (
        <div className={styles.raceLoadOverlay}>
          <p>LOADING RACE DATA — {racePos.loadedCount} / 20 DRIVERS</p>
        </div>
      )}
    </div>
  );
}
```

Add to `Dashboard.module.css`:
```css
.raceLoadOverlay {
  position: fixed;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 50;
  font-family: 'Roboto Mono', monospace;
  font-size: 0.65rem;
  letter-spacing: 0.18em;
  color: rgba(0, 217, 255, 0.7);
  background: rgba(10, 14, 39, 0.88);
  border: 1px solid rgba(0, 217, 255, 0.2);
  border-radius: 0.2rem;
  padding: 0.4rem 1rem;
}
```

---

### 4. TypeScript check

```bash
npm run type-check
```

Fix any errors. Common ones to expect:
- `TimelineScrubber` props changed — make sure callers pass the new optional props
- `Track3DScene` new `racePositions` prop — already optional so existing callers are fine
- `useDashboardStore` new actions — already added

---

### 5. Oracle Cloud Setup

After signing up at cloud.oracle.com:

**Create VM:**
- Shape: VM.Standard.A1.Flex (ARM), 4 OCPU, 24GB RAM
- OS: Ubuntu 22.04
- Generate SSH key pair, download private key

**SSH in and run these commands:**
```bash
# Install Python 3.11
sudo apt update && sudo apt install -y python3.11 python3.11-venv python3-pip git

# Clone your repo
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git /opt/f1-telemetry
cd /opt/f1-telemetry

# Install Python deps
pip3 install -r services/python/requirements.txt

# Create persistent cache dir
mkdir -p /var/f1cache
```

**Create systemd service** at `/etc/systemd/system/f1-telemetry.service`:
```ini
[Unit]
Description=F1 Telemetry FastF1 Service
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/f1-telemetry
Environment=PORT=5000
Environment=F1_CACHE_DIR=/var/f1cache
ExecStart=/usr/bin/python3 services/python/fastf1_server.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**Enable and start:**
```bash
sudo systemctl daemon-reload
sudo systemctl enable f1-telemetry
sudo systemctl start f1-telemetry
sudo systemctl status f1-telemetry
```

**Update `fastf1_server.py` to use the env var for cache dir:**
```python
CACHE_DIR = os.environ.get("F1_CACHE_DIR", os.path.join(os.path.dirname(__file__), '..', '..', 'cache'))
```

**Open port 5000 on Oracle firewall:**
- Oracle Console → Networking → VCN → Security List → Add Ingress Rule
- Source: 0.0.0.0/0, Protocol: TCP, Port: 5000
- Also run: `sudo iptables -I INPUT -p tcp --dport 5000 -j ACCEPT`

**Set Vercel env var:**
- Vercel Dashboard → Project → Settings → Environment Variables
- `PYTHON_SERVICE_URL` = `http://YOUR_ORACLE_PUBLIC_IP:5000`
- Redeploy

---

## How the full race replay works end to end

1. User enters Dashboard (lap analysis mode, existing behavior)
2. User clicks **RACE REPLAY** in TopBar → `raceMode = true`
3. Dashboard calls `loadRace(race, session)` → streams from `/api/race/positions`
4. Overlay shows "LOADING — N/20 DRIVERS" as data arrives
5. When complete: all 20 colored dots appear on the flat ribbon track
6. Each dot is at its real GPS position — cars on inside line are visually inside, outside line outside
7. User hits Play in the timeline (now showing H:MM:SS)
8. Set speed to 30× or 60× to watch the full race in ~2 minutes
9. Overtakes, chicane queues, pit exits all visible from real GPS data
10. Click any driver dot label → sets as primary → camera follows that car
