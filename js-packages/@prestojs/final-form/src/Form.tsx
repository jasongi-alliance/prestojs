import { useUi } from '@prestojs/ui';
import React from 'react';
import { ViewModel } from '@prestojs/viewmodel';
import { Form as FinalForm, FormProps as FinalFormProps } from 'react-final-form';
import FormField from './FormField';
import FormItem from './FormItem';

type FormProps<FormValues = object> = FinalFormProps<FormValues> & {
    initialValues?: FormValues | ViewModel<any>;
    formProps?: Record<string, any>;
};

/**
 * Wrapper around react-final-form with some extensions
 *
 * 1) You can pass a record to `initialValues` and it will pass through the underlying data to the form
 *
 * 2) final-form expects a function as a child which you then render a `<form>` element with and pass through
 *    handleSubmit. Most the time this is the same thing so you optionally just pass through renderable
 *    children and the form will be created implicitly for you.
 *
 * @extract-docs
 */
export default function Form({
    initialValues,
    children,
    formProps,
    ...rest
}: FormProps): React.ReactElement {
    let { formComponent: FormComponent } = useUi();
    if (!FormComponent) {
        FormComponent = 'form';
    }
    if (initialValues instanceof ViewModel) {
        initialValues = initialValues.serializeToForm();
    }
    if (typeof children !== 'function') {
        const renderableChildren = children;
        children = ({ handleSubmit }): React.ReactElement => (
            <FormComponent onSubmit={handleSubmit} {...formProps}>
                {renderableChildren}
            </FormComponent>
        );
    }
    return (
        <FinalForm {...rest} initialValues={initialValues}>
            {children}
        </FinalForm>
    );
}

Form.Field = FormField;
Form.Item = FormItem;
