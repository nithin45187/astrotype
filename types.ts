export interface WordEntity {
  id: string;
  text: string;
  x: number; // Percentage 0-100
  y: number; // Percentage 0-100
  speed: number;
  typedIndex: number; // How many characters have been typed
  isTarget: boolean;
}

export enum GameState {
  IDLE,
  PLAYING,
  GAME_OVER,
}
