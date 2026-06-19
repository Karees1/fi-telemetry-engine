"""
F1 Telemetry Dashboard — FastF1 REST + SSE Server
Run: python services/python/fastf1_server.py
Listens on http://localhost:5000
"""

import gc
import json
import os
import queue
import threading
import time

import fastf1
import numpy as np
import pandas as pd
from flask import Flask, Response, jsonify, request
from flask_cors import CORS

# ── Cache ──────────────────────────────────────────────────────────────────────
CACHE_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'cache')
os.makedirs(CACHE_DIR, exist_ok=True)
fastf1.Cache.enable_cache(CACHE_DIR)

app = Flask(__name__)
CORS(app)

# ── Startup cache warm-up ─────────────────────────────────────────────────────
# Pre-fetch the 2024 + 2023 + 2025 event schedules in the background so they're
# cached before the first user request. Failures are silently ignored.
def _warm_cache():
    for yr in (2026, 2025, 2024, 2023):
        try:
            fastf1.get_event_schedule(yr, include_testing=False)
        except Exception:
            pass

threading.Thread(target=_warm_cache, daemon=True).start()


# ── Helpers ────────────────────────────────────────────────────────────────────

def sse_event(event: str, data: dict) -> str:
    payload = json.dumps(data, default=str)
    return f"event: {event}\ndata: {payload}\n\n"


def sse_error(message: str) -> str:
    return sse_event("error", {"message": message})


def normalise(arr):
    """Convert numpy types to plain Python so json.dumps doesn't choke."""
    if arr is None:
        return []
    return [x.item() if hasattr(x, 'item') else x for x in arr]


def td_ms(val):
    """Safely convert a pandas Timedelta (or NaT) to milliseconds float."""
    try:
        if val is None or pd.isna(val):
            return None
        return float(val.total_seconds() * 1000)
    except Exception:
        return None


def safe_bool(val):
    """pandas NA-safe bool."""
    try:
        if pd.isna(val):
            return False
    except Exception:
        pass
    return bool(val)


def safe_int(val, default=0):
    """pandas NA-safe int conversion."""
    try:
        if val is None or pd.isna(val):
            return default
        return int(val)
    except Exception:
        return default


def td_s(val):
    """Safely convert a pandas Timedelta (or NaT) to seconds float."""
    try:
        if val is None or pd.isna(val):
            return None
        return float(val.total_seconds())
    except Exception:
        return None


def _run_in_thread(fn, max_wait=120):
    """Run fn() in a background thread; yield keep-alive SSE comments every
    5 s while waiting. Aborts and yields ("err", "Timeout") after max_wait seconds."""
    result_q = queue.Queue()
    deadline  = time.time() + max_wait

    def _worker():
        try:
            result_q.put(("ok", fn()))
        except BaseException as exc:          # catch SystemExit / OOM too
            result_q.put(("err", str(exc)))

    threading.Thread(target=_worker, daemon=True).start()
    while True:
        remaining = deadline - time.time()
        if remaining <= 0:
            yield ("err", f"Timeout after {max_wait}s")
            return
        try:
            status, value = result_q.get(timeout=min(5, remaining))
            yield (status, value)
            return
        except queue.Empty:
            yield ": keep-alive\n\n"


def _get_session(yr, rnd, stype, retries=3):
    """fastf1.get_session() with exponential-backoff retry for network failures."""
    last_exc = None
    for attempt in range(retries):
        try:
            return fastf1.get_session(yr, rnd, stype)
        except Exception as exc:
            last_exc = exc
            if attempt < retries - 1:
                time.sleep(2 ** attempt)  # 1 s, 2 s
    raise last_exc


# ── Team colours (2024/2025 grid) ─────────────────────────────────────────────
_TEAM_COLORS: dict[str, str] = {
    'Red Bull Racing': '#3671C6',
    'Ferrari':         '#E8002D',
    'Mercedes':        '#27F4D2',
    'McLaren':         '#FF8000',
    'Aston Martin':    '#229971',
    'Alpine':          '#FF87BC',
    'Williams':        '#64C4FF',
    'RB':              '#6692FF',
    'Haas F1 Team':    '#B6BABD',
    'Kick Sauber':     '#52E252',
}


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.route("/health")
def health():
    return jsonify({"status": "ok", "timestamp": int(time.time() * 1000)})


@app.route("/api/session/load")
def load_session():
    """
    SSE stream — loads a session in stages and emits progress events.

    Query params:
        year        int     e.g. 2024
        round       int     e.g. 5
        session     str     FP1 | FP2 | FP3 | Q | SQ | S | R
        drivers     str     comma-separated 3-letter codes, e.g. VER,LEC
                            if omitted, returns the top-3 fastest drivers

    Event sequence:
        connecting      { }
        session_meta    { sessionId, name, date, type, drivers[] }
        lap_times       { laps: [{ driver, lapNumber, lapTime, compound, … }] }
        track_layout    { x[], y[], z[], bounds }
        telemetry       { driver, points: { distance, speed, throttle, brake, gear, drs, x, y, z } }
            (one event per driver requested)
        complete        { sessionId }
    """
    year    = request.args.get("year",    type=int)
    round_n = request.args.get("round",   type=int)
    s_type  = request.args.get("session", default="R")
    drivers = request.args.get("drivers", default="")

    if not year or not round_n:
        return Response(sse_error("Missing year or round"), mimetype="text/event-stream", status=400)

    def stream():
        # ── 1. Connecting ──────────────────────────────────────────────────
        yield sse_event("connecting", {
            "message": "ESTABLISHING UPLINK",
            "year": year, "round": round_n, "session": s_type,
        })

        # ── 2. Resolve session (downloads schedule if not cached) ──────────
        session = None
        for chunk in _run_in_thread(lambda: _get_session(year, round_n, s_type)):
            if isinstance(chunk, tuple):
                status, value = chunk
                if status == "err":
                    yield sse_error(f"Could not resolve session: {value}")
                    return
                session = value
            else:
                yield chunk  # keep-alive

        # ── 3. Load metadata + laps (no full telemetry yet) ────────────────
        status = None
        for chunk in _run_in_thread(
            lambda: session.load(laps=True, telemetry=False, weather=False, messages=False)
        ):
            if isinstance(chunk, tuple):
                status, err = chunk
            else:
                yield chunk  # keep-alive

        if status == "err":
            yield sse_error(f"Session load failed: {err}")
            return

        # Verify laps are actually populated — FastF1 can silently fail to load
        # laps (e.g. OpenF1 API returns empty/unexpected data for newer seasons).
        # On failure, retry once with force=True to bypass any cached empty state.
        try:
            lap_count = len(session.laps)
        except Exception:
            # First attempt failed — retry with force=True
            retry_status = None
            for chunk in _run_in_thread(
                lambda: session.load(laps=True, telemetry=False, weather=False, messages=False, force=True),
                max_wait=60,
            ):
                if isinstance(chunk, tuple):
                    retry_status, _ = chunk
                else:
                    yield chunk

            try:
                lap_count = len(session.laps)
            except Exception as verify_err:
                # Both attempts failed — most likely this year's data isn't
                # available via the OpenF1 API that FastF1 uses for 2024+ seasons.
                yield sse_error(
                    f"No lap data available for {year} round {round_n} ({s_type}). "
                    f"FastF1 error: {verify_err}. "
                    f"Try the 2024 season — it has complete, verified data."
                )
                return

        # ── 4. session_meta ────────────────────────────────────────────────
        driver_rows = []
        try:
            for _, row in session.results.iterrows():
                driver_rows.append({
                    "code":      row.get("Abbreviation", "???"),
                    "fullName":  f"{row.get('FirstName','')} {row.get('LastName','')}".strip(),
                    "team":      row.get("TeamName", ""),
                    "number":    int(row.get("DriverNumber", 0)),
                    "position":  int(row.get("Position", 0)) if row.get("Position") else None,
                })
        except Exception:
            pass  # results may be empty for practice sessions

        session_id = f"{year}_{round_n}_{s_type}"
        yield sse_event("session_meta", {
            "sessionId": session_id,
            "name":      session.event.get("EventName", ""),
            "date":      str(session.event.get("EventDate", "")),
            "type":      s_type,
            "circuit":   session.event.get("Location", ""),
            "country":   session.event.get("Country", ""),
            "drivers":   driver_rows,
        })

        # ── 5. Lap times ───────────────────────────────────────────────────
        laps_payload = []
        try:
            for _, lap in session.laps.iterrows():
                try:
                    # Compute lap start time: session time at lap end − lap duration
                    lap_time_td  = lap.get("LapTime")
                    lap_end_td   = lap.get("Time")
                    lap_start_ms = None
                    if lap_time_td is not None and not pd.isna(lap_time_td) and \
                       lap_end_td  is not None and not pd.isna(lap_end_td):
                        lap_start_ms = td_ms(lap_end_td - lap_time_td)

                    laps_payload.append({
                        "driver":         str(lap.get("Driver", "")),
                        "lapNumber":      safe_int(lap.get("LapNumber"), 0),
                        "lapTime":        td_ms(lap.get("LapTime")),
                        "sector1":        td_ms(lap.get("Sector1Time")),
                        "sector2":        td_ms(lap.get("Sector2Time")),
                        "sector3":        td_ms(lap.get("Sector3Time")),
                        "compound":       str(lap.get("Compound", "") or ""),
                        "isPersonalBest": safe_bool(lap.get("IsPersonalBest", False)),
                        "position":       safe_int(lap.get("Position"), None),
                        "pitInTime":      td_ms(lap.get("PitInTime")),
                        "pitOutTime":     td_ms(lap.get("PitOutTime")),
                        "lapStartTime":   lap_start_ms,
                    })
                except Exception:
                    pass  # skip individual bad rows
        except Exception as e:
            yield sse_event("warning", {"message": f"Lap times partial: {e}"})

        yield sse_event("lap_times", {"laps": laps_payload})

        gc.collect()

        # ── 6. Track layout ────────────────────────────────────────────────
        # Full session.load(telemetry=True) is intentionally SKIPPED here.
        # Downloading all 20 drivers' full-race telemetry at once peaks at
        # ~300–500 MB on Render's 512 MB free tier and OOMs the process,
        # dropping the SSE connection.  Instead we use lazy per-lap
        # get_telemetry() in Tier 1/2 (FastF1 3.4+ fetches only what's
        # needed), and Tier 3 (session.pos_data) only if it's already loaded.
        # Three-tier fallback so a partial telemetry load still yields a map.
        # Tier 1: fastest-lap telemetry (highest quality — single clean lap)
        # Tier 2: any driver's fastest lap
        # Tier 3: raw pos_data (continuous GPS from any car)
        track_sent   = False
        first_error  = ""

        def _build_track(tel_df):
            """Normalise a telemetry / pos_data DataFrame into a track_layout payload."""
            x_col = tel_df["X"].dropna()
            y_col = tel_df["Y"].dropna()
            if len(x_col) < 50:
                raise ValueError(f"Too few X/Y points ({len(x_col)})")
            x    = normalise(x_col.values)
            y    = normalise(y_col.values)
            z    = normalise(tel_df["Z"].dropna().values) if "Z" in tel_df.columns else [0.0] * len(x)
            dist = normalise(tel_df["Distance"].dropna().values) if "Distance" in tel_df.columns else list(range(len(x)))
            return {
                "x": x, "y": y, "z": z,
                "distance": dist,
                "bounds": {
                    "minX": float(np.nanmin(x_col)), "maxX": float(np.nanmax(x_col)),
                    "minY": float(np.nanmin(y_col)), "maxY": float(np.nanmax(y_col)),
                },
                "length": float(tel_df["Distance"].dropna().max()) if "Distance" in tel_df.columns else float(len(x)),
            }

        # Tier 1 — overall fastest lap (wrapped in thread so keep-alives flow
        # while FastF1 lazily downloads the full telemetry dataset)
        if not track_sent:
            def _t1():
                fastest = session.laps.pick_fastest()
                if fastest is None or (hasattr(fastest, "empty") and fastest.empty):
                    raise ValueError("No fastest lap found")
                return fastest.get_telemetry()

            t1_status = None; t1_tel = None
            for chunk in _run_in_thread(_t1, max_wait=25):
                if isinstance(chunk, tuple):
                    t1_status, t1_tel = chunk
                else:
                    yield chunk  # keep-alive

            if t1_status == "ok":
                try:
                    yield sse_event("track_layout", _build_track(t1_tel))
                    track_sent = True
                except Exception as e1:
                    first_error = str(e1)
            else:
                first_error = str(t1_tel)

        # Tier 2 — try first 3 drivers in one thread (avoids multi-thread overhead)
        if not track_sent:
            def _t2_batch():
                for d in list(session.laps["Driver"].unique())[:3]:
                    try:
                        lap = session.laps.pick_driver(d).pick_fastest()
                        if lap is None or (hasattr(lap, "empty") and lap.empty):
                            continue
                        return lap.get_telemetry()
                    except Exception:
                        continue
                raise ValueError("No Tier-2 telemetry available")

            t2_status = None; t2_tel = None
            for chunk in _run_in_thread(_t2_batch, max_wait=25):
                if isinstance(chunk, tuple):
                    t2_status, t2_tel = chunk
                else:
                    yield chunk

            if t2_status == "ok":
                try:
                    yield sse_event("track_layout", _build_track(t2_tel))
                    track_sent = True
                except Exception:
                    pass

        # Tier 3 — raw pos_data (only available if telemetry was pre-loaded;
        # skipped here since we no longer do session.load(telemetry=True))
        if not track_sent:
            pos_data = getattr(session, 'pos_data', None)
            if pos_data is not None:
                try:
                    for _car_key, pos_df in pos_data.items():
                        if pos_df is None or pos_df.empty:
                            continue
                        valid = pos_df[["X", "Y"]].dropna()
                        if len(valid) < 50:
                            continue
                        sample = valid.iloc[:10000]
                        payload = {
                            "x": normalise(sample["X"].values),
                            "y": normalise(sample["Y"].values),
                            "z": [0.0] * len(sample),
                            "distance": list(range(len(sample))),
                            "bounds": {
                                "minX": float(sample["X"].min()), "maxX": float(sample["X"].max()),
                                "minY": float(sample["Y"].min()), "maxY": float(sample["Y"].max()),
                            },
                            "length": float(len(sample)),
                        }
                        yield sse_event("track_layout", payload)
                        track_sent = True
                        break
                except Exception as e3:
                    yield sse_event("warning", {"message": f"Track Tier 3 failed: {e3}"})
            if not track_sent:
                yield sse_event("warning", {"message": f"Track layout unavailable: {first_error}"})

        # ── 7. Per-driver telemetry ────────────────────────────────────────
        # Only download if the client explicitly requests driver codes.
        # On-demand loading via /api/session/lap is preferred for memory efficiency.
        requested = [d.strip().upper() for d in drivers.split(",") if d.strip()] if drivers else []

        for driver_code in requested:
            def _drv_tel(code=driver_code):
                lap = session.laps.pick_driver(code).pick_fastest()
                if lap is None or (hasattr(lap, "empty") and lap.empty):
                    raise ValueError(f"No fastest lap for {code}")
                tel = lap.get_telemetry().dropna(subset=["Distance", "Speed"])
                return (lap, tel)

            drv_status = None; drv_result = None
            for chunk in _run_in_thread(_drv_tel, max_wait=20):
                if isinstance(chunk, tuple):
                    drv_status, drv_result = chunk
                else:
                    yield chunk  # keep-alive

            if drv_status == "ok":
                lap, tel = drv_result
                yield sse_event("telemetry", {
                    "driver":    driver_code,
                    "lapNumber": int(lap["LapNumber"]),
                    "lapTime":   td_ms(lap["LapTime"]),
                    "points": {
                        "distance": normalise(tel["Distance"].values),
                        "speed":    normalise(tel["Speed"].values),
                        "throttle": normalise(tel["Throttle"].fillna(0).values),
                        "brake":    normalise(tel["Brake"].fillna(False).astype(int).values),
                        "gear":     normalise(tel["nGear"].fillna(0).values),
                        "drs":      normalise(tel["DRS"].fillna(0).values),
                        "x":        normalise(tel["X"].fillna(0).values),
                        "y":        normalise(tel["Y"].fillna(0).values),
                        "z":        normalise(tel["Z"].fillna(0).values) if "Z" in tel.columns else [],
                    },
                })
            else:
                yield sse_event("warning", {"message": f"Telemetry unavailable for {driver_code}: {drv_result}"})
            gc.collect()

        # ── 8. Done ────────────────────────────────────────────────────────
        yield sse_event("complete", {"sessionId": session_id})

    return Response(
        stream(),
        mimetype="text/event-stream",
        headers={
            "Cache-Control":     "no-cache",
            "X-Accel-Buffering": "no",
            "Connection":        "keep-alive",
        },
    )


@app.route("/api/session/lap")
def get_lap_telemetry():
    """
    GET /api/session/lap?year=2024&round=22&session=R&driver=NOR&lap=50

    Returns telemetry for one driver on one specific lap.
    Omit 'lap' to get that driver's fastest lap.
    """
    year    = request.args.get("year",    type=int)
    round_n = request.args.get("round",   type=int)
    s_type  = request.args.get("session", default="R")
    driver  = request.args.get("driver",  default="").strip().upper()
    lap_num = request.args.get("lap",     type=int)

    if not year or not round_n or not driver:
        return jsonify({"status": "error", "error": "Missing year, round, or driver"}), 400

    try:
        session = _get_session(year, round_n, s_type)
        session.load(laps=True, telemetry=True, weather=False, messages=False)
    except Exception as e:
        return jsonify({"status": "error", "error": f"Session load failed: {e}"}), 500

    try:
        driver_laps = session.laps.pick_driver(driver)
        if lap_num is not None:
            rows = driver_laps[driver_laps["LapNumber"] == lap_num]
            if rows.empty:
                return jsonify({"status": "error", "error": f"Lap {lap_num} not found for {driver}"}), 404
            lap = rows.iloc[0]
        else:
            lap = driver_laps.pick_fastest()
            if lap is None or (hasattr(lap, 'empty') and lap.empty):
                return jsonify({"status": "error", "error": f"No valid lap found for {driver}"}), 404

        tel = lap.get_telemetry()
        data = {
            "driver":    driver,
            "lapNumber": int(lap["LapNumber"]),
            "lapTime":   td_ms(lap["LapTime"]),
            "points": {
                "distance": normalise(tel["Distance"].values),
                "speed":    normalise(tel["Speed"].values),
                "throttle": normalise(tel["Throttle"].values),
                "brake":    normalise(tel["Brake"].values),
                "gear":     normalise(tel["nGear"].values),
                "drs":      normalise(tel["DRS"].values),
                "x":        normalise(tel["X"].values),
                "y":        normalise(tel["Y"].values),
                "z":        normalise(tel["Z"].values) if "Z" in tel.columns else [],
            },
        }
        return jsonify({"status": "success", "data": data, "timestamp": int(time.time() * 1000)})
    except Exception as e:
        return jsonify({"status": "error", "error": str(e)}), 500


@app.route("/api/race/positions")
def get_race_positions():
    """
    SSE stream — lap-interpolation race data for all cars (no telemetry download).

    Uses only session.laps (loaded with laps=True, telemetry=False) to derive
    each driver's position on track at any race time T via:
      fraction = (T - lapStart) / lapDuration  →  track index

    This avoids the 300–500 MB session.load(telemetry=True) that OOMs on
    Render's 512 MB free tier.

    Query params: year, round, session

    Event sequence:
        connecting    { message }
        race_start    { sessionId, drivers[], totalTime, mode:'lap_interpolation' }
        driver_laps   { code, laps:[{n, start, duration, compound, pitIn, pitOut}] }
                          — one per driver, times in seconds from session start
        complete      { sessionId }
    """
    year    = request.args.get("year",    type=int)
    round_n = request.args.get("round",   type=int)
    s_type  = request.args.get("session", default="R")

    if not year or not round_n:
        return Response(sse_error("Missing year or round"), mimetype="text/event-stream", status=400)

    def stream():
        yield sse_event("connecting", {"message": "LOADING RACE DATA"})

        # ── 1. Resolve session ────────────────────────────────────────────────
        session = None
        for chunk in _run_in_thread(lambda: _get_session(year, round_n, s_type)):
            if isinstance(chunk, tuple):
                status, value = chunk
                if status == "err":
                    yield sse_error(f"Session load failed: {value}")
                    return
                session = value
            else:
                yield chunk

        # ── 2. Load ONLY laps — no telemetry, avoids OOM ─────────────────────
        load_status = None
        for chunk in _run_in_thread(
            lambda: session.load(laps=True, telemetry=False, weather=False, messages=False),
            max_wait=60,
        ):
            if isinstance(chunk, tuple):
                load_status, _ = chunk
            else:
                yield chunk

        if load_status == "err":
            yield sse_error(f"Lap load failed for {year} round {round_n}. Try the 2024 season.")
            return

        # Verify laps are actually populated (same silent-failure guard as /api/session/load)
        try:
            _ = len(session.laps)
        except Exception:
            retry_st = None
            for chunk in _run_in_thread(
                lambda: session.load(laps=True, telemetry=False, weather=False, messages=False, force=True),
                max_wait=60,
            ):
                if isinstance(chunk, tuple):
                    retry_st, _ = chunk
                else:
                    yield chunk
            try:
                _ = len(session.laps)
            except Exception as ve:
                yield sse_error(
                    f"No lap data for {year} round {round_n}. "
                    f"FastF1: {ve}. Try the 2024 season."
                )
                return

        gc.collect()

        # ── 3. Build driver roster ────────────────────────────────────────────
        driver_info = []
        try:
            for _, row in session.results.iterrows():
                code    = str(row.get("Abbreviation", "???"))
                num_raw = row.get("DriverNumber", 0)
                team    = str(row.get("TeamName", ""))
                pos_val = row.get("Position")
                driver_info.append({
                    "code":     code,
                    "fullName": f"{row.get('FirstName','')} {row.get('LastName','')}".strip(),
                    "team":     team,
                    "number":   safe_int(num_raw, 0),
                    "color":    _TEAM_COLORS.get(team, "#00D9FF"),
                    "position": safe_int(pos_val, None),
                })
        except Exception as e:
            yield sse_event("warning", {"message": f"Driver info partial: {e}"})

        # ── 4. Compute lap data per driver ────────────────────────────────────
        total_time = 0.0
        driver_lap_data: dict[str, list] = {}

        try:
            # total_time = max session time across all drivers
            max_t = session.laps["Time"].dropna()
            if not max_t.empty:
                total_time = float(max_t.max().total_seconds())
        except Exception:
            pass

        try:
            for code in session.laps["Driver"].unique():
                try:
                    drv_laps = session.laps.pick_driver(code)
                    if drv_laps.empty:
                        continue

                    laps = []
                    for _, lap in drv_laps.iterrows():
                        try:
                            lap_time_td = lap.get("LapTime")
                            lap_end_td  = lap.get("Time")  # session time at lap END

                            if lap_time_td is None or pd.isna(lap_time_td):
                                continue
                            if lap_end_td is None or pd.isna(lap_end_td):
                                continue

                            lap_dur_s   = float(lap_time_td.total_seconds())
                            lap_end_s   = float(lap_end_td.total_seconds())
                            lap_start_s = lap_end_s - lap_dur_s

                            if lap_dur_s <= 0:
                                continue

                            pit_in_td  = lap.get("PitInTime")
                            pit_out_td = lap.get("PitOutTime")
                            pit_in_s   = float(pit_in_td.total_seconds())  if pit_in_td  is not None and not pd.isna(pit_in_td)  else None
                            pit_out_s  = float(pit_out_td.total_seconds()) if pit_out_td is not None and not pd.isna(pit_out_td) else None

                            laps.append({
                                "n":        safe_int(lap.get("LapNumber"), 0),
                                "start":    round(lap_start_s, 3),
                                "duration": round(lap_dur_s,   3),
                                "compound": str(lap.get("Compound", "") or "UNKNOWN"),
                                "pitIn":    round(pit_in_s,  3) if pit_in_s  is not None else None,
                                "pitOut":   round(pit_out_s, 3) if pit_out_s is not None else None,
                            })
                        except Exception:
                            continue

                    if laps:
                        driver_lap_data[code] = laps
                except Exception:
                    continue
        except Exception as e:
            yield sse_event("warning", {"message": f"Lap data partial: {e}"})

        gc.collect()

        session_id = f"{year}_{round_n}_{s_type}"

        # ── 5. Emit race_start ────────────────────────────────────────────────
        yield sse_event("race_start", {
            "sessionId": session_id,
            "drivers":   driver_info,
            "totalTime": round(total_time, 3),
            "mode":      "lap_interpolation",
        })

        # ── 6. Emit driver_laps (one per driver) ──────────────────────────────
        for code, laps in driver_lap_data.items():
            yield sse_event("driver_laps", {"code": code, "laps": laps})

        yield sse_event("complete", {"sessionId": session_id})

    return Response(
        stream(),
        mimetype="text/event-stream",
        headers={
            "Cache-Control":     "no-cache",
            "X-Accel-Buffering": "no",
            "Connection":        "keep-alive",
        },
    )


def _sessions_from_event(row) -> list:
    """Derive session pills from FastF1 event schedule row."""
    session_map = {
        "practice 1":          "FP1",
        "practice 2":          "FP2",
        "practice 3":          "FP3",
        "qualifying":          "Q",
        "sprint qualifying":   "SQ",
        "sprint shootout":     "SQ",
        "sprint":              "S",
        "race":                "R",
    }
    result = []
    for col in ["Session1", "Session2", "Session3", "Session4", "Session5"]:
        val = str(row.get(col, "") or "").strip().lower()
        code = session_map.get(val)
        if code and code not in result:
            result.append(code)
    if not result:
        result = ["FP1", "FP2", "FP3", "Q", "R"]
    return result


@app.route("/api/races")
def get_races():
    """GET /api/races?year=2024  — delegates to FastF1 schedule."""
    year = request.args.get("year", type=int, default=2024)
    try:
        schedule = fastf1.get_event_schedule(year, include_testing=False)
        races = []
        for _, row in schedule.iterrows():
            rn = int(row["RoundNumber"])
            races.append({
                "id":     f"{year}_{rn:02d}",
                "year":   year,
                "round":  rn,
                "name":   row["EventName"],
                "date":   str(row["EventDate"])[:10],
                "circuit": {
                    "id":       row["Location"].lower().replace(" ", "_"),
                    "name":     row["Location"],
                    "location": f"{row['Location']}, {row['Country']}",
                },
                "sessions": _sessions_from_event(row),
            })
        return jsonify({"status": "success", "data": races, "timestamp": int(time.time() * 1000)})
    except Exception as e:
        return jsonify({"status": "error", "error": str(e), "timestamp": int(time.time() * 1000)}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"F1 Telemetry Python service starting on http://0.0.0.0:{port}")
    app.run(host="0.0.0.0", port=port, debug=False, threaded=True)
