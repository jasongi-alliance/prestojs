import ViewModelCache from '@xenopus/viewmodel/ViewModelCache';
import isEqual from 'lodash/isEqual';
import Field from './fields/Field';

type FieldsMapping = { [key: string]: Field<any> };

export type PrimaryKey = string | number;
export type CompoundPrimaryKey = PrimaryKey[];

/**
 * Base ViewModel class for any model in the system. This should be extended and have relevant fields and meta data
 * set on it:
 *
 * ```js
 * class User extends ViewModel {
 *     // Optional; default cache is usually sufficient
 *     static cache = new MyCustomCache();
 *
 *     // Default pkFieldName is 'id'; if you have a different pk specify here
 *     static pkFieldName = 'userId';
 *
 *     // Used to describe a single user
 *     static label = 'User';
 *     // User to describe an indeterminate number of users
 *     static labelPlural = 'Users';
 *
 *     static fields = {
 *         userId: new IntegerField({ name: 'userId', label: 'User ID' })
 *         firstName: new CharField({ name: 'firstName', label: 'First Name' }),
 *         lastName: new CharField({ name: 'lastName', label: 'Last Name' }),
 *     };
 * }
 * ```
 */
export default class ViewModel {
    // Name of the primary key field for this this ViewModel (or fields for compound keys)
    static pkFieldName: string | string[] = 'id';
    static label: string;
    static labelPlural: string;
    static fields: FieldsMapping = {};

    private static __cache: Map<typeof ViewModel, ViewModelCache<ViewModel>> = new Map();
    public static get cache(): ViewModelCache<ViewModel> {
        // This is a getter so we can instantiate cache on each ViewModel independently without
        // having to have the descendant create the cache
        if (!this.__cache.has(this)) {
            this.__cache.set(this, new ViewModelCache());
        }
        return this.__cache.get(this);
    }

    public static set cache(value: ViewModelCache<ViewModel>) {
        if (!(value instanceof ViewModelCache)) {
            throw new Error(`cache class must extend ViewModelCache. See ${this.name}.cache`);
        }
        this.__cache.set(this, value);
    }

    // TODO: What's a better way to type the actual fields? Can't use [fieldName: string]: Field<any> here because
    // then all the other properties have to match that type (eg. _model below will have an error as no assignable to
    // Field<any>
    [fieldName: string]: any;

    public get _model(): typeof ViewModel {
        return Object.getPrototypeOf(this).constructor;
    }

    /**
     * Shortcut to get the primary key for this record
     */
    public get _pk(): PrimaryKey | CompoundPrimaryKey {
        const { name, fields, pkFieldName } = this._model;
        if (Array.isArray(pkFieldName)) {
            const missingFields = pkFieldName.filter(fieldName => !fields[fieldName]);
            if (missingFields.length > 0) {
                const fieldDesc = `field${missingFields.length > 1 ? 's' : ''}`;
                throw new Error(
                    `${name} has 'pkFieldName' set to '${pkFieldName.join(
                        ', '
                    )}' but the ${fieldDesc} '${missingFields.join(
                        ', '
                    )}' does not exist in ${name}.fields. Either add the missing ${fieldDesc} or update 'pkFieldName' to reflect the actual primary key field.`
                );
            }
            return pkFieldName.map(fieldName => this[fieldName]);
        }
        if (!fields[pkFieldName]) {
            throw new Error(
                `${name} has 'pkFieldName' set to '${pkFieldName}' but no such field exists in ${name}.fields. Either add the missing field or update 'pkFieldName' to reflect the actual primary key field.`
            );
        }
        return this[pkFieldName];
    }

    // For a particular instance of a model only partial data may have been received. This
    // tracks the fields that were set.
    public _assignedFields: string[];

    /**
     * Get the data for each field on this record. This won't transform any special field
     * representations - for that use toJS(). This is a shortcut to manually iterating of the
     * fields to get the data out of the record.
     *
     * In general use toJS() instead.
     */
    public get _data(): {} {
        return this._assignedFields.reduce((acc, fieldName) => {
            acc[fieldName] = this[fieldName];
            return acc;
        }, {});
    }

    constructor(data: {}) {
        // TODO: Should partial fields be identified by absence of key?
        const assignedFields = [];
        const fields = this._model.fields;
        for (const key of Object.keys(data)) {
            const value = data[key];
            const field = fields[key];
            // TODO: What about supporting things like:
            // group = new ForeignKey(...)
            // which results in the id being set on `groupId` instead? we'd have to handle this
            // differently to support that.
            if (field) {
                this[key] = field.normalize(value);
                assignedFields.push(key);
            } else {
                // TODO: Should extra keys in data be a warning or ignored?
                console.warn(
                    `Received value for key ${key}. No such field exists on ${this.constructor.name}`
                );
            }
        }
        this._assignedFields = assignedFields;
        this._assignedFields.sort();
    }

    /**
     * Return data as object to pass as initial values to a form
     */
    serializeToForm(): {} {
        throw new Error('Not implemented. Pending changes to support data on ViewModel.');
    }

    public static toString(): string {
        return this.name;
    }

    public toString(): string {
        return `${this._model.name}(${JSON.stringify(this.toJS(), null, 2)})`;
    }

    /**
     * Return the data for this record as an object
     */
    public toJS(): {} {
        const data = {};
        for (const [fieldName, value] of Object.entries(this._data)) {
            data[fieldName] = this._model.fields[fieldName].toJS(value);
        }
        return data;
    }

    /**
     * Compares two records to see if they are equivalent.
     *
     * - If the ViewModel is different then the records are always considered different
     * - If the records were initialised with a different set of fields then they are
     *   considered different even if the common fields are the same and other fields are
     *   all null
     */
    public isEqual(record: ViewModel): boolean {
        if (record._model !== this._model) {
            return false;
        }
        if (!isEqual(record._assignedFields, this._assignedFields)) {
            return false;
        }
        for (const fieldName of this._assignedFields) {
            const field = this._model.fields[fieldName];
            if (!field.isEqual(this[fieldName], record[fieldName])) {
                return false;
            }
        }
        return true;
    }

    /**
     * Clone this record, optionally with only a subset of the fields
     */
    public clone(fieldNames?: string[]): this {
        const missingFieldNames = fieldNames
            ? fieldNames.filter(fieldName => !this._assignedFields.includes(fieldName))
            : [];
        if (missingFieldNames.length > 0) {
            throw new Error(
                `Can't clone ${this._model.name} with fields ${fieldNames.join(
                    ', '
                )} as only these fields are set: ${this._assignedFields.join(
                    ', '
                )}. Missing fields: ${missingFieldNames.join(', ')}`
            );
        }
        if (!fieldNames) {
            fieldNames = this._assignedFields;
        }

        const data = {};
        for (const fieldName of fieldNames) {
            // TODO: Unclear to me if this needs to call a method on the Field on not. Revisit this.
            data[fieldName] = this[fieldName];
        }

        // I don't know how to type this, error is:
        // TS2322: Type 'ViewModel' is not assignable to type 'this'.
        // 'ViewModel' is assignable to the constraint of type 'this', but 'this' could be instantiated with a different subtype of constraint 'ViewModel'.
        // I could type return as `ViewModel` but then usages of it will be wrong (eg. clone() will be from a more general ViewModel to a specific implementation)
        // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
        // @ts-ignore
        return new this._model(data);
    }
}