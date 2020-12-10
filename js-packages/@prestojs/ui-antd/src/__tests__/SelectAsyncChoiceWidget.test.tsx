import { PageNumberPaginator, Paginator, usePaginator } from '@prestojs/util';
import {
    AsyncChoices,
    AsyncChoicesOptions,
    ChoicesGrouped,
    Field,
    useViewModelCache,
    viewModelFactory,
} from '@prestojs/viewmodel';
import { act, fireEvent, getAllByTestId, getByText, render, waitFor } from '@testing-library/react';
import React, { useState } from 'react';
import SelectAsyncChoiceWidget from '../widgets/SelectAsyncChoiceWidget';

function delay<T>(fn, timeout = 0): Promise<T> {
    return new Promise((resolve, reject) => setTimeout(() => resolve(fn(reject)), timeout));
}

type TestDataItem = { name: string; id: number; _key: number };
const testData: TestDataItem[] = Array.from({ length: 12 }, (_, i) => ({
    name: `Item ${i}`,
    id: i,
    get _key(): number {
        return this.id;
    },
}));
Object.freeze(testData);

const namesForRange = (start, end): string[] => testData.slice(start, end).map(item => item.name);

function resolveSingle(id: number[]): Promise<TestDataItem[]>;
function resolveSingle(id: number): Promise<TestDataItem>;
function resolveSingle(id: number | number[]): Promise<TestDataItem | TestDataItem[]> {
    if (Array.isArray(id)) {
        return delay(() => id.map(i => testData[i]));
    }
    return delay(reject => {
        if (!testData[id]) {
            return reject('Not found');
        }
        return testData[id];
    });
}

function resolveMulti(
    query: Record<string, any> = {},
    paginator: PageNumberPaginator
): Promise<TestDataItem[]> {
    if (paginator) {
        query = paginator.getRequestInit({ query }).query as Record<string, any>;
    }
    const pageSize = Number(query.pageSize || 5);
    let page = Number(query.page || 1);
    let filteredData = testData;
    if (query.keywords) {
        filteredData = filteredData.filter(item =>
            query.exact ? item.name === query.keywords : item.name.includes(query.keywords)
        );
    }
    const results = filteredData.slice(pageSize * (page - 1), pageSize * page);
    if (paginator) {
        (paginator as PageNumberPaginator).setResponse({
            total: filteredData.length,
            pageSize,
        });
    }
    return delay(() => results);
}

function buildAsyncChoices<Multiple extends boolean>({
    multiple = false as Multiple,
    list = resolveMulti,
    retrieve = resolveSingle,
    ...rest
}: {
    multiple?: Multiple;
    list?: (params: Record<string, any>, deps?: any) => Promise<TestDataItem[]>;
    retrieve?: (
        value: number[] | number,
        deps?: any
    ) => Promise<typeof value extends number[] ? TestDataItem[] : TestDataItem>;
} & Pick<
    AsyncChoicesOptions<TestDataItem, number>,
    'useRetrieveProps' | 'getLabel' | 'getChoices'
>): AsyncChoices<TestDataItem, number> {
    return new AsyncChoices({
        multiple: multiple as Multiple,
        useListProps(): { paginator: Paginator<any, any> } {
            return { paginator: usePaginator(PageNumberPaginator) };
        },
        list(params): Promise<TestDataItem[]> {
            return list(params.query || {}, params.paginator);
        },
        retrieve(
            value: number[] | number
        ): Promise<typeof value extends number[] ? TestDataItem[] : TestDataItem> {
            return retrieve(value);
        },
        getLabel(item: TestDataItem): React.ReactNode {
            return item.name;
        },
        getValue(item: TestDataItem): number {
            return item.id;
        },
        ...rest,
    });
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function buildInput(value: number | null | number[] = null) {
    return {
        name: 'test',
        onChange: jest.fn(),
        onBlur: jest.fn(),
        onFocus: jest.fn(),
        value,
    };
}

const widgetProps = {
    optionProps: {
        'data-testid': 'select-option',
    },
};

async function waitForOptions(id: any, names: string[]): Promise<any> {
    await waitFor(() =>
        expect(getAllByTestId(id, 'select-option').map(item => item.textContent)).toEqual(names)
    );
    // I don't understand why but adding this avoided various 'Warning: An update to PopupInner inside a test was not wrapped in act(...).'
    // warnings.
    await waitFor(() => getByText(id, names[0]));
}

function waitForSelectedValue(container, value: string | string[]): Promise<any> {
    if (Array.isArray(value)) {
        return waitFor(() =>
            expect(
                [...(container.querySelectorAll('.ant-select-selection-item') || [])].map(
                    item => item.textContent
                )
            ).toEqual(value)
        );
    }
    return waitFor(() =>
        expect(container.querySelector('.ant-select-selection-item')?.textContent).toBe(value)
    );
}

function openDropDown(container): void {
    const select = container.querySelector('.ant-select-selector');
    if (!select) throw new Error('Expected select');
    act(() => {
        fireEvent.mouseDown(select);
    });
}

afterEach(async () => {
    jest.useRealTimers();
});

test('should support fetching all paginated records', async () => {
    const input = buildInput();
    const list = jest.fn(resolveMulti);
    const asyncChoices = buildAsyncChoices({ list });
    const { baseElement, container, getByText, queryByText } = render(
        <SelectAsyncChoiceWidget
            asyncChoices={asyncChoices}
            input={input}
            virtual={false}
            {...widgetProps}
        />
    );
    openDropDown(container);
    expect(getByText('Fetching results...')).toBeInTheDocument();
    expect(list).toHaveBeenCalled();
    await waitForOptions(baseElement, namesForRange(0, 5));
    act(() => {
        fireEvent.click(getByText('Fetch More'));
    });
    expect(list).toHaveBeenCalledTimes(2);
    await waitForOptions(baseElement, namesForRange(0, 10));
    act(() => {
        fireEvent.click(getByText('Fetch More'));
    });
    expect(list).toHaveBeenCalledTimes(3);
    await waitForOptions(baseElement, namesForRange(0, 12));
    expect(queryByText('Fetch More')).toBeNull();
});

test('should reset pagination on keyword changes', async () => {
    const input = buildInput();
    const list = jest.fn(resolveMulti);
    const asyncChoices = buildAsyncChoices({ list });
    const { baseElement, container, getByText, getByRole } = render(
        <SelectAsyncChoiceWidget
            asyncChoices={asyncChoices}
            input={input}
            virtual={false}
            debounceWait={0}
            accumulatePages={false}
            {...widgetProps}
        />
    );
    openDropDown(container);
    expect(getByText('Fetching results...')).toBeInTheDocument();
    expect(list).toHaveBeenCalled();
    await waitForOptions(baseElement, namesForRange(0, 5));
    act(() => {
        fireEvent.click(getByText('Fetch More'));
    });
    expect(list).toHaveBeenCalledTimes(2);
    await waitForOptions(baseElement, namesForRange(5, 10));
    act(() => {
        fireEvent.change(getByRole('combobox'), { target: { value: 'Item' } });
    });
    // Search matches all items but we should only get first page again
    await waitForOptions(baseElement, namesForRange(0, 5));
    act(() => {
        fireEvent.click(getByText('Fetch More'));
    });
    await waitForOptions(baseElement, namesForRange(5, 10));
});

test('should support initial value', async () => {
    const input = buildInput(2);
    const list = jest.fn(resolveMulti);
    const retrieve = jest.fn(resolveSingle);
    const asyncChoices = buildAsyncChoices({ list, retrieve });
    const { container, baseElement, getByText, rerender } = render(
        <SelectAsyncChoiceWidget asyncChoices={asyncChoices} input={input} {...widgetProps} />
    );
    expect(list).not.toHaveBeenCalled();
    expect(retrieve).toHaveBeenCalledTimes(1);
    await waitForSelectedValue(container, 'Item 2');
    input.value = 4;
    rerender(
        <SelectAsyncChoiceWidget asyncChoices={asyncChoices} input={input} {...widgetProps} />
    );
    expect(list).not.toHaveBeenCalled();
    expect(retrieve).toHaveBeenCalledTimes(2);
    await waitForSelectedValue(container, 'Item 4');

    // Now trigger a listing which will fetch the first 5 records
    openDropDown(container);
    expect(getByText('Fetching results...')).toBeInTheDocument();
    expect(list).toHaveBeenCalledTimes(1);
    await waitForOptions(baseElement, namesForRange(0, 5));
    // Changing selected value to Item 1 should not trigger another fetch; we already
    // have it from the list call
    input.value = 1;
    rerender(
        <SelectAsyncChoiceWidget asyncChoices={asyncChoices} input={input} {...widgetProps} />
    );
    expect(list).toHaveBeenCalledTimes(1);
    expect(retrieve).toHaveBeenCalledTimes(2);
    await waitForSelectedValue(container, 'Item 1');
    // await waitFor(() => getByText('Item 1'));
});

test('should support onRetrieveError', async () => {
    const input = buildInput(2);
    const list = jest.fn(resolveMulti);
    const retrieve = jest.fn(resolveSingle);
    // On error unset the value
    const onRetrieveError = jest.fn((error, { input: { onChange } }) => {
        onChange(null);
    });
    const asyncChoices = buildAsyncChoices({ list, retrieve });
    function Wrapper(): React.ReactElement {
        const [value, setValue] = useState(input.value);
        // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
        // @ts-ignore
        input.onChange = setValue;
        input.value = value;
        return (
            <SelectAsyncChoiceWidget
                asyncChoices={asyncChoices}
                input={input}
                onRetrieveError={onRetrieveError}
                {...widgetProps}
            />
        );
    }
    const { container } = render(<Wrapper />);
    expect(list).not.toHaveBeenCalled();
    expect(retrieve).toHaveBeenCalledTimes(1);
    await waitForSelectedValue(container, 'Item 2');
    act(() => {
        input.onChange(66);
    });
    expect(list).not.toHaveBeenCalled();
    expect(retrieve).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(onRetrieveError).toHaveBeenCalledTimes(1));
    expect(container.querySelector('.ant-select-selection-item')).not.toBeInTheDocument();
});

test('should call onChange with selected value', async () => {
    const input = buildInput();
    const list = jest.fn(resolveMulti);
    const asyncChoices = buildAsyncChoices({ list });
    const { baseElement, container, getByText } = render(
        <SelectAsyncChoiceWidget
            asyncChoices={asyncChoices}
            input={input}
            virtual={false}
            {...widgetProps}
        />
    );
    openDropDown(container);
    expect(getByText('Fetching results...')).toBeInTheDocument();
    expect(list).toHaveBeenCalled();
    await waitForOptions(baseElement, namesForRange(0, 5));
    act(() => {
        fireEvent.click(getByText('Item 2'));
    });
    expect(input.onChange).toHaveBeenCalledWith(2);
    openDropDown(container);
    await waitForOptions(baseElement, namesForRange(0, 5));
    act(() => {
        fireEvent.click(getByText('Fetch More'));
    });
    await waitForOptions(baseElement, namesForRange(0, 10));
    act(() => {
        fireEvent.click(getByText('Item 7'));
    });
    expect(input.onChange).toHaveBeenLastCalledWith(7);
    expect(input.onChange).toHaveBeenCalledTimes(2);
});

test('should be able to integrate with viewmodel cache', async () => {
    const User = viewModelFactory({
        name: new Field(),
    });
    async function wrappedResolveMulti(
        query: Record<string, any> = {},
        paginator: PageNumberPaginator
    ): Promise<TestDataItem[]> {
        const results = await resolveMulti(query, paginator);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        User.cache.addList(results.map(({ _key, ...rest }) => rest));
        return results;
    }
    const list = jest.fn(wrappedResolveMulti);
    const retrieve = jest.fn(resolveSingle);
    const asyncChoices = buildAsyncChoices({
        list,
        retrieve,
        getLabel(item: TestDataItem): React.ReactNode {
            return (User.cache.get(item.id, ['name']) || item).name;
        },
        useRetrieveProps({ id }) {
            const existing = useViewModelCache(User, cache =>
                id ? cache.get(id, ['name']) : null
            );
            return {
                existingValues: existing ? [existing] : null,
            };
        },
    });
    const input = buildInput();
    const { baseElement, container, getByText, rerender } = render(
        <SelectAsyncChoiceWidget
            asyncChoices={asyncChoices}
            input={input}
            virtual={false}
            {...widgetProps}
        />
    );
    openDropDown(container);
    expect(getByText('Fetching results...')).toBeInTheDocument();
    expect(list).toHaveBeenCalledTimes(1);
    await waitForOptions(baseElement, namesForRange(0, 5));
    input.value = 4;
    rerender(
        <SelectAsyncChoiceWidget
            asyncChoices={asyncChoices}
            input={input}
            virtual={false}
            {...widgetProps}
        />
    );
    // Modify cache value - should rerender with new value
    act(() => {
        User.cache.add({ id: 4, name: 'Item 4 New Name' });
    });
    expect(retrieve).not.toHaveBeenCalled();
    await waitForOptions(baseElement, [...namesForRange(0, 4), 'Item 4 New Name']);
    await waitForSelectedValue(container, 'Item 4 New Name');

    act(() => {
        User.cache.add({ id: 66, name: 'Item 66' });
    });
    input.value = 66;
    rerender(
        <SelectAsyncChoiceWidget
            asyncChoices={asyncChoices}
            input={input}
            virtual={false}
            {...widgetProps}
        />
    );
    expect(retrieve).not.toHaveBeenCalled();
    await waitForSelectedValue(container, 'Item 66');
    act(() => {
        User.cache.delete(66);
    });
    await waitForOptions(baseElement, [...namesForRange(0, 4), 'Item 4 New Name']);
    // Value missing, defaults to render the raw value
    await waitForSelectedValue(container, '66');
});

test('should handle grouped choices', async () => {
    const input = buildInput();
    const list = jest.fn(resolveMulti);
    const asyncChoices = buildAsyncChoices({
        list,
        getChoices(items) {
            const groups: ChoicesGrouped<any>[] = [];
            for (const item of items) {
                if (item.id < 5) {
                    if (groups.length === 0) {
                        groups.push(['Items 0 - 5', []]);
                    }
                    groups[0][1].push({
                        value: this.getValue(item),
                        label: this.getLabel(item),
                    });
                } else {
                    if (groups.length === 1) {
                        groups.push(['Items 5+', []]);
                    }
                    groups[1][1].push({
                        value: this.getValue(item),
                        label: this.getLabel(item),
                    });
                }
            }
            return groups;
        },
    });
    const { baseElement, container, getByText, queryByText } = render(
        <SelectAsyncChoiceWidget
            asyncChoices={asyncChoices}
            input={input}
            virtual={false}
            {...widgetProps}
        />
    );
    openDropDown(container);
    expect(getByText('Fetching results...')).toBeInTheDocument();
    expect(list).toHaveBeenCalled();
    await waitForOptions(baseElement, namesForRange(0, 5));
    expect(getByText('Items 0 - 5')).toBeInTheDocument();
    expect(queryByText('Items 5+')).not.toBeInTheDocument();
    act(() => {
        fireEvent.click(getByText('Fetch More'));
    });
    expect(list).toHaveBeenCalledTimes(2);
    await waitForOptions(baseElement, namesForRange(0, 10));
    expect(getByText('Items 0 - 5')).toBeInTheDocument();
    expect(getByText('Items 5+')).toBeInTheDocument();
    act(() => {
        fireEvent.click(getByText('Fetch More'));
    });
    expect(list).toHaveBeenCalledTimes(3);
    await waitForOptions(baseElement, namesForRange(0, 12));
    expect(queryByText('Fetch More')).toBeNull();
});

test('should support loadingContent', async () => {
    const input = buildInput();
    const list = jest.fn(resolveMulti);
    const asyncChoices = buildAsyncChoices({ list });
    const { baseElement, container, getByTestId, getByRole } = render(
        <SelectAsyncChoiceWidget
            asyncChoices={asyncChoices}
            input={input}
            virtual={false}
            loadingContent={<div data-testid="loading">Loading...</div>}
            notFoundContent={<div data-testid="not-found">No matches</div>}
            {...widgetProps}
        />
    );
    openDropDown(container);
    expect(getByTestId('loading')).toHaveTextContent('Loading...');
    expect(list).toHaveBeenCalled();
    await waitForOptions(baseElement, namesForRange(0, 5));
    act(() => {
        fireEvent.change(getByRole('combobox'), { target: { value: 'NO_MATCH' } });
    });
    await waitFor(() => expect(getByTestId('not-found')).toHaveTextContent('No matches'));
    act(() => {
        fireEvent.change(getByRole('combobox'), { target: { value: 'Item 2' } });
    });
    await waitFor(() => expect(getByTestId('loading')).toHaveTextContent('Loading...'));
    await waitForOptions(baseElement, namesForRange(2, 3));
});

test('should support custom fetch more button', async () => {
    const input = buildInput();
    const list = jest.fn(resolveMulti);
    const asyncChoices = buildAsyncChoices({ list });
    const { baseElement, container, getByTestId, getByText, queryByText } = render(
        <SelectAsyncChoiceWidget
            asyncChoices={asyncChoices}
            input={input}
            virtual={false}
            renderNextPageButton={({ onClick }): React.ReactNode => (
                <button data-testid="next-page" onClick={onClick}>
                    Next
                </button>
            )}
            {...widgetProps}
        />
    );
    openDropDown(container);
    expect(getByText('Fetching results...')).toBeInTheDocument();
    expect(list).toHaveBeenCalled();
    await waitForOptions(baseElement, namesForRange(0, 5));
    expect(getByTestId('next-page')).toHaveTextContent('Next');
    act(() => {
        fireEvent.click(getByTestId('next-page'));
    });
    expect(list).toHaveBeenCalledTimes(2);
    await waitForOptions(baseElement, namesForRange(0, 10));
    act(() => {
        fireEvent.click(getByTestId('next-page'));
    });
    expect(list).toHaveBeenCalledTimes(3);
    await waitForOptions(baseElement, namesForRange(0, 12));
    expect(queryByText('Next Page')).toBeNull();
});

test('should support disabling fetch more button', async () => {
    const input = buildInput();
    const list = jest.fn(resolveMulti);
    const asyncChoices = buildAsyncChoices({ list });
    const { baseElement, container, getByText, queryByText } = render(
        <SelectAsyncChoiceWidget
            asyncChoices={asyncChoices}
            input={input}
            virtual={false}
            renderNextPageButton={false}
            {...widgetProps}
        />
    );
    openDropDown(container);
    expect(getByText('Fetching results...')).toBeInTheDocument();
    expect(list).toHaveBeenCalled();
    await waitForOptions(baseElement, namesForRange(0, 5));
    expect(queryByText('Fetch More')).toBeNull();
});

test('should support triggerWhenClosed', async () => {
    const input = buildInput();
    const list = jest.fn(resolveMulti);
    const asyncChoices = buildAsyncChoices({ list });
    const { baseElement, container } = render(
        <SelectAsyncChoiceWidget
            asyncChoices={asyncChoices}
            input={input}
            virtual={false}
            triggerWhenClosed
            {...widgetProps}
        />
    );
    expect(list).toHaveBeenCalledTimes(1);
    openDropDown(container);
    await waitForOptions(baseElement, namesForRange(0, 5));
    expect(list).toHaveBeenCalledTimes(1);
});

test('should work if asyncChoices instance changes', async () => {
    const input = buildInput();
    const list1 = jest.fn(resolveMulti);
    const list2 = jest.fn(resolveMulti);
    const asyncChoices1 = buildAsyncChoices({ list: list1 });
    const asyncChoices2 = buildAsyncChoices({ list: list2 });
    const { baseElement, container, getByText, rerender } = render(
        <SelectAsyncChoiceWidget
            asyncChoices={asyncChoices1}
            input={input}
            virtual={false}
            {...widgetProps}
        />
    );
    openDropDown(container);
    expect(list1).toHaveBeenCalledTimes(1);
    await waitForOptions(baseElement, namesForRange(0, 5));
    act(() => {
        fireEvent.click(getByText('Fetch More'));
    });
    expect(list1).toHaveBeenCalledTimes(2);
    await waitForOptions(baseElement, namesForRange(0, 10));
    rerender(
        <SelectAsyncChoiceWidget
            asyncChoices={asyncChoices2}
            input={input}
            virtual={false}
            {...widgetProps}
        />
    );
    expect(list1).toHaveBeenCalledTimes(2);
    expect(list2).toHaveBeenCalledTimes(1);
    await waitForOptions(baseElement, namesForRange(0, 5));
    act(() => {
        fireEvent.click(getByText('Fetch More'));
    });
    expect(list1).toHaveBeenCalledTimes(2);
    expect(list2).toHaveBeenCalledTimes(2);
    await waitForOptions(baseElement, namesForRange(0, 10));
});

test('should support multi select', async () => {
    const input = buildInput([2, 3]);
    const list = jest.fn(resolveMulti);
    const retrieve = jest.fn(resolveSingle);
    const asyncChoices = buildAsyncChoices<true>({ list, retrieve, multiple: true });
    const { container, baseElement, rerender } = render(
        <SelectAsyncChoiceWidget asyncChoices={asyncChoices} input={input} {...widgetProps} />
    );
    expect(list).not.toHaveBeenCalled();
    expect(retrieve).toHaveBeenCalledTimes(1);
    await waitForSelectedValue(container, ['Item 2', 'Item 3']);
    input.value = [4];
    rerender(
        <SelectAsyncChoiceWidget asyncChoices={asyncChoices} input={input} {...widgetProps} />
    );
    expect(list).not.toHaveBeenCalled();
    expect(retrieve).toHaveBeenCalledTimes(2);
    await waitForSelectedValue(container, ['Item 4']);

    // Now trigger a listing which will fetch the first 5 records
    openDropDown(container);
    expect(list).toHaveBeenCalledTimes(1);
    await waitForOptions(baseElement, namesForRange(0, 5));
    // Changing selected value to Item 1 should not trigger another fetch; we already
    // have it from the list call
    input.value = [1];
    rerender(
        <SelectAsyncChoiceWidget asyncChoices={asyncChoices} input={input} {...widgetProps} />
    );
    expect(list).toHaveBeenCalledTimes(1);
    expect(retrieve).toHaveBeenCalledTimes(2);
    await waitForSelectedValue(container, ['Item 1']);
});

test('support filtering results', async () => {
    const input = buildInput();
    const list = jest.fn(resolveMulti);
    const asyncChoices = buildAsyncChoices({ list });
    const { baseElement, container, getByText, getByRole } = render(
        <SelectAsyncChoiceWidget
            asyncChoices={asyncChoices}
            input={input}
            virtual={false}
            debounceWait={0}
            {...widgetProps}
        />
    );
    openDropDown(container);
    expect(getByText('Fetching results...')).toBeInTheDocument();
    expect(list).toHaveBeenCalled();
    await waitForOptions(baseElement, namesForRange(0, 5));
    act(() => {
        fireEvent.change(getByRole('combobox'), { target: { value: 'Item 1' } });
    });
    await waitForOptions(baseElement, ['Item 1', 'Item 10', 'Item 11']);
    act(() => {
        fireEvent.change(getByRole('combobox'), { target: { value: 'Item 2' } });
    });
    await waitForOptions(baseElement, ['Item 2']);
});

test('should support custom query parameter name', async () => {
    const input = buildInput();
    const list = jest.fn(resolveMulti);
    const asyncChoices = buildAsyncChoices({ list });
    const { baseElement, container, getByText, getByRole } = render(
        <SelectAsyncChoiceWidget
            asyncChoices={asyncChoices}
            input={input}
            virtual={false}
            debounceWait={0}
            buildQuery={({ keywords }): {} => ({ keywords, exact: true })}
            {...widgetProps}
        />
    );
    openDropDown(container);
    expect(getByText('Fetching results...')).toBeInTheDocument();
    await waitForOptions(baseElement, namesForRange(0, 5));
    act(() => {
        fireEvent.change(getByRole('combobox'), { target: { value: 'Item 1' } });
    });
    await waitForOptions(baseElement, ['Item 1']);
    act(() => {
        fireEvent.change(getByRole('combobox'), { target: { value: 'Item 2' } });
    });
    await waitForOptions(baseElement, ['Item 2']);
});

test('search triggered after unmount due to debounce should not error', async () => {
    const input = buildInput();
    const list = jest.fn(resolveMulti);
    const asyncChoices = buildAsyncChoices({ list });
    const { unmount, container, baseElement, getByText, getByRole } = render(
        <SelectAsyncChoiceWidget
            asyncChoices={asyncChoices}
            input={input}
            virtual={false}
            {...widgetProps}
        />
    );
    const errorSpy = jest.spyOn(global.console, 'error');
    openDropDown(container);
    expect(getByText('Fetching results...')).toBeInTheDocument();
    expect(list).toHaveBeenCalled();
    await waitForOptions(baseElement, namesForRange(0, 5));
    jest.useFakeTimers();
    act(() => {
        fireEvent.change(getByRole('combobox'), { target: { value: 'Item 1' } });
    });
    unmount();
    act(() => {
        jest.runAllTimers();
    });
    expect(errorSpy).not.toHaveBeenCalled();
});

test('should support clearOnOpen', async () => {
    const input = buildInput();
    const list = jest.fn(resolveMulti);
    const asyncChoices = buildAsyncChoices({ list });
    const { baseElement, container, getByText, rerender } = render(
        <SelectAsyncChoiceWidget
            asyncChoices={asyncChoices}
            input={input}
            virtual={false}
            clearOnOpen={false}
            {...widgetProps}
        />
    );
    openDropDown(container);
    expect(getByText('Fetching results...')).toBeInTheDocument();
    expect(list).toHaveBeenCalled();
    await waitForOptions(baseElement, namesForRange(0, 5));
    act(() => {
        fireEvent.click(getByText('Fetch More'));
    });
    await waitForOptions(baseElement, namesForRange(0, 10));
    act(() => {
        fireEvent.click(getByText('Item 7'));
    });
    // Opening drop down again should have retained all fetched records
    openDropDown(container);
    await waitForOptions(baseElement, namesForRange(0, 10));
    act(() => {
        fireEvent.click(getByText('Item 1'));
    });
    // Re-render with clearOnOpen=true and it should only have the first page of results again
    rerender(
        <SelectAsyncChoiceWidget
            asyncChoices={asyncChoices}
            input={input}
            virtual={false}
            clearOnOpen={true}
            {...widgetProps}
        />
    );
    openDropDown(container);
    expect(getByText('Fetching results...')).toBeInTheDocument();
    await waitForOptions(baseElement, namesForRange(0, 5));
});

test.todo('should support tags mode');
