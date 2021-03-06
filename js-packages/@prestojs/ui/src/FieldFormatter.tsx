import { Field } from '@prestojs/viewmodel';
import React from 'react';
import useUi from './useUi';

/**
 * @expand-properties Any extra props are passed directly through to the formatter component.
 */
type FieldFormatterProps<FieldValueT, ParsableValueT, SingleValueT> = {
    /**
     * The field used to determine the formatter to use. If field is [bound to the record](doc:viewModelFactory#var-_f)
     * then `value` is not required and will be set to `field.value`.
     */
    field: Field<FieldValueT, ParsableValueT, SingleValueT>;
    /**
     * Value to format. If `field` is a [record bound field](doc:viewModelFactory#var-_f) then this is not required.
     */
    value?: FieldValueT;
    [rest: string]: any;
};

/**
 * Wraps around getFormatterForField to always return ReactElement; Applies default props from getFormatterForField if any.
 * Formats a value based on the specified field. See `getFormatterForField` on [UiProvider](doc:UiProvider) for how the
 * formatter is determined.
 *
 * @extract-docs
 */
export default function FieldFormatter<FieldValueT, ParsableValueT, SingleValueT>(
    props: FieldFormatterProps<FieldValueT, ParsableValueT, SingleValueT>
): React.ReactElement {
    const { field, ...rest } = props;

    const { getFormatterForField } = useUi();

    if (field.isBound && !('value' in rest)) {
        rest.value = field.value;
    }

    const Formatter = getFormatterForField(field) as React.ComponentType<any>;

    if (Array.isArray(Formatter)) {
        const [ActualFormatter, props] = Formatter;
        return <ActualFormatter {...props} {...rest} />;
    } else {
        return <Formatter {...rest} />;
    }
}
