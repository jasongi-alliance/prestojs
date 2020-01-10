import DecimalField from './DecimalField';

/**
 * Currency Field to store currency values.
 *
 * Extends DecimalField for precision, TODO - should store additional info on currency types (eg, USD, JPY).
 *
 * @extract-docs
 */
export default class CurrencyField extends DecimalField {}