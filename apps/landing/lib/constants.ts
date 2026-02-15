export const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL || 'https://brickquest.app';

export const APP_URL =
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:7031'
    : 'https://app.brick-quest.park-labs.com';
