import React from 'react';
import { render } from '@testing-library/react';
import { UiProvider } from '@prestojs/ui';
import { NumberField, ViewModel, Field, FieldDataMapping } from '@prestojs/viewmodel';
import Form from '../Form';

const userFields = {
    age: new NumberField({ label: 'Age' }),
};
class User extends ViewModel<FieldDataMapping<typeof userFields>> {
    static label = 'User';
    static labelPlural = 'Users';

    static _fields = userFields;
}

function Widget({ input }): React.ReactElement {
    return <input name={input.name} placeholder={input.name} />;
}

function getWidgetForField(): typeof Widget {
    return Widget;
}

test('FormField should provide default widget when none specified', () => {
    function TestWrapper(props): React.ReactElement {
        return (
            <UiProvider getWidgetForField={getWidgetForField}>
                <Form onSubmit={jest.fn()}>
                    {({ handleSubmit }): React.ReactElement => (
                        <form onSubmit={handleSubmit}>
                            <label htmlFor="age">
                                Age
                                <Form.Field field={User.fields.age} {...props} id="age" />
                            </label>
                        </form>
                    )}
                </Form>
            </UiProvider>
        );
    }
    const { rerender, getByLabelText } = render(<TestWrapper />);
    expect(getByLabelText('Age').tagName).toBe('INPUT');
    expect(getByLabelText('Age').getAttribute('placeholder')).toBe('age');
    // Specifying render, component or children should mean we don't inject a widget but
    // use whatever is passed in
    rerender(<TestWrapper component="textarea" />);
    expect(getByLabelText('Age').tagName).toBe('TEXTAREA');
    rerender(<TestWrapper render={(): React.ReactElement => <select />} />);
    expect(getByLabelText('Age').tagName).toBe('SELECT');
    rerender(<TestWrapper>{(): React.ReactElement => <div id="age" />}</TestWrapper>);
    expect(getByLabelText('Age').tagName).toBe('DIV');
});
