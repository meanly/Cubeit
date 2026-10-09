import type { ComponentType } from 'react';

import { CustomizePanel } from './CustomizePanel';
import { NearbyPanel } from './NearbyPanel';
import { NotificationsPanel } from './NotificationsPanel';
import type { OpenPanel } from './PanelHost';
import { PlannerPanel } from './planner/PlannerPanel';
import { PlayPanel } from './PlayPanel';
import { TalkPanel } from './TalkPanel';

export const PANELS: Record<OpenPanel, ComponentType> = {
  talk: TalkPanel,
  play: PlayPanel,
  customize: CustomizePanel,
  planner: PlannerPanel,
  nearby: NearbyPanel,
  notifications: NotificationsPanel,
};
