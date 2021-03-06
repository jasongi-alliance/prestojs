import Field, { FieldProps } from './Field';

interface Boundary<T> extends FieldProps<T> {
    lowerBound: T | null | undefined;
    upperBound: T | null | undefined;
    separator: string | undefined;
    [propName: string]: any;
}

/**
 * Base class for range fields (fields with a boundary).
 *
 * supply lowerBound and upperBound to the constructor to define boundaries. they're optional (can be undefined / null).
 *
 * Other range based fields (DateTimeRangeField, IntegerRangeField, ...) will extend this.
 *
 * @extract-docs
 * @menu-group Fields
 */
export default class RangeField<T> extends Field<T> {
    static fieldClassName = 'RangeField';
    public lowerBound: T | null | undefined;
    public upperBound: T | null | undefined;
    public separator: string;

    constructor(values: Boundary<T>) {
        super(values);
        const { lowerBound, upperBound, separator = '~' } = values;
        this.lowerBound = lowerBound;
        this.upperBound = upperBound;
        this.separator = separator;
    }
}
