import { buildCompanionPrompt } from '../conversation/llm/promptBuilder';
import { scriptedReply } from '../conversation/scripted/scriptedEngine';
import type { ConversationContext } from '../conversation/types';
import { checkSensitive } from '../memory/sensitive';
import { searchMemories } from '../memory/recall';
import type { Memory } from '../memory/types';

const rng = () => 0;

const memory = (over: Partial<Memory>): Memory => ({
  id: over.id ?? 'm1',
  type: 'fact',
  content: 'something',
  createdAt: 1,
  tags: [],
  importance: 2,
  source: 'conversation',
  ...over,
});

const ctx = (over: Partial<ConversationContext> = {}): ConversationContext => ({
  characterName: 'Pip',
  personality: { curiosity: 0.5, playfulness: 0.5, calm: 0.5 },
  mood: 'happy',
  energy: 0.7,
  bondLevel: 1,
  daysTogether: 3,
  hour: 14,
  activities: [],
  memories: [],
  unlockedDance: false,
  ...over,
});

describe('scripted conversation engine', () => {
  it('greets', () => {
    const r = scriptedReply('hello!', ctx(), rng);
    expect(r.understood).toBe(true);
    expect(r.expression).toBe('happy');
  });

  it('is honest when it does not understand', () => {
    const r = scriptedReply('explain quantum chromodynamics', ctx(), rng);
    expect(r.understood).toBe(false);
    expect(r.text.toLowerCase()).toContain('understand');
  });

  it('is honest about not being an AI model', () => {
    const r = scriptedReply('are you an AI?', ctx(), rng);
    expect(r.text).toContain('not a real AI model');
  });

  it('proposes — never silently saves — a memory', () => {
    const r = scriptedReply('Remember that I have a piano lesson on Friday.', ctx(), rng);
    expect(r.proposal?.draft.content).toBe('I have a piano lesson on Friday');
    expect(r.proposal?.draft.source).toBe('conversation');
  });

  it('captures names and favorites as structured memories', () => {
    const name = scriptedReply('my name is sam', ctx(), rng);
    expect(name.proposal?.draft).toMatchObject({ key: 'user.name', value: 'Sam' });
    const fav = scriptedReply('My favorite color is teal', ctx(), rng);
    expect(fav.proposal?.draft).toMatchObject({ key: 'favorite.color', value: 'teal', type: 'favorite' });
  });

  it('flags sensitive content in proposals', () => {
    const r = scriptedReply('remember my password is hunter2', ctx(), rng);
    expect(r.proposal?.sensitiveReasons.length).toBeGreaterThan(0);
  });

  it('only recalls what was actually saved', () => {
    expect(scriptedReply("what's my name?", ctx(), rng).text).toContain('don’t know your name');
    const withName = ctx({ memories: [memory({ key: 'user.name', value: 'Ada', content: 'Your name is Ada' })] });
    expect(scriptedReply("what's my name?", withName, rng).text).toContain('Ada');
    expect(scriptedReply('do you remember my birthday party?', ctx(), rng).text).toContain('don’t have a memory');
  });

  it('describes real logged activities only', () => {
    expect(scriptedReply('what have you been up to?', ctx(), rng).text).toBe('Just hanging out in my room!');
    const busy = ctx({ activities: [{ at: 1, kind: 'nap', text: 'took a nap on my cushion' }] });
    expect(scriptedReply('what have you been up to?', busy, rng).text).toBe('Earlier I took a nap on my cushion.');
  });

  it('maps requests to actions, respecting unlocks', () => {
    expect(scriptedReply('can you dance?', ctx(), rng).action).toBe('jump');
    expect(scriptedReply('can you dance?', ctx({ unlockedDance: true }), rng).action).toBe('dance');
    expect(scriptedReply('come here', ctx(), rng).action).toBe('comeHere');
  });

  it('responds to distress with care, not jokes', () => {
    const r = scriptedReply("I don't want to be here anymore", ctx(), rng);
    expect(r.text).toContain('crisis line');
  });

  it('comforts without crossing into "remember"', () => {
    const r = scriptedReply("I'm feeling really sad", ctx(), rng);
    expect(r.expression).toBe('love');
    expect(r.proposal).toBeUndefined();
  });
});

describe('memory recall and sensitivity', () => {
  it('ranks keyword overlap and ignores unrelated memories', () => {
    const mems = [
      memory({ id: 'a', content: 'My cat is named Miso', tags: ['cats'] }),
      memory({ id: 'b', content: 'I like rainy days' }),
    ];
    const hits = searchMemories('what is my cat called', mems);
    expect(hits.map((h) => h.memory.id)).toEqual(['a']);
    expect(searchMemories('spaceships', mems)).toEqual([]);
  });

  it('detects common sensitive data', () => {
    expect(checkSensitive('my email is a@b.co').sensitive).toBe(true);
    expect(checkSensitive('call me at 555 123 4567').sensitive).toBe(true);
    expect(checkSensitive('I love pancakes').sensitive).toBe(false);
  });
});

describe('local model prompt builder', () => {
  it('includes only saved memories and the honesty rules', () => {
    const mems = [memory({ content: 'Your favorite color is teal', key: 'favorite.color', value: 'teal', type: 'favorite' })];
    const messages = buildCompanionPrompt('what color do I like?', ctx({ memories: mems }), [
      { id: '1', from: 'user', text: 'hi', at: 1 },
      { id: '2', from: 'character', text: 'Hi!', at: 2 },
    ]);
    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toContain('Your favorite color is teal');
    expect(messages[0].content).toContain('Never invent past events');
    expect(messages.slice(1).map((m) => m.role)).toEqual(['user', 'assistant', 'user']);
  });
});

describe('feeling phrasing variants', () => {
  it.each(["I'm sad", 'im sad', 'i feel sad', 'I am feeling a bit sad', "I'm feeling really sad"])('comforts: %s', (text) => {
    expect(scriptedReply(text, ctx(), rng).expression).toBe('love');
  });
  it.each(["I'm happy", 'i feel great', "I'm feeling so excited"])('cheers: %s', (text) => {
    expect(scriptedReply(text, ctx(), rng).expression).toBe('celebrating');
  });
});
