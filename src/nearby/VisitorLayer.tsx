import { useEffect, useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { CharacterRig } from '../character/CharacterRig';
import { LcdBubble } from '../character/LcdBubble';
import { GRID } from '../character/pixel/stickman';
import { POSES, type CharacterState } from '../character/states';
import { getBrain } from '../character/useCharacterBrain';
import { makeGeometry, projectX, projectY, WORLD } from '../physics/geometry';
import { useVirtualBody } from '../physics/useVirtualBody';
import { usePoseValues, useWorld } from '../physics/World';
import { bondLevel, idleUnlocked } from '../progression/progression';
import { grantXp, reachMilestone } from '../progression/rewards';
import { useReduceMotion } from '../services/motion';
import { useGame } from '../state/gameStore';
import { useMemories } from '../state/memoryStore';
import { useUi } from '../state/uiStore';

/**
 * Plays a (simulated) visit: another stickman walks in, the two say hi, hop
 * and dance together, then the visitor leaves. Afterwards the user can choose
 * to keep the visit as a memory.
 */
export function VisitorLayer({ roomWidth, roomHeight }: { roomWidth: number; roomHeight: number }) {
  const visitor = useUi((s) => s.visitor);
  const world = useWorld();
  const g = useMemo(() => makeGeometry(roomWidth, roomHeight), [roomWidth, roomHeight]);
  const size = GRID * g.dot;
  const guest = useVirtualBody(WORLD.xMax, 0.34);
  const pose = usePoseValues(0);
  const reduceMotion = useReduceMotion();
  const [state, setState] = useState<CharacterState>('idle');
  const [speech, setSpeech] = useState<string | null>(null);

  useEffect(() => {
    if (!visitor) return;
    let cancelled = false;
    const brain = getBrain();
    const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
    const guestState = (s: CharacterState) => {
      setState(s);
      const p = POSES[s];
      const d = { duration: 260 };
      pose.armL.set(withTiming(p.armL, d));
      pose.armR.set(withTiming(p.armR, d));
      pose.bounce.set(withTiming(p.bounce, d));
      pose.sway.set(withTiming(p.sway, d));
      pose.wave.set(withTiming(s === 'waving' ? 1 : 0, d));
    };
    const dance = idleDanceUnlocked();

    (async () => {
      pose.visible.set(withTiming(1, { duration: 500 }));
      brain?.setState('surprised');
      brain?.emote('exclaim', 1200);
      world.commands.walkTo(0.36, 0.32, 0.32);
      guestState('walking');
      guest.walkTo(0.64, 0.32, 0.3);
      await wait(1800);
      if (cancelled) return;
      guestState('waving');
      setSpeech(`Hi! I’m ${visitor.name}!`);
      brain?.setState('waving');
      brain?.say('A friend!', 2000);
      await wait(2400);
      if (cancelled) return;
      setSpeech(null);
      guestState('excited');
      brain?.setState('excited');
      for (let i = 0; i < 3 && !cancelled; i++) {
        world.commands.hop(1.4);
        await wait(320);
        guest.hop(1.4);
        await wait(480);
      }
      if (cancelled) return;
      guestState(dance ? 'dancing' : 'happy');
      brain?.setState(dance ? 'dancing' : 'happy');
      brain?.emote('note', 2500);
      await wait(3000);
      if (cancelled) return;
      guestState('waving');
      setSpeech('Bye! See you!');
      brain?.setState('waving');
      await wait(1600);
      setSpeech(null);
      guestState('walking');
      guest.walkTo(WORLD.xMax, 0.34, 0.32);
      await wait(1300);
      pose.visible.set(withTiming(0, { duration: 500 }));
      brain?.setState('happy');
      await wait(700);
      if (cancelled) return;
      finishVisit(visitor.name);
    })();

    return () => {
      cancelled = true;
    };
    // Runs once per visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitor]);

  if (!visitor) return null;
  return (
    <>
      <CharacterRig
        body={guest.body}
        pose={pose}
        clock={world.clock}
        geo={world.geo}
        size={size}
        accessory={visitor.appearance.accessory}
        state={state}
        seed={7}
        reduceMotion={reduceMotion}
      />
      {speech && <GuestBubble text={speech} body={guest.body} dot={g.dot} />}
    </>
  );
}

function GuestBubble({ text, body, dot }: { text: string; body: ReturnType<typeof useVirtualBody>['body']; dot: number }) {
  const { geo } = useWorld();
  const style = useAnimatedStyle(() => {
    const g = geo.value;
    const b = body.value;
    return {
      transform: [
        { translateX: Math.round(Math.min(projectX(g, b.x, b.z) - 60, g.R0 - 130) / g.dot) * g.dot },
        { translateY: Math.round((projectY(g, b.z, b.y + WORLD.charHeight) - 44) / g.dot) * g.dot },
      ],
    };
  });
  return (
    <Animated.View pointerEvents="none" entering={FadeIn} exiting={FadeOut} style={[styles.bubble, style]}>
      <LcdBubble text={text} dot={dot} />
    </Animated.View>
  );
}

function idleDanceUnlocked(): boolean {
  return idleUnlocked('dance', bondLevel(useGame.getState().progress.bondXp));
}

function finishVisit(name: string) {
  const game = useGame.getState();
  game.bumpStat('visits');
  game.logActivity('visit', `had a visit from ${name} (a simulated friend)`);
  game.nudgeMood(0.08, -0.03);
  grantXp('visit');
  reachMilestone('first-visit');
  useUi.getState().setVisitor(null);
  useUi.getState().toast({
    text: `${name} visited! Keep it as a memory?`,
    tone: 'info',
    action: {
      label: 'Save',
      onPress: () =>
        useMemories.getState().add({
          type: 'encounter',
          content: `${name} came to visit and we danced (simulated nearby visit).`,
          tags: ['visit'],
          importance: 1,
          related: { kind: 'nearby' },
          source: 'app',
        }),
    },
  });
}

const styles = StyleSheet.create({
  bubble: { position: 'absolute', left: 0, top: 0, maxWidth: 190 },
});
