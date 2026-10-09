# Nearby characters: status and plan

## Today

Play → **Nearby friends** runs `createSimulatedNearby()`
(`src/nearby/simulatedNearby.ts`): a local stand-in that uses no radios and
finds no real devices. Every screen of the flow is labeled *Simulation*.
It exercises the full experience:

1. Explanation of what nearby play will do and what it shares.
2. "Searching" → a simulated friend appears.
3. Invite → simulated approval (real version: both people must approve).
4. A visiting character walks in, says hi, hops and dances with yours, and
   leaves (`src/nearby/VisitorLayer.tsx`).
5. A toast asks whether to keep the visit as a memory — nothing is saved
   unless the user taps **Save**.

The UI only talks to the `NearbyService` interface
(`src/nearby/types.ts`), so a real transport can replace the simulation.

## Why not GPS, NFC, or "the phones just know"

- Phones can't sense each other through motion or proximity on their own.
- **GPS** doesn't measure phone-to-phone distance and would be a needless
  location-privacy cost.
- **NFC** is a deliberate touch-to-tap gesture with ~4 cm range. iOS doesn't
  offer general NFC peer-to-peer between phones. It could later serve as an
  optional "tap to pair" shortcut, not for discovery.

## Recommended transport

**Bluetooth Low Energy** works cross-platform (iOS ↔ Android):

- Each phone, while the Nearby screen is open, **advertises** a Cubeit
  service UUID with a short, rotating, random session id, and **scans** for
  the same UUID.
- On discovery, one side connects (GATT) and the two exchange a tiny JSON
  hello: protocol version, character name, appearance. No user name,
  account, device id or location.
- Both users see the other character and must both tap **Accept**. Then a
  "visit" message starts the animation on both phones. Then disconnect.

Platform alternatives that are simpler but single-platform: Apple
**MultipeerConnectivity** (iOS ↔ iOS) and Google **Nearby Connections**
(Android ↔ Android). They could sit behind the same `NearbyService`.

### Implementation notes

- `react-native-ble-plx` covers scanning and connecting (central role) but
  not advertising. The peripheral role (advertise + GATT server) needs a
  small custom **Expo module** (Swift `CBPeripheralManager`, Kotlin
  `BluetoothLeAdvertiser` / `BluetoothGattServer`) or a maintained library.
  Either way this requires a **development build**, not Expo Go.
- Permissions:
  - iOS: `NSBluetoothAlwaysUsageDescription`. Advertising is foreground-only
    in practice (background advertising hides service UUIDs), which fits a
    screen-open design.
  - Android 12+: `BLUETOOTH_SCAN` (with `neverForLocation`),
    `BLUETOOTH_ADVERTISE`, `BLUETOOTH_CONNECT`. Android ≤ 11:
    `ACCESS_FINE_LOCATION` for scanning.
  - Ask only when the user opens Nearby, after explaining why.
- Battery: scan and advertise only while the screen is open, with a
  timeout (e.g. 60 s) and a "search again" button.
- Reliability: expect flaky connections; time out every step, retry once,
  and keep the visit animation local once both sides have accepted.
- Safety: ephemeral ids, explicit two-sided consent, the ability to decline
  or ignore, no history of who was nearby, memories only on request.

## Mapping to the interface

| `NearbyService` | BLE implementation |
| --- | --- |
| `availability()` | Bluetooth supported and powered on |
| `requestPermissions()` | Platform permission prompts above |
| `startDiscovery(onPeer)` | Advertise + scan; parse hello; dedupe by session id |
| `invite(peer)` | Write an invite; wait for the peer's accept / decline / timeout |
