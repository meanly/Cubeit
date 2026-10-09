import { Sha256, sha256Hex } from '../ai/sha256';
import { cleanModelText, expressionFor } from '../conversation/llm/localModelEngine';
import { searchMemories } from '../memory/recall';
import { cleanOcrLines, guessEventFromText, linesToChecklist } from '../media/ocrText';
import { describeVoiceError, fromRecognizerError, joinTranscript, VoiceError } from '../media/voiceErrors';
import * as ops from '../planner/ops';
import { migratePlanner } from '../planner/plannerDoc';
import { PLANNER_KEY } from '../planner/types';
import { DocumentWriter, loadDocument } from '../storage/documents';
import { createMemoryStore } from '../storage/types';
import { buildExport } from '../state/exportData';
import { useMemories } from '../state/memoryStore';
import { createDefaultSave } from '../state/schema';

jest.mock('../ai/runtime', () => ({ complete: jest.fn(), runtimeStatus: () => ({ ok: false, reason: 'test' }) }));

const NOW = new Date(2026, 9, 10, 12, 0).getTime();
const bytes = (s: string) => new Uint8Array(Array.from(s, (c) => c.charCodeAt(0)));

describe('model file checksum', () => {
  it('matches the standard SHA-256 vectors', () => {
    expect(sha256Hex(new Uint8Array(0))).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex(bytes('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(sha256Hex(bytes('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'))).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    );
  });

  it('gives the same digest when fed in uneven chunks', () => {
    const big = new Uint8Array(1_000_003).fill(7);
    const h = new Sha256();
    for (let i = 0; i < big.length; i += 65_537) h.update(big.subarray(i, i + 65_537));
    expect(h.digestHex()).toBe('b8097dd8107cfe90ae1f3e2a9f297dc7ad0b9d5a51600f64baabe4af385d2b9a');
  });
});

describe('voice input errors', () => {
  it('maps recognizer errors to clear, honest messages', () => {
    expect(fromRecognizerError('not-allowed')).toBe('speech-permission');
    expect(fromRecognizerError('no-speech')).toBe('no-speech');
    expect(fromRecognizerError('network')).toBe('offline-unavailable');
    expect(fromRecognizerError('language-not-supported')).toBe('offline-unavailable');
    expect(fromRecognizerError('aborted')).toBe('cancelled');
    expect(fromRecognizerError('weird', 'on-device model missing')).toBe('offline-unavailable');
    expect(describeVoiceError('offline-unavailable')).toMatch(/never sends audio/);
    expect(new VoiceError('too-short').message).toMatch(/too short/);
  });

  it('joins final transcript chunks and treats silence as empty', () => {
    expect(joinTranscript(['  add milk ', '', 'to my list'])).toBe('add milk to my list');
    expect(joinTranscript(['', '  '])).toBe('');
  });
});

describe('photo text', () => {
  it('cleans OCR lines and builds checklists', () => {
    expect(cleanOcrLines(['  Milk ', '', '•', 'Eggs  x12'])).toEqual(['Milk', 'Eggs x12']);
    expect(linesToChecklist('- Milk\n☐ Eggs\n1. Bread\n[x] Butter\n\n')).toEqual(['Milk', 'Eggs', 'Bread', 'Butter']);
  });

  it('guesses an event from poster text without inventing missing parts', () => {
    const g = guessEventFromText('JAZZ IN THE PARK\nSaturday Oct 17\n7pm\nFree entry', NOW);
    expect(g).toMatchObject({ title: 'JAZZ IN THE PARK', day: '2026-10-17', start: '19:00' });
    expect(guessEventFromText('Bake sale', NOW)).toEqual({ title: 'Bake sale' });
  });
});

describe('model reply cleanup', () => {
  it('strips template tokens and markdown, and picks a face', () => {
    expect(cleanModelText('<|im_start|>assistant: **Hi** there!<|im_end|>')).toBe('Hi there!');
    expect(expressionFor('Sorry, that sounds hard.')).toBe('sad');
    expect(expressionFor('Want to try?')).toBe('curious');
  });
});

describe('persistence and export', () => {
  it('saves and reloads the planner through the document store', () => {
    const store = createMemoryStore();
    let data = ops.emptyPlanner();
    data = ops.addEvent(data, { title: 'Dentist', day: '2026-10-11', allDay: true }, NOW).data;
    data = ops.addJournal(data, { day: '2026-10-10', text: 'Private thoughts', mood: 'okay' }, NOW).data;
    const writer = new DocumentWriter(store, PLANNER_KEY, 10, () => {
      throw new Error('should not fail');
    });
    writer.writeNow({ version: 1, ...data });
    const loaded = loadDocument(store, PLANNER_KEY, migratePlanner, () => migratePlanner(null));
    expect(loaded.status).toBe('loaded');
    expect(loaded.data.events).toEqual(data.events);
    expect(loaded.data.journal).toEqual(data.journal);
  });

  it('writeNow throws when storage fails so callers can roll back', () => {
    const broken = { ...createMemoryStore(), set: () => {
      throw new Error('disk full');
    } };
    const writer = new DocumentWriter(broken, PLANNER_KEY, 10, () => {});
    expect(() => writer.writeNow({ version: 1, ...ops.emptyPlanner() })).toThrow('disk full');
  });

  it('keeps an unreadable planner as a backup instead of destroying it', () => {
    const store = createMemoryStore();
    store.set(PLANNER_KEY, '{not json');
    const loaded = loadDocument(store, PLANNER_KEY, migratePlanner, () => migratePlanner(null));
    expect(loaded.status).toBe('recovered');
    expect(store.get(`${PLANNER_KEY}.backup`)).toBe('{not json');
  });

  it('exports all user data as JSON and never the model', () => {
    let planner = ops.emptyPlanner();
    planner = ops.addChore(planner, { title: 'Bins' }, '2026-10-10', NOW).data;
    const out = buildExport(createDefaultSave(1), [], planner, NOW);
    const json = JSON.stringify(out);
    expect(out.planner.chores[0].title).toBe('Bins');
    expect(out.planner.version).toBe(1);
    expect(json).not.toMatch(/\.gguf/);
    expect(JSON.parse(json).exportedAt).toBe(new Date(NOW).toISOString());
  });
});

describe('memories', () => {
  it('a deleted memory can no longer be recalled', () => {
    const store = useMemories.getState();
    store.clear();
    const m = store.add({ type: 'fact', content: 'Your sister is called Ana', tags: [], importance: 2, source: 'conversation' });
    expect(searchMemories('sister', useMemories.getState().items).map((h) => h.memory.id)).toEqual([m.id]);
    useMemories.getState().remove(m.id);
    expect(searchMemories('sister', useMemories.getState().items)).toEqual([]);
  });
});
