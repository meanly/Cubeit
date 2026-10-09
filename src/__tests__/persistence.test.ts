import { emptyMemoryDoc, migrateMemories, parseTags } from '../memory/memoryDoc';
import { DocumentWriter, loadDocument } from '../storage/documents';
import { createMemoryStore } from '../storage/types';
import { migrateSave } from '../state/migrations';
import { createDefaultSave, SAVE_VERSION } from '../state/schema';

describe('save migration and repair', () => {
  it('round-trips a default save unchanged', () => {
    const save = createDefaultSave(1_000, () => 0.5);
    const { data } = migrateSave(JSON.parse(JSON.stringify(save)), 2_000);
    expect(data).toEqual(save);
  });

  it('starts with no rug, and v1 saves on the old default round rug lose it', () => {
    expect(createDefaultSave(1_000).room.items.rug).toBeNull();
    const old = createDefaultSave(1_000) as unknown as Record<string, any>;
    old.version = 1;
    old.room.items.rug = 'roundRug';
    expect(migrateSave(JSON.parse(JSON.stringify(old)), 2_000).data.room.items.rug).toBeNull();
    old.room.items.rug = 'stripedRug';
    expect(migrateSave(JSON.parse(JSON.stringify(old)), 2_000).data.room.items.rug).toBe('stripedRug');
  });

  it('recovers from garbage with sensible defaults', () => {
    const { data } = migrateSave('not an object', 5_000);
    expect(data.version).toBe(SAVE_VERSION);
    expect(data.character.name).toBe('Pip');
    expect(data.room.items.rest).toBe('cushion');
  });

  it('repairs invalid fields but keeps valid ones', () => {
    const save = createDefaultSave(1_000) as unknown as Record<string, any>;
    save.character.name = 'Mochi';
    save.mood.valence = 99; // out of range
    save.progress.stars = -5; // negative
    save.room.theme = 'volcano'; // unknown
    save.room.items.rest = 'plant'; // wrong slot
    save.room.items.wallLeft = null; // allowed empty
    save.room.items.rest = null; // not allowed empty
    save.settings.tiltSensitivity = 'fast';
    const { data } = migrateSave(save, 2_000);
    expect(data.character.name).toBe('Mochi');
    expect(data.mood.valence).toBe(1);
    expect(data.progress.stars).toBe(0);
    expect(data.room.theme).toBe('midnight');
    expect(data.room.items.rest).toBe('cushion');
    expect(data.room.items.wallLeft).toBeNull();
    expect(data.settings.tiltSensitivity).toBe(1);
  });

  it('drops unknown finds and dedupes unlocks', () => {
    const save = createDefaultSave(1_000) as unknown as Record<string, any>;
    save.progress.finds = ['pebble', 'dragon-egg', 'pebble'];
    save.progress.unlocked = ['item:bed', 'item:bed'];
    const { data } = migrateSave(save);
    expect(data.progress.finds).toEqual(['pebble']);
    expect(data.progress.unlocked).toEqual(['item:bed']);
  });
});

describe('document storage', () => {
  it('reports fresh, loaded and recovered states and keeps a backup of unreadable data', () => {
    const store = createMemoryStore();
    const fresh = loadDocument(store, 'k', (raw) => raw as number, () => 0);
    expect(fresh.status).toBe('fresh');

    store.set('k', '42');
    expect(loadDocument(store, 'k', (raw) => raw as number, () => 0)).toEqual({ data: 42, status: 'loaded' });

    store.set('k', '{broken');
    const broken = loadDocument(store, 'k', (raw) => raw as number, () => 7);
    expect(broken.status).toBe('recovered');
    expect(broken.data).toBe(7);
    expect(store.get('k.backup')).toBe('{broken');
  });

  it('debounces writes and flushes on demand', () => {
    jest.useFakeTimers();
    const store = createMemoryStore();
    const writer = new DocumentWriter<{ n: number }>(store, 'doc', 500, () => {});
    writer.schedule({ n: 1 });
    writer.schedule({ n: 2 });
    expect(store.get('doc')).toBeNull();
    jest.advanceTimersByTime(500);
    expect(store.get('doc')).toBe('{"n":2}');
    writer.schedule({ n: 3 });
    writer.flush();
    expect(store.get('doc')).toBe('{"n":3}');
    jest.useRealTimers();
  });

  it('reports write failures instead of throwing', () => {
    const errors: unknown[] = [];
    const failing = { ...createMemoryStore(), set: () => { throw new Error('disk full'); } };
    const writer = new DocumentWriter(failing, 'doc', 10, (e) => errors.push(e));
    writer.schedule({});
    writer.flush();
    expect(errors).toHaveLength(1);
  });
});

describe('memories document', () => {
  it('keeps valid memories and drops broken or duplicate ones', () => {
    const doc = migrateMemories({
      version: 1,
      items: [
        { id: 'a', type: 'fact', content: 'Likes tea', createdAt: 10, tags: ['tea'], importance: 2, source: 'conversation' },
        { id: 'a', type: 'fact', content: 'Duplicate id', createdAt: 11 },
        { id: 'b', content: '', createdAt: 12 },
        { id: 'c', type: 'mystery', content: 'Unknown type becomes note', createdAt: 13, importance: 9 },
        'nonsense',
      ],
    });
    expect(doc.items.map((m) => m.id)).toEqual(['a', 'c']);
    expect(doc.items[1].type).toBe('note');
    expect(doc.items[1].importance).toBe(3);
  });

  it('handles a missing document', () => {
    expect(migrateMemories(undefined)).toEqual(emptyMemoryDoc());
  });

  it('parses tags', () => {
    expect(parseTags(' Cats, rainy days ,cats,, ')).toEqual(['cats', 'rainy days']);
  });
});
