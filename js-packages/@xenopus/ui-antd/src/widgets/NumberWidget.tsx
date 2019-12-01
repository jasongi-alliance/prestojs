import { WidgetProps } from '@xenopus/ui';
import { InputNumber } from 'antd';
import React from 'react';

/**
 * See [InputNumber](https://ant.design/components/input-number/) for props available
 */
export default function NumberWidget({
    input,
}: WidgetProps<number, HTMLElement>): React.ReactElement {
    return <InputNumber {...input} />;
}
