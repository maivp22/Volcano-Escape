import { nanoid } from 'nanoid';

export const generateRoomCode = () => {
  return nanoid(6).toUpperCase();
};

export const getRandomPosition = (gridSize: number) => {
  return {
    x: Math.floor(Math.random() * gridSize),
    y: Math.floor(Math.random() * gridSize),
  };
};
