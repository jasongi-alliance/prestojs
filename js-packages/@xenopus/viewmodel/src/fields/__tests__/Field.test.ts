import Field from '../Field';

test('Field options validation', () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
    // @ts-ignore
    expect(() => new Field({})).toThrowError('Field "name" is required');

    // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
    // @ts-ignore
    expect(() => new Field({ name: 'phoneNumber' })).toThrowError(
        'Field phoneNumber: "label" is required'
    );

    expect(
        // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
        // @ts-ignore
        () => new Field({ name: 'phoneNumber', label: 'phone number', required: 3 })
    ).toThrowError('Field phoneNumber: "required" should be a boolean, received: 3');

    expect(
        // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
        // @ts-ignore
        () => new Field({ name: 'phoneNumber', label: 'phone number', readOnly: {} })
    ).toThrowError('Field phoneNumber: "readOnly" should be a boolean, received: [object Object]');

    expect(
        // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
        // @ts-ignore
        () => new Field({ name: 'phoneNumber', label: 'phone number', writeOnly: 'no' })
    ).toThrowError('Field phoneNumber: "writeOnly" should be a boolean, received: no');

    expect(
        // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
        // @ts-ignore
        () => new Field({ name: 'phoneNumber', label: 'phone number', choices: 3 })
    ).toThrowError('Field phoneNumber: "choices" should be Iterable, received: 3');

    expect(
        // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
        // @ts-ignore
        () => new Field({ name: 'phoneNumber', label: 'phone number', snake: 'oil' })
    ).toThrowError('Field phoneNumber: received unknown option(s): snake');

    new Field({
        name: 'a',
        label: 'a',
        required: false,
        helpText: 'Help',
        defaultValue: 1,
        choices: new Map(),
        readOnly: false,
        writeOnly: true,
    });
});
