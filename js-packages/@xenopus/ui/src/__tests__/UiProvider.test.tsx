import Field from '@xenopus/viewmodel/fields/Field';
import React from 'react';
import { render } from '@testing-library/react';

import FieldWidget, { WidgetProps } from '../FieldWidget';
import useUi from '../useUi';
import UiProvider from '../UiProvider';

test('useUi should warn if no provider', () => {
    // Supress error logs. Even though we catch it below React with log errors out.
    const mockError = jest.spyOn(global.console, 'error').mockImplementation(() => {});
    function TestWrapper(): null {
        useUi();
        return null;
    }
    expect(() => render(<TestWrapper />)).toThrowError(/used within a UiProvider/);
    mockError.mockRestore();
});

test('UiProvider should provide widget', () => {
    function DefaultWidget(props: WidgetProps): React.ReactElement {
        return <>default_widget</>;
    }
    function SpecialWidget(props: WidgetProps): React.ReactElement {
        return <>special_widget</>;
    }
    function getWidget(field): FieldWidget {
        if (field.name === 'special') {
            return SpecialWidget;
        }
        return DefaultWidget;
    }
    function FieldWrapper({ field }): React.ReactElement {
        const { getWidgetForField } = useUi();

        const Widget = getWidgetForField(field);

        return <Widget value={1} onChange={(value: any): any => {}} />;
    }

    function TestWrapper({ field }): React.ReactElement {
        return (
            <UiProvider getWidgetForField={getWidget}>
                <FieldWrapper field={field} />
            </UiProvider>
        );
    }
    const field1 = new Field({ name: 'special', label: 'Special' });
    const field2 = new Field({ name: 'normal', label: 'Normal' });
    const { rerender, container } = render(<TestWrapper field={field1} />);
    expect(container.innerHTML).toBe('special_widget');
    rerender(<TestWrapper field={field2} />);
    expect(container.innerHTML).toBe('default_widget');
});

test('UiProvider should support nested providers', () => {
    function DefaultWidget(props: WidgetProps): React.ReactElement {
        return <>default_widget</>;
    }
    function SpecialWidget(props: WidgetProps): React.ReactElement {
        return <>special_widget</>;
    }
    function NestedWidget(props: WidgetProps): React.ReactElement {
        return <>nested_widget</>;
    }
    function getWidgetOuter(field): FieldWidget {
        if (field.name === 'special') {
            return SpecialWidget;
        }
        if (field.name == 'unknown') {
            return null;
        }
        return DefaultWidget;
    }
    function getWidgetInner(field): FieldWidget {
        if (field.name === 'inner') {
            return NestedWidget;
        }
        return null;
    }
    function FieldWrapper({ field }): React.ReactElement {
        const { getWidgetForField } = useUi();

        const Widget = getWidgetForField(field);

        return <Widget value={1} onChange={(value: any): any => {}} />;
    }

    function TestWrapper({ field }): React.ReactElement {
        return (
            <UiProvider getWidgetForField={getWidgetOuter}>
                <UiProvider getWidgetForField={getWidgetInner}>
                    <FieldWrapper field={field} />
                </UiProvider>
            </UiProvider>
        );
    }
    const field1 = new Field({ name: 'special', label: 'Special' });
    const field2 = new Field({ name: 'normal', label: 'Normal' });
    const field3 = new Field({ name: 'inner', label: 'Inner' });
    const field4 = new Field({ name: 'unknown', label: 'Unknown' });
    const { rerender, container } = render(<TestWrapper field={field1} />);
    expect(container.innerHTML).toBe('special_widget');
    rerender(<TestWrapper field={field2} />);
    expect(container.innerHTML).toBe('default_widget');
    rerender(<TestWrapper field={field3} />);
    expect(container.innerHTML).toBe('nested_widget');
    const mockError = jest.spyOn(global.console, 'error').mockImplementation(() => {});
    expect(() => rerender(<TestWrapper field={field4} />)).toThrowError(
        /No widget provided for field/
    );
    mockError.mockRestore();
});