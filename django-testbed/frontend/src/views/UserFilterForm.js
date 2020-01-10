import React from 'react';
import { Form, useForm } from '@prestojs/final-form';
import { Button, Collapse } from 'antd';

import { UserFilterSet } from '../models/User';

const { Panel } = Collapse;

function ClearButton() {
    const api = useForm();
    return (
        <Button
            onClick={() => {
                api.reset();
                api.submit();
            }}
        >
            Reset
        </Button>
    );
}

export default function UserFilterForm({ onApplyFilter }) {
    return (
        <Collapse defaultActiveKey={['generatedFilterForm']}>
            <Panel header="Filters" key="generatedFilterForm">
                <Form onSubmit={onApplyFilter}>
                    <Form.Item field={UserFilterSet.fields.id} />
                    <Form.Item field={UserFilterSet.fields.first_name} />
                    <Form.Item field={UserFilterSet.fields.last_name} />
                    <Button htmlType="submit" type="primary">
                        Search
                    </Button>
                    <ClearButton />
                </Form>
            </Panel>
        </Collapse>
    );
}