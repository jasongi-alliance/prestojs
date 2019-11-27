import ViewModel from '../ViewModel';
import Field from '../fields/Field';

test('ViewModel._model returns class', () => {
    class A extends ViewModel {}

    const record1 = new A({});
    expect(record1._model).toEqual(A);

    class B extends A {}

    const record2 = new B({});
    expect(record2._model).toEqual(B);
});

test('ViewModel._pk should validate primary key fields exist', () => {
    class A extends ViewModel {}

    const record1 = new A({});
    expect(() => record1._pk).toThrow(/A has 'pkFieldName' set to 'id' but/);

    class B extends ViewModel {
        static pkFieldName = ['id1', 'id2'];
    }

    const record2 = new B({});
    expect(() => record2._pk).toThrow(
        /B has 'pkFieldName' set to 'id1, id2' but the fields 'id1, id2'/
    );

    class C extends ViewModel {
        static pkFieldName = ['id1', 'id2'];
        static fields = {
            id1: new Field({ name: 'id1', label: 'Id' }),
        };
    }

    const record3 = new C({});
    expect(() => record3._pk).toThrow(/C has 'pkFieldName' set to 'id1, id2' but the field 'id2'/);
});

test('ViewModel._pk should return primary key', () => {
    class A extends ViewModel {
        static fields = {
            id: new Field({ name: 'id', label: 'Id' }),
        };
    }

    const record1 = new A({ id: 1 });
    expect(record1._pk).toBe(1);

    class B extends ViewModel {
        static pkFieldName = ['id1', 'id2'];
        static fields = {
            id1: new Field({ name: 'id1', label: 'Id' }),
            id2: new Field({ name: 'id2', label: 'Id' }),
        };
    }

    const record2 = new B({ id1: 1, id2: 2 });
    expect(record2._pk).toEqual([1, 2]);
});

test('_assigned fields should be based on passed data', () => {
    class A extends ViewModel {
        static fields = {
            id: new Field({ name: 'id', label: 'Id' }),
            name: new Field({ name: 'name', label: 'Name' }),
            email: new Field({ name: 'email', label: 'Email' }),
        };
    }

    let record = new A({ id: 1 });
    expect(record._assignedFields).toEqual(['id']);

    record = new A({ id: 1, name: 'Dave' });
    expect(record._assignedFields).toEqual(['id', 'name']);
    record = new A({ id: 1, name: 'Dave', email: 'a@b.com' });
    expect(record._assignedFields).toEqual(['email', 'id', 'name']);
});

test('toJS() should be return assigned data', () => {
    class A extends ViewModel {
        static fields = {
            id: new Field({ name: 'id', label: 'Id' }),
            name: new Field({ name: 'name', label: 'Name' }),
            email: new Field({ name: 'email', label: 'Email' }),
        };
    }

    let record = new A({ id: 1 });
    expect(record.toJS()).toEqual({ id: 1 });

    record = new A({ id: 1, name: 'Dave' });
    expect(record.toJS()).toEqual({ id: 1, name: 'Dave' });
    record = new A({ id: 1, name: 'Dave', email: 'a@b.com' });
    expect(record.toJS()).toEqual({ id: 1, name: 'Dave', email: 'a@b.com' });
});

test('toJS() should support custom field behaviour', () => {
    class LowerField extends Field<string> {
        toJS(value: any): string {
            return value.toString().toLowerCase();
        }
    }
    class A extends ViewModel {
        static fields = {
            id: new Field({ name: 'id', label: 'Id' }),
            name: new Field({ name: 'name', label: 'Name' }),
            email: new LowerField({ name: 'email', label: 'Email' }),
        };
    }

    const record = new A({ id: 1, name: 'Dave', email: 'A@B.COM' });
    expect(record.toJS()).toEqual({ id: 1, name: 'Dave', email: 'a@b.com' });
});

test('ViewModel should use normalize() from field', () => {
    class LowerField extends Field<string> {
        normalize(value: any): string {
            return value.toString().toLowerCase();
        }
    }
    class A extends ViewModel {
        static fields = {
            id: new Field({ name: 'id', label: 'Id' }),
            name: new Field({ name: 'name', label: 'Name' }),
            email: new LowerField({ name: 'email', label: 'Email' }),
        };
    }

    const record = new A({ id: 1, name: 'Dave', email: 'A@B.COM' });
    expect(record.email).toBe('a@b.com');
});

test('Should be able to compare if two records are equal', () => {
    class TestDateField extends Field<Date> {
        isEqual(value1: Date, value2: Date): boolean {
            return value1.getTime() === value2.getTime();
        }
    }
    class A extends ViewModel {
        static fields = {
            id: new Field({ name: 'id', label: 'Id' }),
            name: new Field({ name: 'name', label: 'Name' }),
            email: new Field({ name: 'email', label: 'Email' }),
            createdAt: new TestDateField({ name: 'createdAt', label: 'Created At' }),
        };
    }

    expect(new A({ id: 1 }).isEqual(new A({ id: 1 }))).toBe(true);
    expect(new A({ id: 1 }).isEqual(new A({ id: 1, name: null }))).toBe(false);
    expect(new A({ id: 1, name: null }).isEqual(new A({ id: 1, name: null }))).toBe(true);
    expect(
        new A({ id: 1, createdAt: new Date('2019-11-20 18:30') }).isEqual(
            new A({ id: 1, createdAt: new Date('2019-11-20 18:30') })
        )
    ).toBe(true);
    expect(
        new A({ id: 1, createdAt: new Date('2019-11-20 18:30') }).isEqual(
            new A({ id: 1, createdAt: new Date('2019-11-20 18:31') })
        )
    ).toBe(false);
    expect(new A({}).isEqual(new A({}))).toBe(true);

    class B extends ViewModel {
        static fields = {
            id: new Field({ name: 'id', label: 'Id' }),
            name: new Field({ name: 'name', label: 'Name' }),
            email: new Field({ name: 'email', label: 'Email' }),
            createdAt: new TestDateField({ name: 'createdAt', label: 'Created At' }),
        };
    }
    const data = {
        id: 1,
        name: 'John',
        email: 'a@b.com',
    };
    expect(new A(data).isEqual(new B(data))).toBe(false);
});

test('should clone a ViewModel record', () => {
    class A extends ViewModel {
        static fields = {
            id: new Field({ name: 'id', label: 'Id' }),
            name: new Field({ name: 'name', label: 'Name' }),
            email: new Field({ name: 'email', label: 'Email' }),
        };
    }

    const record1 = new A({
        id: 1,
        name: 'bob',
        email: 'a@b',
    });
    const cloneFull = record1.clone();
    expect(cloneFull).not.toBe(record1);
    expect(cloneFull._assignedFields).toEqual(['email', 'id', 'name']);
    expect(cloneFull.isEqual(record1)).toBe(true);

    const cloneName = record1.clone(['id', 'name']);
    expect(cloneName._assignedFields).toEqual(['id', 'name']);
    expect(cloneName.toJS()).toEqual({
        id: 1,
        name: 'bob',
    });

    // Cloning a partial record should result in a partial record
    const clone2 = cloneName.clone();
    expect(clone2).not.toBe(cloneName);
    expect(clone2._assignedFields).toEqual(['id', 'name']);
    expect(clone2.toJS()).toEqual({
        id: 1,
        name: 'bob',
    });
});