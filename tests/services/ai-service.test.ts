import { safeParseJson } from '../../src/utils/json-repair';

describe('AI JSON Repair Utility', () => {
  test('parses clean JSON', () => {
    const raw = '{"subtasks":[{"content":"A"}],"estimatedDuration":"1 saat"}';
    const parsed = safeParseJson(raw);
    expect(parsed.subtasks).toHaveLength(1);
  });

  test('parses fenced JSON', () => {
    const raw = '```json\n{"subtasks":[{"content":"B"}],"estimatedDuration":"30 dakika"}\n```';
    const parsed = safeParseJson(raw);
    expect(parsed.subtasks[0].content).toBe('B');
  });

  test('repairs truncated closing brace', () => {
    const raw = '{"subtasks":[{"content":"C"}],"estimatedDuration":"15 dk"'; // missing closing }
    const parsed = safeParseJson(raw);
    expect(parsed.estimatedDuration).toBe('15 dk');
  });

  test('removes trailing commas', () => {
    const raw = '{"subtasks":[{"content":"D",}],"estimatedDuration":"10 dk",}';
    const parsed = safeParseJson(raw);
    expect(parsed.subtasks[0].content).toBe('D');
  });
});
