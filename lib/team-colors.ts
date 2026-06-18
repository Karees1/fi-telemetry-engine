export const TEAM_COLORS: Record<string, string> = {
  'Red Bull Racing': '#3671C6',
  'Ferrari':         '#E8002D',
  'Mercedes':        '#27F4D2',
  'McLaren':         '#FF8000',
  'Aston Martin':    '#229971',
  'Alpine':          '#FF87BC',
  'Williams':        '#64C4FF',
  'RB':              '#6692FF',
  'Kick Sauber':     '#52E252',
  'Haas F1 Team':    '#B6BABD',
};

export function teamColor(teamName: string): string {
  return TEAM_COLORS[teamName] ?? '#00D9FF';
}
