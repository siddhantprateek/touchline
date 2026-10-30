// Shape of the bundled match data. Coordinates are StatsBomb pitch units
// (120 x 80) in a fixed frame where the home team attacks +x all match.

export type Key2 = [t: number, x: number, y: number]
export type Key3 = [t: number, x: number, y: number, z: number]

export interface TeamInfo {
  id: number
  name: string
  short: string
}

export interface PlayerInfo {
  id: number
  name: string
  short: string
  number: number
  position: string
  team: 0 | 1
  /** Match-clock seconds of each on-ball action, sorted. */
  touches: number[]
}

export interface FormationSlot {
  playerId: number
  x: number
  y: number
}

export interface FormationSpan {
  fromSec: number
  slots: FormationSlot[]
}

export interface ReplayToken {
  team: 0 | 1
  /** null = anonymous dot from 360 data. */
  playerId: number | null
  keys: Key2[]
}

export interface Replay {
  durationSec: number
  ball: Key3[]
  tokens: ReplayToken[]
  shot: { from: [number, number]; to: [number, number, number] }
}

export interface Moment {
  id: string
  sec: number
  label: string
  team: 0 | 1
  playerId: number
  isGoal: boolean
  isPenalty: boolean
  replay: Replay
}

export interface MatchData {
  matchId: number
  home: TeamInfo
  away: TeamInfo
  endSec: number
  players: PlayerInfo[]
  formations: [FormationSpan[], FormationSpan[]]
  moments: Moment[]
  goals: { sec: number; team: 0 | 1 }[]
}
