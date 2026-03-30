export const GRID_SIZE = 10;

export const getCellId = (x: number, y: number) => `${x}-${y}`;

export const getAdjacentCells = (x: number, y: number) => {
  const adjacent = [];
  if (x > 0) adjacent.push({ x: x - 1, y });
  if (x < GRID_SIZE - 1) adjacent.push({ x: x + 1, y });
  if (y > 0) adjacent.push({ x, y: y - 1 });
  if (y < GRID_SIZE - 1) adjacent.push({ x, y: y + 1 });
  return adjacent;
};

export const isAdjacent = (pos1: { x: number, y: number }, pos2: { x: number, y: number }) => {
  const dx = Math.abs(pos1.x - pos2.x);
  const dy = Math.abs(pos1.y - pos2.y);
  return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
};

export const getDangerZones = (count: number, occupiedCells: string[], excludedCells: string[] = []) => {
  const allCells = [];
  for (let x = 0; x < GRID_SIZE; x++) {
    for (let y = 0; y < GRID_SIZE; y++) {
      allCells.push(getCellId(x, y));
    }
  }

  // Filter out occupied cells and excluded cells (like safe zones)
  const availableCells = allCells.filter(id => !occupiedCells.includes(id) && !excludedCells.includes(id));
  
  const shuffled = [...availableCells].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};

export const getDifficulty = (activePlayersCount: number, round: number) => {
  // Check for special "Total Lava" round every 5 rounds
  const isTotalLavaRound = round > 0 && round % 5 === 0;

  if (isTotalLavaRound) {
    return {
      dangerCount: Math.floor(GRID_SIZE * GRID_SIZE * 0.6), // 60% of the board
      warningTime: 1000, // 1 second warning
      cooldownTime: 2000,
      isSpecial: true
    };
  }

  // Base difficulty from player count
  let base;
  if (activePlayersCount >= 10) {
    base = { dangerCount: 12, warningTime: 2000, cooldownTime: 3000 };
  } else if (activePlayersCount >= 8) {
    base = { dangerCount: 15, warningTime: 1900, cooldownTime: 2800 };
  } else if (activePlayersCount >= 6) {
    base = { dangerCount: 18, warningTime: 1800, cooldownTime: 2500 };
  } else if (activePlayersCount === 5) {
    base = { dangerCount: 22, warningTime: 1500, cooldownTime: 2200 };
  } else if (activePlayersCount === 4) {
    base = { dangerCount: 26, warningTime: 1300, cooldownTime: 2000 };
  } else if (activePlayersCount === 3) {
    base = { dangerCount: 30, warningTime: 1100, cooldownTime: 1800 };
  } else {
    base = { dangerCount: 35, warningTime: 900, cooldownTime: 1500 };
  }

  // Round-based additional scaling (e.g., +1 cell per round, -50ms warning)
  const roundBonus = Math.max(0, round - 1);
  return {
    dangerCount: base.dangerCount + (roundBonus * 2),
    warningTime: Math.max(500, base.warningTime - (roundBonus * 100)),
    cooldownTime: Math.max(1000, base.cooldownTime - (roundBonus * 100)),
    isSpecial: false
  };
};
