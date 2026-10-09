import type { Appearance } from '../content/appearance';

/**
 * Nearby play, designed so a real transport can replace the simulation
 * without UI changes. See docs/NEARBY.md for the BLE / Multipeer / Nearby
 * Connections plan, permissions and platform limits.
 */
export interface NearbyPeer {
  /** Random per-session id — never a device identifier or anything personal. */
  id: string;
  /** Character name only. No user names, accounts or locations are shared. */
  name: string;
  appearance: Appearance;
  simulated: boolean;
}

export type InviteResult = 'accepted' | 'declined' | 'timeout';

export interface NearbyService {
  readonly kind: 'simulation' | 'ble';
  availability(): Promise<{ supported: boolean; detail: string }>;
  /** Ask for OS permissions (Bluetooth / nearby devices). Simulation needs none. */
  requestPermissions(): Promise<boolean>;
  /** Start looking for nearby characters; returns a stop function. */
  startDiscovery(onPeer: (peer: NearbyPeer) => void): () => void;
  /** Both sides must approve before anything happens. */
  invite(peer: NearbyPeer): Promise<InviteResult>;
}
