import DateField from '../DateField';

test('DateField parse values correctly', () => {
    const field = new DateField({ label: 'date' });
    expect(field.parse(true)).toBe(null);
    expect(field.parse(null)).toBe(null);
    expect(field.parse(undefined)).toBe(null);

    expect((field.parse('2019-11-11') as Date).toISOString()).toBe('2019-11-11T00:00:00.000Z');

    const now = new Date();
    expect((field.parse(now) as Date).toISOString()).toBe(now.toISOString());
});
