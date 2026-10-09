import type { NearbyPeer, NearbyService } from './types';

const FRIENDS: Omit<NearbyPeer, 'id' | 'simulated'>[] = [
  { name: 'Nova', appearance: { bodyColor: 'mint', accessory: 'bow' } },
  { name: 'Biscuit', appearance: { bodyColor: 'peach', accessory: 'beanie' } },
  { name: 'Tiko', appearance: { bodyColor: 'sky', accessory: 'headphones' } },
  { name: 'Mochi', appearance: { bodyColor: 'lemon', accessory: 'sprout' } },
];

/**
 * A purely local stand-in for nearby discovery. It uses no radios, finds no
 * real devices, and every peer it produces is flagged `simulated: true` and
 * labeled as such in the UI.
 */
export function createSimulatedNearby(rng: () => number = Math.random): NearbyService {
  return {
    kind: 'simulation',
    availability: async () => ({
      supported: true,
      detail: 'Simulation only — no Bluetooth is used and no real devices are discovered.',
    }),
    requestPermissions: async () => true,
    startDiscovery(onPeer) {
      const friend = FRIENDS[Math.floor(rng() * FRIENDS.length)];
      const timer = setTimeout(
        () => onPeer({ ...friend, id: `sim-${Math.floor(rng() * 1e9).toString(36)}`, simulated: true }),
        1600 + rng() * 1400,
      );
      return () => clearTimeout(timer);
    },
    invite: () => new Promise((resolve) => setTimeout(() => resolve('accepted'), 1500 + rng() * 1000)),
  };
}
