import type { ComponentType } from 'react';

import { CustomizePanel } from './CustomizePanel';
import { MemoriesPanel } from './MemoriesPanel';
import { NearbyPanel } from './NearbyPanel';
import type { OpenPanel } from './PanelHost';
import { PlayPanel } from './PlayPanel';
import { TalkPanel } from './TalkPanel';

export const PANELS: Record<OpenPanel, ComponentType> = {
  talk: TalkPanel,
  play: PlayPanel,
  customize: CustomizePanel,
  memories: MemoriesPanel,
  nearby: NearbyPanel,
};
