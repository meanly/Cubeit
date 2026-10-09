import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { cancelModelDownload, installModel, removeModel, resetModelError } from '../ai/modelManager';
import { formatBytes, MODEL } from '../ai/modelInfo';
import { useModel } from '../ai/modelStore';
import { useColors, useStyles, type Colors } from '../theme/theme';
import { fonts, radii } from '../theme/tokens';
import { confirm } from '../ui/Confirm';
import { Button } from '../ui/primitives';

/** Settings → Talking: download, verify, use and delete the on-device model. */
export function ModelSettings() {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const status = useModel((s) => s.status);
  const speed = useModel((s) => s.tokensPerSecond);

  const download = async () => {
    const ok = await confirm({
      title: `Download ${MODEL.name}?`,
      message: `${formatBytes(MODEL.sizeBytes)} from Hugging Face (${MODEL.license} license). Wi-Fi recommended. This is the only download Cubeit makes; afterwards the AI works offline and nothing you say leaves the phone.`,
      confirmLabel: 'Download',
    });
    if (ok) void installModel();
  };

  const remove = async () => {
    if (await confirm({ title: 'Delete the AI model?', message: `Frees ${formatBytes(MODEL.sizeBytes)}. Chats fall back to built-in replies; your data isn’t touched.`, confirmLabel: 'Delete', destructive: true })) {
      await removeModel();
    }
  };

  let body: ReactNode = null;
  switch (status.state) {
    case 'checking':
      body = <Text style={styles.hint}>Checking…</Text>;
      break;
    case 'unsupported':
      body = <Text style={styles.hint}>{status.reason}</Text>;
      break;
    case 'absent':
      body = (
        <>
          <Text style={styles.hint}>
            Not installed. Download it once ({formatBytes(MODEL.sizeBytes)}) and chat, planning help and journal summaries run on this phone — offline, private.
          </Text>
          <Button compact icon="download-outline" label={`Download (${formatBytes(MODEL.sizeBytes)})`} onPress={() => void download()} />
        </>
      );
      break;
    case 'downloading': {
      const f = status.total > 0 ? status.received / status.total : 0;
      body = (
        <>
          <Text style={styles.hint}>
            Downloading… {formatBytes(status.received)} of {formatBytes(status.total)}. Keep Cubeit open.
          </Text>
          <Bar fraction={f} color={colors.brand} />
          <Button compact tone="ghost" label="Cancel download" onPress={cancelModelDownload} />
        </>
      );
      break;
    }
    case 'verifying':
      body = (
        <>
          <Text style={styles.hint}>Checking the file (SHA-256)… {Math.round(status.progress * 100)}%</Text>
          <Bar fraction={status.progress} color={colors.success} />
        </>
      );
      break;
    case 'installed':
    case 'ready':
    case 'loading':
      body = (
        <>
          <Text style={styles.hint}>
            Installed and verified{status.state === 'ready' ? ' · loaded' : status.state === 'loading' ? ' · loading…' : ''}. Runs offline on this phone.
            {speed ? ` Last reply: ${speed} tokens/s.` : ''}
          </Text>
          <Button compact tone="danger" icon="trash-outline" label="Delete model" onPress={() => void remove()} />
        </>
      );
      break;
    case 'error':
      body = (
        <>
          <Text style={styles.error}>{status.message}</Text>
          {status.canRetry && <Button compact tone="secondary" label="OK" onPress={resetModelError} />}
        </>
      );
      break;
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>On-device AI · {MODEL.name}</Text>
      <Text style={styles.meta}>
        {MODEL.quantization} · {formatBytes(MODEL.sizeBytes)} · {MODEL.license} · by {MODEL.publisher}
      </Text>
      {body}
    </View>
  );
}

function Bar({ fraction, color }: { fraction: number; color: string }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(fraction * 100) }}>
      <View style={[styles.fill, { width: `${Math.round(Math.max(0, Math.min(1, fraction)) * 100)}%`, backgroundColor: color }]} />
    </View>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    card: { gap: 8, padding: 12, borderRadius: radii.md, backgroundColor: colors.surface },
    title: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
    meta: { fontFamily: fonts.regular, fontSize: 12, color: colors.textFaint },
    hint: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textDim },
    error: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.danger },
    track: { height: 8, borderRadius: 4, backgroundColor: colors.surfacePressed, overflow: 'hidden' },
    fill: { height: 8, borderRadius: 4 },
  });
