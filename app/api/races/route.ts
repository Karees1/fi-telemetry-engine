import { NextRequest, NextResponse } from 'next/server';
import { ApiResponse, Race, SessionType } from '@/types';

const STANDARD_SESSIONS: SessionType[] = ['FP1', 'FP2', 'FP3', 'Q', 'R'];
const SPRINT_SESSIONS:   SessionType[] = ['FP1', 'SQ', 'S', 'Q', 'R'];

// Sprint weekends in 2024 by round number
const SPRINT_ROUNDS_2024 = new Set([5, 6, 11, 19, 21, 23]);

const RACES_2024: Race[] = [
  { id: '2024_01', year: 2024, round: 1,  name: 'Bahrain Grand Prix',         date: '2024-03-02', circuit: { id: 'bahrain',       name: 'Bahrain International Circuit',         location: 'Sakhir, Bahrain' },          sessions: STANDARD_SESSIONS },
  { id: '2024_02', year: 2024, round: 2,  name: 'Saudi Arabian Grand Prix',   date: '2024-03-09', circuit: { id: 'jeddah',        name: 'Jeddah Corniche Circuit',               location: 'Jeddah, Saudi Arabia' },      sessions: STANDARD_SESSIONS },
  { id: '2024_03', year: 2024, round: 3,  name: 'Australian Grand Prix',      date: '2024-03-24', circuit: { id: 'albert_park',   name: 'Albert Park Circuit',                   location: 'Melbourne, Australia' },      sessions: STANDARD_SESSIONS },
  { id: '2024_04', year: 2024, round: 4,  name: 'Japanese Grand Prix',        date: '2024-04-07', circuit: { id: 'suzuka',        name: 'Suzuka International Racing Course',     location: 'Suzuka, Japan' },             sessions: STANDARD_SESSIONS },
  { id: '2024_05', year: 2024, round: 5,  name: 'Chinese Grand Prix',         date: '2024-04-21', circuit: { id: 'shanghai',      name: 'Shanghai International Circuit',        location: 'Shanghai, China' },           sessions: SPRINT_SESSIONS },
  { id: '2024_06', year: 2024, round: 6,  name: 'Miami Grand Prix',           date: '2024-05-05', circuit: { id: 'miami',         name: 'Miami International Autodrome',         location: 'Miami, USA' },                sessions: SPRINT_SESSIONS },
  { id: '2024_07', year: 2024, round: 7,  name: 'Emilia Romagna Grand Prix',  date: '2024-05-19', circuit: { id: 'imola',         name: 'Autodromo Enzo e Dino Ferrari',         location: 'Imola, Italy' },              sessions: STANDARD_SESSIONS },
  { id: '2024_08', year: 2024, round: 8,  name: 'Monaco Grand Prix',          date: '2024-05-26', circuit: { id: 'monaco',        name: 'Circuit de Monaco',                     location: 'Monte Carlo, Monaco' },       sessions: STANDARD_SESSIONS },
  { id: '2024_09', year: 2024, round: 9,  name: 'Canadian Grand Prix',        date: '2024-06-09', circuit: { id: 'montreal',      name: 'Circuit Gilles Villeneuve',             location: 'Montréal, Canada' },          sessions: STANDARD_SESSIONS },
  { id: '2024_10', year: 2024, round: 10, name: 'Spanish Grand Prix',         date: '2024-06-23', circuit: { id: 'barcelona',     name: 'Circuit de Barcelona-Catalunya',        location: 'Barcelona, Spain' },          sessions: STANDARD_SESSIONS },
  { id: '2024_11', year: 2024, round: 11, name: 'Austrian Grand Prix',        date: '2024-06-30', circuit: { id: 'red_bull_ring', name: 'Red Bull Ring',                         location: 'Spielberg, Austria' },        sessions: SPRINT_SESSIONS },
  { id: '2024_12', year: 2024, round: 12, name: 'British Grand Prix',         date: '2024-07-07', circuit: { id: 'silverstone',   name: 'Silverstone Circuit',                   location: 'Silverstone, UK' },           sessions: STANDARD_SESSIONS },
  { id: '2024_13', year: 2024, round: 13, name: 'Hungarian Grand Prix',       date: '2024-07-21', circuit: { id: 'hungaroring',   name: 'Hungaroring',                           location: 'Budapest, Hungary' },         sessions: STANDARD_SESSIONS },
  { id: '2024_14', year: 2024, round: 14, name: 'Belgian Grand Prix',         date: '2024-07-28', circuit: { id: 'spa',           name: 'Circuit de Spa-Francorchamps',          location: 'Spa, Belgium' },              sessions: STANDARD_SESSIONS },
  { id: '2024_15', year: 2024, round: 15, name: 'Dutch Grand Prix',           date: '2024-08-25', circuit: { id: 'zandvoort',     name: 'Circuit Zandvoort',                     location: 'Zandvoort, Netherlands' },    sessions: STANDARD_SESSIONS },
  { id: '2024_16', year: 2024, round: 16, name: 'Italian Grand Prix',         date: '2024-09-01', circuit: { id: 'monza',         name: 'Autodromo Nazionale Monza',             location: 'Monza, Italy' },              sessions: STANDARD_SESSIONS },
  { id: '2024_17', year: 2024, round: 17, name: 'Azerbaijan Grand Prix',      date: '2024-09-15', circuit: { id: 'baku',          name: 'Baku City Circuit',                     location: 'Baku, Azerbaijan' },          sessions: STANDARD_SESSIONS },
  { id: '2024_18', year: 2024, round: 18, name: 'Singapore Grand Prix',       date: '2024-09-22', circuit: { id: 'singapore',     name: 'Marina Bay Street Circuit',             location: 'Singapore' },                 sessions: STANDARD_SESSIONS },
  { id: '2024_19', year: 2024, round: 19, name: 'United States Grand Prix',   date: '2024-10-20', circuit: { id: 'cota',          name: 'Circuit of The Americas',               location: 'Austin, USA' },               sessions: SPRINT_SESSIONS },
  { id: '2024_20', year: 2024, round: 20, name: 'Mexico City Grand Prix',     date: '2024-10-27', circuit: { id: 'mexico',        name: 'Autódromo Hermanos Rodríguez',          location: 'Mexico City, Mexico' },       sessions: STANDARD_SESSIONS },
  { id: '2024_21', year: 2024, round: 21, name: 'São Paulo Grand Prix',       date: '2024-11-03', circuit: { id: 'interlagos',    name: 'Autódromo José Carlos Pace',            location: 'São Paulo, Brazil' },         sessions: SPRINT_SESSIONS },
  { id: '2024_22', year: 2024, round: 22, name: 'Las Vegas Grand Prix',       date: '2024-11-23', circuit: { id: 'las_vegas',     name: 'Las Vegas Strip Circuit',               location: 'Las Vegas, USA' },            sessions: STANDARD_SESSIONS },
  { id: '2024_23', year: 2024, round: 23, name: 'Qatar Grand Prix',           date: '2024-12-01', circuit: { id: 'lusail',        name: 'Lusail International Circuit',          location: 'Lusail, Qatar' },             sessions: SPRINT_SESSIONS },
  { id: '2024_24', year: 2024, round: 24, name: 'Abu Dhabi Grand Prix',       date: '2024-12-08', circuit: { id: 'yas_marina',    name: 'Yas Marina Circuit',                    location: 'Abu Dhabi, UAE' },            sessions: STANDARD_SESSIONS },
];

const RACES_2023: Race[] = [
  { id: '2023_01', year: 2023, round: 1,  name: 'Bahrain Grand Prix',        date: '2023-03-05', circuit: { id: 'bahrain',       name: 'Bahrain International Circuit',        location: 'Sakhir, Bahrain' },         sessions: STANDARD_SESSIONS },
  { id: '2023_02', year: 2023, round: 2,  name: 'Saudi Arabian Grand Prix',  date: '2023-03-19', circuit: { id: 'jeddah',        name: 'Jeddah Corniche Circuit',              location: 'Jeddah, Saudi Arabia' },     sessions: STANDARD_SESSIONS },
  { id: '2023_03', year: 2023, round: 3,  name: 'Australian Grand Prix',     date: '2023-04-02', circuit: { id: 'albert_park',   name: 'Albert Park Circuit',                  location: 'Melbourne, Australia' },     sessions: STANDARD_SESSIONS },
  { id: '2023_04', year: 2023, round: 4,  name: 'Azerbaijan Grand Prix',     date: '2023-04-30', circuit: { id: 'baku',          name: 'Baku City Circuit',                    location: 'Baku, Azerbaijan' },         sessions: STANDARD_SESSIONS },
  { id: '2023_05', year: 2023, round: 5,  name: 'Miami Grand Prix',          date: '2023-05-07', circuit: { id: 'miami',         name: 'Miami International Autodrome',        location: 'Miami, USA' },               sessions: STANDARD_SESSIONS },
  { id: '2023_06', year: 2023, round: 6,  name: 'Monaco Grand Prix',         date: '2023-05-28', circuit: { id: 'monaco',        name: 'Circuit de Monaco',                    location: 'Monte Carlo, Monaco' },      sessions: STANDARD_SESSIONS },
  { id: '2023_07', year: 2023, round: 7,  name: 'Spanish Grand Prix',        date: '2023-06-04', circuit: { id: 'barcelona',     name: 'Circuit de Barcelona-Catalunya',       location: 'Barcelona, Spain' },         sessions: STANDARD_SESSIONS },
  { id: '2023_08', year: 2023, round: 8,  name: 'Canadian Grand Prix',       date: '2023-06-18', circuit: { id: 'montreal',      name: 'Circuit Gilles Villeneuve',            location: 'Montréal, Canada' },         sessions: STANDARD_SESSIONS },
  { id: '2023_09', year: 2023, round: 9,  name: 'Austrian Grand Prix',       date: '2023-07-02', circuit: { id: 'red_bull_ring', name: 'Red Bull Ring',                        location: 'Spielberg, Austria' },       sessions: STANDARD_SESSIONS },
  { id: '2023_10', year: 2023, round: 10, name: 'British Grand Prix',        date: '2023-07-09', circuit: { id: 'silverstone',   name: 'Silverstone Circuit',                  location: 'Silverstone, UK' },          sessions: STANDARD_SESSIONS },
  { id: '2023_11', year: 2023, round: 11, name: 'Hungarian Grand Prix',      date: '2023-07-23', circuit: { id: 'hungaroring',   name: 'Hungaroring',                          location: 'Budapest, Hungary' },        sessions: STANDARD_SESSIONS },
  { id: '2023_12', year: 2023, round: 12, name: 'Belgian Grand Prix',        date: '2023-07-30', circuit: { id: 'spa',           name: 'Circuit de Spa-Francorchamps',         location: 'Spa, Belgium' },             sessions: STANDARD_SESSIONS },
  { id: '2023_13', year: 2023, round: 13, name: 'Dutch Grand Prix',          date: '2023-08-27', circuit: { id: 'zandvoort',     name: 'Circuit Zandvoort',                    location: 'Zandvoort, Netherlands' },   sessions: STANDARD_SESSIONS },
  { id: '2023_14', year: 2023, round: 14, name: 'Italian Grand Prix',        date: '2023-09-03', circuit: { id: 'monza',         name: 'Autodromo Nazionale Monza',            location: 'Monza, Italy' },             sessions: STANDARD_SESSIONS },
  { id: '2023_15', year: 2023, round: 15, name: 'Singapore Grand Prix',      date: '2023-09-17', circuit: { id: 'singapore',     name: 'Marina Bay Street Circuit',            location: 'Singapore' },                sessions: STANDARD_SESSIONS },
  { id: '2023_16', year: 2023, round: 16, name: 'Japanese Grand Prix',       date: '2023-09-24', circuit: { id: 'suzuka',        name: 'Suzuka International Racing Course',    location: 'Suzuka, Japan' },            sessions: STANDARD_SESSIONS },
  { id: '2023_17', year: 2023, round: 17, name: 'Qatar Grand Prix',          date: '2023-10-08', circuit: { id: 'lusail',        name: 'Lusail International Circuit',         location: 'Lusail, Qatar' },            sessions: SPRINT_SESSIONS },
  { id: '2023_18', year: 2023, round: 18, name: 'United States Grand Prix',  date: '2023-10-22', circuit: { id: 'cota',          name: 'Circuit of The Americas',              location: 'Austin, USA' },              sessions: SPRINT_SESSIONS },
  { id: '2023_19', year: 2023, round: 19, name: 'Mexico City Grand Prix',    date: '2023-10-29', circuit: { id: 'mexico',        name: 'Autódromo Hermanos Rodríguez',         location: 'Mexico City, Mexico' },      sessions: STANDARD_SESSIONS },
  { id: '2023_20', year: 2023, round: 20, name: 'São Paulo Grand Prix',      date: '2023-11-05', circuit: { id: 'interlagos',    name: 'Autódromo José Carlos Pace',           location: 'São Paulo, Brazil' },        sessions: SPRINT_SESSIONS },
  { id: '2023_21', year: 2023, round: 21, name: 'Las Vegas Grand Prix',      date: '2023-11-18', circuit: { id: 'las_vegas',     name: 'Las Vegas Strip Circuit',              location: 'Las Vegas, USA' },           sessions: STANDARD_SESSIONS },
  { id: '2023_22', year: 2023, round: 22, name: 'Abu Dhabi Grand Prix',      date: '2023-11-26', circuit: { id: 'yas_marina',    name: 'Yas Marina Circuit',                   location: 'Abu Dhabi, UAE' },           sessions: STANDARD_SESSIONS },
];

const STATIC_SEASONS: Record<number, Race[]> = {
  2024: RACES_2024,
  2023: RACES_2023,
};

const PYTHON_URL = process.env.PYTHON_SERVICE_URL ?? 'http://localhost:5000';

/**
 * For 2023/2024 → return static data instantly (no Python needed).
 * For any other year → proxy to the Python FastF1 service.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const year = Number(searchParams.get('year') ?? '2024');

  // Fast path: static seasons
  if (STATIC_SEASONS[year]) {
    const response: ApiResponse<Race[]> = {
      status: 'success',
      data: STATIC_SEASONS[year],
      timestamp: Date.now(),
    };
    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' },
    });
  }

  // Slow path: delegate to Python FastF1 service for older/newer seasons
  try {
    const upstream = await fetch(`${PYTHON_URL}/api/races?year=${year}`, {
      next: { revalidate: 3600 },
    });

    if (!upstream.ok) {
      throw new Error(`Python service responded with ${upstream.status}`);
    }

    const body = await upstream.json() as ApiResponse<Race[]>;

    // The Python service returns races without session info — inject STANDARD_SESSIONS
    // (sprint weekend detection for non-static years is not yet implemented)
    if (body.status === 'success' && body.data) {
      body.data = body.data.map(r => ({ ...r, sessions: r.sessions ?? STANDARD_SESSIONS }));
    }

    return NextResponse.json(body, {
      headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' },
    });
  } catch (err) {
    const response: ApiResponse<Race[]> = {
      status: 'error',
      error: `Python service unavailable for year ${year}. Make sure fastf1_server.py is running.`,
      timestamp: Date.now(),
    };
    return NextResponse.json(response, { status: 503 });
  }
}
