import { WidgetProps } from '@prestojs/ui';
import { TimePicker } from 'antd';
import { TimePickerProps } from 'antd/lib/time-picker';
import React from 'react';

/**
 * See [TimePicker](https://next.ant.design/components/time-picker/) for props available
 *
 * @extract-docs
 * @menu-group Widgets
 * @forward-ref
 */
// FIXME - there's no way to pass value to TimePicker correctly w/o moment being involved atm - its not a standard Date object there.
// ref as RefObject any cause TimePicker's merged as a value in antd unlike any other
const TimeWidget = React.forwardRef(
    (
        { input, ...rest }: WidgetProps<string, HTMLInputElement> & { input: TimePickerProps },
        ref: React.RefObject<any>
    ): React.ReactElement => {
        return <TimePicker ref={ref} {...input} {...rest} />;
    }
);

export default TimeWidget;
