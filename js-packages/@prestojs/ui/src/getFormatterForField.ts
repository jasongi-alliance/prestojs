import { Field } from '@prestojs/viewmodel';
import React from 'react';

const LinkFormatter = React.lazy(() => import('./formatters/LinkFormatter'));
const RangeFormatter = React.lazy(() => import('./formatters/RangeFormatter'));
const ImageFormatter = React.lazy(() => import('./formatters/ImageFormatter'));

// https://github.com/DefinitelyTyped/DefinitelyTyped/issues/33006
// TLDR: currently @types/react disallows bare children (eg, string) to be returned from a functional component
// also see: issue 32832
// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
// @ts-ignore
const BooleanFormatter = React.lazy(() => import('./formatters/BooleanFormatter'));
// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
// @ts-ignore
const CharFormatter = React.lazy(() => import('./formatters/CharFormatter'));
// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
// @ts-ignore
const ChoiceFormatter = React.lazy(() => import('./formatters/ChoiceFormatter'));
// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
// @ts-ignore
const DateFormatter = React.lazy(() => import('./formatters/DateFormatter'));
// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
// @ts-ignore
const DateTimeFormatter = React.lazy(() => import('./formatters/DateTimeFormatter'));
// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
// @ts-ignore
const NumberFormatter = React.lazy(() => import('./formatters/NumberFormatter'));
// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
// @ts-ignore
const TimeFormatter = React.lazy(() => import('./formatters/TimeFormatter'));

const mapping = new Map<string, any>([
    ['BooleanField', BooleanFormatter],
    ['CharField', CharFormatter],
    ['CurrencyField', NumberFormatter],
    ['DateField', DateFormatter],
    ['DateRangeField', [RangeFormatter, { baseFormatter: DateFormatter }]],
    ['DateTimeField', DateTimeFormatter],
    ['DateTimeRangeField', [RangeFormatter, { baseFormatter: DateTimeFormatter }]],
    ['DecimalField', NumberFormatter],
    ['DurationField', TimeFormatter],
    ['EmailField', CharFormatter],
    ['FileField', LinkFormatter],
    ['FloatField', NumberFormatter],
    ['FloatRangeField', [RangeFormatter, { baseFormatter: NumberFormatter }]],
    ['ImageField', ImageFormatter],
    ['IntegerField', NumberFormatter],
    ['IntegerRangeField', [RangeFormatter, { baseFormatter: NumberFormatter }]],
    ['IPAddressField', CharFormatter],
    ['JsonField', CharFormatter],
    ['NullableBooleanField', BooleanFormatter],
    ['NumberField', NumberFormatter],
    ['SlugField', CharFormatter],
    ['TextField', CharFormatter],
    ['TimeField', TimeFormatter],
    ['URLField', LinkFormatter],
    ['UUIDField', CharFormatter],
]);

// choices -> select/radio widgets; only accepting integer(for enum) and char for now
const choicesMapping = new Map<string, any>([
    ['CharField', ChoiceFormatter],
    ['IntegerField', ChoiceFormatter],
]);

/*
 * Returns the default formatter for any given Field.
 *
 * Depending on Field, this will return either a Formatter component directly, or [Formatter, props] where props is the default props that would be applied to said formatter.
 *
 * @extract-docs
 */
export default function getFormatterForField<
    FieldValue,
    ParsableValueT,
    SingleValueT,
    T extends HTMLElement
>(
    field: Field<FieldValue, ParsableValueT, SingleValueT>
): React.ComponentType<T> | [React.ComponentType<T>, object] | string | null {
    const { fieldClassName } = Object.getPrototypeOf(field).constructor;
    const formatter: React.FunctionComponent | string | null | undefined = field.choices
        ? choicesMapping.get(fieldClassName) || mapping.get(fieldClassName)
        : mapping.get(fieldClassName);

    const getReturnWithChoices = (
        w,
        f
    ): React.ComponentType<T> | [React.ComponentType<T>, object] | string => {
        if (f.choices) {
            if (Array.isArray(w)) {
                return [w[0], { ...w[1], choices: f.choices }];
            } else {
                return [w, { choices: f.choices }];
            }
        } else {
            return w;
        }
    };

    if (formatter) {
        return getReturnWithChoices(formatter, field);
    }

    let f = Object.getPrototypeOf(field.constructor);
    do {
        const formatterF: React.FunctionComponent | string | null | undefined = field.choices
            ? choicesMapping.get(f.fieldClassName) || mapping.get(f.fieldClassName)
            : mapping.get(f.fieldClassName);
        if (formatterF) {
            return getReturnWithChoices(formatterF, field);
        }
        f = Object.getPrototypeOf(f);
    } while (f.name);

    return null;
}
