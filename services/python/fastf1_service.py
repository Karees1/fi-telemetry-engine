"""
F1 Telemetry Dashboard - FastF1 Service
Handles all F1 data fetching and processing
"""

import os
import json
import fastf1
import fastf1.plotting
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, asdict
import numpy as np

# Enable caching to avoid re-downloading data
CACHE_DIR = './cache'
if not os.path.exists(CACHE_DIR):
    os.makedirs(CACHE_DIR)

fastf1.Cache.enable_cache(CACHE_DIR)
fastf1.plotting.setup_mpl(misc_mpl_mods=False)


@dataclass
class RaceMetadata:
    """Metadata about a race"""
    id: str
    year: int
    round: int
    name: str
    date: str
    circuit_name: str
    circuit_location: str


@dataclass
class TelemetryPoint:
    """Single telemetry data point"""
    timestamp: float
    distance: float
    speed: float
    throttle: float
    brake: float
    gear: int
    drs: int
    x: float
    y: float
    z: Optional[float] = None


class FastF1Service:
    """
    Service layer for FastF1 API interactions
    Handles session loading, caching, and data transformation
    """

    def __init__(self):
        self.cache_dir = CACHE_DIR
        self.sessions_cache: Dict = {}

    def get_available_races(self, year: int) -> List[RaceMetadata]:
        """
        Fetch available races for a given year
        
        Args:
            year: F1 season year (e.g., 2024, 2025)
        
        Returns:
            List of RaceMetadata objects
        """
        try:
            schedule = fastf1.get_event_schedule(year)
            races = []
            
            for _, race in schedule.iterrows():
                race_meta = RaceMetadata(
                    id=f"{year}_{race['RoundNumber']}",
                    year=year,
                    round=race['RoundNumber'],
                    name=race['EventName'],
                    date=str(race['EventDate']),
                    circuit_name=race['Location'],
                    circuit_location=race['Country'],
                )
                races.append(race_meta)
            
            return races
        except Exception as e:
            print(f"Error fetching races: {e}")
            return []

    def load_session(
        self,
        year: int,
        round_num: int,
        session_type: str = 'R'
    ):
        """
        Load a F1 session from FastF1 API
        
        Args:
            year: Season year
            round_num: Race round number (1-24)
            session_type: 'FP1', 'FP2', 'FP3', 'Q', 'R' (Race)
        
        Returns:
            FastF1 session object
        """
        try:
            session = fastf1.get_session(year, round_num, session_type)
            session.load()
            return session
        except Exception as e:
            print(f"Error loading session: {e}")
            return None

    def extract_telemetry(
        self,
        session,
        driver_code: str
    ) -> Optional[List[TelemetryPoint]]:
        """
        Extract telemetry data for a specific driver's fastest lap
        
        Args:
            session: FastF1 session object
            driver_code: 3-letter driver code (e.g., 'HAM', 'LEC')
        
        Returns:
            List of TelemetryPoint objects
        """
        try:
            lap = session.laps.pick_driver(driver_code).pick_fastest()
            if lap is None:
                return None
            
            telemetry = lap.get_telemetry()
            
            # Transform to our data structure
            points = []
            for idx, row in telemetry.iterrows():
                point = TelemetryPoint(
                    timestamp=float(idx),
                    distance=float(row['Distance']),
                    speed=float(row['Speed']),
                    throttle=float(row['Throttle']),
                    brake=float(row['Brake']),
                    gear=int(row['Gear']),
                    drs=int(row.get('DRS', 0)),
                    x=float(row['X']),
                    y=float(row['Y']),
                    z=float(row.get('Z', 0)),
                )
                points.append(point)
            
            return points
        except Exception as e:
            print(f"Error extracting telemetry for {driver_code}: {e}")
            return None

    def get_lap_comparison(
        self,
        session,
        driver1: str,
        driver2: str
    ) -> Tuple[Optional[List[TelemetryPoint]], Optional[List[TelemetryPoint]]]:
        """
        Get telemetry for two drivers to compare
        
        Args:
            session: FastF1 session
            driver1: Driver 1 code
            driver2: Driver 2 code
        
        Returns:
            Tuple of (driver1_telemetry, driver2_telemetry)
        """
        tel1 = self.extract_telemetry(session, driver1)
        tel2 = self.extract_telemetry(session, driver2)
        return tel1, tel2

    def get_track_boundaries(self, session) -> Dict:
        """
        Extract track boundaries and layout
        
        Args:
            session: FastF1 session
        
        Returns:
            Dict with track coordinates and boundaries
        """
        try:
            # Get any fastest lap to extract track coordinates
            laps = session.laps[session.laps['Pole Position'] == True]
            if len(laps) == 0:
                laps = session.laps.pick_fastest()
            
            if isinstance(laps, list) and len(laps) > 0:
                lap = laps[0]
            else:
                lap = laps
            
            telemetry = lap.get_telemetry()
            
            x_coords = np.array(telemetry['X'].values)
            y_coords = np.array(telemetry['Y'].values)
            
            return {
                'bounds': {
                    'minX': float(x_coords.min()),
                    'maxX': float(x_coords.max()),
                    'minY': float(y_coords.min()),
                    'maxY': float(y_coords.max()),
                },
                'length': float(telemetry['Distance'].max()),
            }
        except Exception as e:
            print(f"Error extracting track boundaries: {e}")
            return {}

    def export_to_json(self, data: List[TelemetryPoint]) -> str:
        """Convert telemetry to JSON"""
        return json.dumps(
            [asdict(point) for point in data],
            default=str
        )


# ============================================
# EXAMPLE USAGE
# ============================================
if __name__ == '__main__':
    service = FastF1Service()
    
    # Get 2024 races
    races = service.get_available_races(2024)
    print(f"Found {len(races)} races in 2024")
    
    # Load a session
    session = service.load_session(2024, 'Monza', 'Q')
    
    # Extract telemetry
    if session:
        telemetry = service.extract_telemetry(session, 'HAM')
        print(f"Extracted {len(telemetry)} telemetry points")
