"""
F1 Telemetry Dashboard — FastF1 REST + SSE Server
Run: python services/python/fastf1_server.py
Listens on http://localhost:5000
"""

import os
import json
import time
import numpy as np
import pandas as pd
import fastf1
from flask import Flask, Response, jsonify, request
from flask_cors import CORS

# ── Cache ──────────────────────────────────────────────────────────────────────
CACHE_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'cache')
os.makedirs(CACHE_DIR, exist_ok=True)
fastf1.Cache.enable_cache(CACHE_DIR)

app = Flask(__name__)
CORS(app)  # Next.js dev server is on a different port


# ── Helpers ────────────────────────────────────────────────────────────────────

def sse_event(event: str, data: dict) -> str:
    """Format a single SSE message."""
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
        telemetry       { driver, points: [{ distance, speed, throttle, brake, gear, drs }] }
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

        try:
            session = fastf1.get_session(year, round_n, s_type)
        except Exception as e:
            yield sse_error(f"Could not resolve session: {e}")
            return

        # ── 2. Load metadata + laps (no full telemetry yet) ────────────────
        try:
            # laps=True is fast; telemetry=False skips the heavy download
            session.load(laps=True, telemetry=False, weather=False, messages=False)
        except Exception as e:
            yield sse_error(f"Session load failed: {e}")
            return

        # Build driver list from session results
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

        # ── 3. Lap times ───────────────────────────────────────────────────
        laps_payload = []
        try:
            for _, lap in session.laps.iterrows():
                laps_payload.append({
                    "driver":         lap.get("Driver", ""),
                    "lapNumber":      int(lap.get("LapNumber", 0)),
                    "lapTime":        td_ms(lap.get("LapTime")),
                    "sector1":        td_ms(lap.get("Sector1Time")),
                    "sector2":        td_ms(lap.get("Sector2Time")),
                    "sector3":        td_ms(lap.get("Sector3Time")),
                    "compound":       str(lap.get("Compound", "") or ""),
                    "isPersonalBest": safe_bool(lap.get("IsPersonalBest", False)),
                })
        except Exception as e:
            yield sse_event("warning", {"message": f"Lap times partial: {e}"})

        yield sse_event("lap_times", {"laps": laps_payload})

        # ── 4. Reload with full telemetry ──────────────────────────────────
        try:
            session.load(laps=True, telemetry=True, weather=False, messages=False)
        except Exception as e:
            yield sse_error(f"Telemetry load failed: {e}")
            return

        # ── 5. Track layout (from fastest lap of any driver) ───────────────
        try:
            fastest = session.laps.pick_fastest()
            tel = fastest.get_telemetry()
            x = normalise(tel["X"].values)
            y = normalise(tel["Y"].values)
            z = normalise(tel["Z"].values) if "Z" in tel.columns else [0.0] * len(x)
            dist = normalise(tel["Distance"].values)
            yield sse_event("track_layout", {
                "x": x, "y": y, "z": z,
                "distance": dist,
                "bounds": {
                    "minX": float(np.min(tel["X"])), "maxX": float(np.max(tel["X"])),
                    "minY": float(np.min(tel["Y"])), "maxY": float(np.max(tel["Y"])),
                },
                "length": float(tel["Distance"].max()),
            })
        except Exception as e:
            yield sse_event("warning", {"message": f"Track layout unavailable: {e}"})

        # ── 6. Per-driver telemetry ────────────────────────────────────────
        # Resolve which drivers to stream
        requested = [d.strip().upper() for d in drivers.split(",") if d.strip()] if drivers else []
        if not requested:
            # Default: top-5 fastest drivers
            try:
                top = session.laps.groupby("Driver")["LapTime"].min().nsmallest(5).index.tolist()
                requested = top
            except Exception:
                requested = []

        for driver_code in requested:
            try:
                lap = session.laps.pick_driver(driver_code).pick_fastest()
                if lap is None or lap.empty:
                    continue
                tel = lap.get_telemetry()
                yield sse_event("telemetry", {
                    "driver":    driver_code,
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
                })
            except Exception as e:
                yield sse_event("warning", {"message": f"Telemetry unavailable for {driver_code}: {e}"})

        # ── 7. Done ────────────────────────────────────────────────────────
        yield sse_event("complete", {"sessionId": session_id})

    return Response(
        stream(),
        mimetype="text/event-stream",
        headers={
            "Cache-Control":     "no-cache",
            "X-Accel-Buffering": "no",   # nginx: disable buffering
            "Connection":        "keep-alive",
        },
    )


@app.route("/api/session/lap")
def get_lap_telemetry():
    """
    GET /api/session/lap?year=2024&round=22&session=R&driver=NOR&lap=50

    Returns telemetry for one driver on one specific lap.
    The session is loaded from the FastF1 disk cache (instant if already cached).
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
        session = fastf1.get_session(year, round_n, s_type)
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
    GET /api/race/positions?year=2024&round=6&session=R

    SSE stream:
      connecting  → { message }
      race_start  → { sessionId, drivers, bounds, totalTime }
      driver_pos  → { code, t, x, y, status }   (one per driver, resampled at 1 Hz)
      complete    → {}
    """
    year    = request.args.get("year",    type=int)
    round_n = request.args.get("round",   type=int)
    s_type  = request.args.get("session", default="R")

    if not year or not round_n:
        return jsonify({"status": "error", "error": "Missing year or round"}), 400

    TEAM_COLORS = {
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

    def stream():
        yield sse_event("connecting", {"message": "Loading race session…"})

        try:
            session = fastf1.get_session(year, round_n, s_type)
            session.load(laps=True, telemetry=True, weather=False, messages=False)
        except Exception as e:
            yield sse_error(f"Session load failed: {e}")
            return

        session_id = f"{year}_{round_n:02d}_{s_type}"

        # ── Bounds from fastest lap ────────────────────────────────────────────
        try:
            sample_lap = session.laps.pick_fastest()
            tel_sample = sample_lap.get_telemetry()
            bounds = {
                "minX": float(tel_sample["X"].min()),
                "maxX": float(tel_sample["X"].max()),
                "minY": float(tel_sample["Y"].min()),
                "maxY": float(tel_sample["Y"].max()),
            }
        except Exception as e:
            yield sse_error(f"Failed to get track bounds: {e}")
            return

        # ── Total race duration (seconds) ──────────────────────────────────────
        total_time = 5400.0  # fallback 90 min
        try:
            # Use session end time from results or last lap finish
            if not session.results.empty and "Time" in session.results.columns:
                winner_time = session.results.iloc[0]["Time"]
                if pd.notna(winner_time):
                    total_time = float(winner_time.total_seconds())
        except Exception:
            pass

        # ── Driver metadata ────────────────────────────────────────────────────
        driver_info = []
        driver_codes = []
        try:
            driver_codes = sorted(session.laps["Driver"].dropna().unique().tolist())
        except Exception:
            pass

        for code in driver_codes:
            color = "#00D9FF"
            team  = "Unknown"
            full_name = code
            number = 0
            position = None
            try:
                if not session.results.empty:
                    row = session.results[session.results["Abbreviation"] == code]
                    if not row.empty:
                        r = row.iloc[0]
                        team      = str(r.get("TeamName", "") or "")
                        color     = TEAM_COLORS.get(team, "#00D9FF")
                        full_name = str(r.get("FullName", code) or code)
                        num_val   = r.get("DriverNumber")
                        number    = int(num_val) if num_val is not None and not pd.isna(num_val) else 0
                        pos_val   = r.get("Position")
                        position  = int(pos_val) if pos_val is not None and not pd.isna(pos_val) else None
            except Exception:
                pass
            driver_info.append({
                "code":     code,
                "fullName": full_name,
                "team":     team,
                "number":   number,
                "color":    color,
                "position": position,
            })

        yield sse_event("race_start", {
            "sessionId": session_id,
            "drivers":   driver_info,
            "bounds":    bounds,
            "totalTime": total_time,
        })

        # ── Per-driver position stream (resampled at 1 Hz) ─────────────────────
        for code in driver_codes:
            try:
                drv_laps = session.laps.pick_driver(code)
                tels = []
                for _, lap in drv_laps.iterlaps():
                    try:
                        lt = lap.get_telemetry()
                        if not lt.empty:
                            tels.append(lt[["SessionTime", "X", "Y", "Status"]]
                                        if "Status" in lt.columns
                                        else lt[["SessionTime", "X", "Y"]].assign(Status="OnTrack"))
                    except Exception:
                        continue

                if not tels:
                    continue

                full_tel = pd.concat(tels, ignore_index=True).sort_values("SessionTime")
                t_raw = full_tel["SessionTime"].dt.total_seconds().values.astype(float)
                x_raw = full_tel["X"].values.astype(float)
                y_raw = full_tel["Y"].values.astype(float)
                status_raw = full_tel["Status"].fillna("OnTrack").values.tolist()

                # Remove duplicates and sort
                mask = np.diff(t_raw, prepend=t_raw[0] - 1) > 0
                t_raw = t_raw[mask]
                x_raw = x_raw[mask]
                y_raw = y_raw[mask]
                status_raw = [status_raw[i] for i in range(len(status_raw)) if mask[i]]

                if len(t_raw) < 2:
                    continue

                # Resample at 1 Hz
                t_out = np.arange(t_raw[0], t_raw[-1], 1.0)
                x_out = np.interp(t_out, t_raw, x_raw)
                y_out = np.interp(t_out, t_raw, y_raw)

                # Nearest-neighbour status
                idx_arr = np.searchsorted(t_raw, t_out).clip(0, len(status_raw) - 1)
                status_out = [str(status_raw[int(i)]) for i in idx_arr]

                # Expand bounds to include pit-lane excursions
                bx_min = float(min(bounds["minX"], x_out.min()))
                bx_max = float(max(bounds["maxX"], x_out.max()))
                by_min = float(min(bounds["minY"], y_out.min()))
                by_max = float(max(bounds["maxY"], y_out.max()))
                bounds["minX"] = bx_min; bounds["maxX"] = bx_max
                bounds["minY"] = by_min; bounds["maxY"] = by_max

                yield sse_event("driver_pos", {
                    "code":   code,
                    "t":      normalise(t_out),
                    "x":      normalise(x_out),
                    "y":      normalise(y_out),
                    "status": status_out,
                })
                time.sleep(0.02)
            except Exception as e:
                yield sse_event("warning", {"message": f"Position data unavailable for {code}: {e}"})

        yield sse_event("complete", {})

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
    """
    Derive session pills from FastF1 event schedule row.
    Session1..Session5 columns contain names like 'Practice 1', 'Qualifying', 'Sprint', etc.
    """
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
    # Guarantee at least a Race pill so the card always has something to click
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
    print("🏎  F1 Telemetry Python service starting on http://localhost:5000")
    app.run(host="0.0.0.0", port=5000, debug=False, threaded=True)
