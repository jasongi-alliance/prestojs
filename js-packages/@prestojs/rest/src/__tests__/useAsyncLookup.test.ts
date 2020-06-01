import { act, renderHook } from '@testing-library/react-hooks';
import PageNumberPaginator from '../PageNumberPaginator';
import useAsyncLookup from '../useAsyncLookup';
import usePaginator from '../usePaginator';

type TestDataItem = { name: string; pk: number };
const testData: TestDataItem[] = Array.from({ length: 20 }, (_, i) => ({
    name: `Item ${i}`,
    pk: i,
}));

function delay<T>(fn): Promise<T> {
    return new Promise((resolve, reject) => setTimeout(() => resolve(fn(reject))));
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function mockedPaginatedResponse({ query, paginator }): Promise<TestDataItem[]> {
    if (paginator) {
        query = paginator.getRequestInit({ query }).query;
    }
    const pageSize = Number(query.pageSize || 5);
    let page = Number(query.page || 1);
    if (query.last) {
        page = 4;
    }
    let filteredData = testData;
    if (query.search) {
        filteredData = filteredData.filter(item => item.name.includes(query.search));
    }
    const results = filteredData.slice(pageSize * (page - 1), pageSize * page);
    if (paginator) {
        (paginator as PageNumberPaginator).setResponse({ total: filteredData.length, pageSize });
    }
    return delay(() => results);
}

function advanceTimers(): Promise<any> {
    return act(async () => {
        await jest.runAllTimers();
    });
}

function usePaginatorTestHook(props): ReturnType<typeof useAsyncLookup> {
    const paginator = usePaginator(PageNumberPaginator);
    return useAsyncLookup({
        ...props,
        paginator,
    });
}

test('useAsyncLookup should work without a paginator object', async () => {
    jest.useFakeTimers();
    const execute = jest.fn(mockedPaginatedResponse);
    const { result, rerender } = renderHook(
        ({ query }) =>
            useAsyncLookup({
                execute,
                query,
            }),
        { initialProps: { query: {} } }
    );
    expect(result.current.isLoading).toBe(true);
    expect(execute).toHaveBeenCalledTimes(1);
    await advanceTimers();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.result).toEqual(testData.slice(0, 5));
    rerender({ query: { search: 'Item 2' } });
    expect(result.current.isLoading).toBe(true);
    expect(execute).toHaveBeenCalledTimes(2);
    await advanceTimers();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.result).toEqual([testData[2]]);
    expect(execute).toHaveBeenCalledTimes(2);
});

test('useAsyncLookup should handle errors', async () => {
    jest.useFakeTimers();
    const execute = jest.fn((): Promise<TestDataItem[]> => delay(reject => reject('No good')));
    const { result } = renderHook(() =>
        useAsyncLookup({
            execute,
        })
    );
    expect(result.current.isLoading).toBe(true);
    expect(execute).toHaveBeenCalledTimes(1);
    await advanceTimers();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toEqual('No good');
});

test('useAsyncLookup should support paginator', async () => {
    jest.useFakeTimers();
    const execute = jest.fn(mockedPaginatedResponse);
    const { result, rerender } = renderHook(
        props =>
            usePaginatorTestHook({
                execute,
                ...props,
            }),
        { initialProps: {} }
    );
    expect(result.current.isLoading).toBe(true);
    expect(execute).toHaveBeenCalledTimes(1);
    await advanceTimers();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.result).toEqual(testData.slice(0, 5));
    const { paginator } = result.current;
    expect(paginator).toBeInstanceOf(PageNumberPaginator);
    if (!paginator) throw new Error('Expected paginator');
    act(() => paginator.next());
    expect(result.current.isLoading).toBe(true);
    expect(execute).toHaveBeenCalledTimes(2);
    await advanceTimers();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.result).toEqual(testData.slice(5, 10));
    rerender({ query: { search: '1' } });
    expect(result.current.isLoading).toBe(true);
    expect(execute).toHaveBeenCalledTimes(3);
    await advanceTimers();
    // Changing query should have reset paginator state
    expect(paginator.currentState).toEqual({ page: 1, pageSize: 5 });
    expect(result.current.result).toEqual([testData[1], ...testData.slice(10, 14)]);
    act(() => paginator.next());
    await advanceTimers();
    expect(result.current.result).toEqual(testData.slice(14, 19));
});

test('useAsyncLookup should support accumulatePages', async () => {
    jest.useFakeTimers();
    const execute = jest.fn(mockedPaginatedResponse);
    const { result, rerender } = renderHook(
        props =>
            usePaginatorTestHook({
                accumulatePages: true,
                execute,
                ...props,
            }),
        { initialProps: {} }
    );
    expect(result.current.isLoading).toBe(true);
    expect(execute).toHaveBeenCalledTimes(1);
    await advanceTimers();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.result).toEqual(testData.slice(0, 5));
    const { paginator } = result.current;
    expect(paginator).toBeInstanceOf(PageNumberPaginator);
    if (!paginator) throw new Error('Expected paginator');
    act(() => paginator.next());
    expect(result.current.isLoading).toBe(true);
    expect(execute).toHaveBeenCalledTimes(2);
    await advanceTimers();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.result).toEqual(testData.slice(0, 10));
    rerender({ query: { search: '1' } });
    expect(result.current.isLoading).toBe(true);
    expect(execute).toHaveBeenCalledTimes(3);
    await advanceTimers();
    // Changing query should have reset paginator state
    expect(paginator.currentState).toEqual({ page: 1, pageSize: 5 });
    expect(result.current.result).toEqual([testData[1], ...testData.slice(10, 14)]);
    act(() => paginator.next());
    await advanceTimers();
    expect(result.current.result).toEqual([testData[1], ...testData.slice(10, 19)]);

    // Changing back to first page should clear accumulated data
    act(() => paginator.first());
    await advanceTimers();
    expect(result.current.result).toEqual([testData[1], ...testData.slice(10, 14)]);
    rerender({ query: {} });
    await advanceTimers();

    // Jumping to anything other than next page should reset accumulated values
    expect(result.current.result).toEqual(testData.slice(0, 5));
    act(() => paginator.next());
    await advanceTimers();
    expect(result.current.result).toEqual(testData.slice(0, 10));
    act(() => (paginator as PageNumberPaginator).setPage(4));
    await advanceTimers();
    expect(result.current.result).toEqual(testData.slice(15, 20));

    // Changing page size should clear accumulated data
    act(() => paginator.first());
    await advanceTimers();
    expect(result.current.result).toEqual(testData.slice(0, 5));
    act(() => paginator.next());
    await advanceTimers();
    expect(result.current.result).toEqual(testData.slice(0, 10));
    act(() => (paginator as PageNumberPaginator).setPageSize(3));
    await advanceTimers();
    // Note that the page number is retained - just not the accumulated results
    expect(result.current.result).toEqual(testData.slice(3, 6));
    act(() => paginator.next());
    await advanceTimers();
    expect(result.current.result).toEqual(testData.slice(3, 9));
});

test('useAsyncLookup should support trigger option', async () => {
    jest.useFakeTimers();
    const execute = jest.fn(mockedPaginatedResponse);
    const { result, rerender } = renderHook(
        ({ trigger, query = {} }: { trigger: 'SHALLOW' | 'MANUAL'; query?: {} }) =>
            usePaginatorTestHook({
                execute,
                trigger,
                query,
            }),
        { initialProps: { trigger: 'MANUAL', query: {} } }
    );
    expect(result.current.isLoading).toBe(false);
    expect(execute).toHaveBeenCalledTimes(0);
    expect(result.current.result).toEqual(null);
    rerender({ trigger: 'SHALLOW' });
    expect(result.current.isLoading).toBe(true);
    await advanceTimers();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.result).toEqual(testData.slice(0, 5));
    rerender({ trigger: 'MANUAL' });
    expect(result.current.isLoading).toBe(false);
    // Value is retained as all else remains constant
    expect(result.current.result).toEqual(testData.slice(0, 5));
    // If paginator changes and trigger is manual value should be cleared
    act(() => (result.current.paginator as PageNumberPaginator).next());
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(null);
    expect(result.current.result).toEqual(null);

    // Run call so we have a result again
    act(() => {
        result.current.run();
    });
    await advanceTimers();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(null);
    expect(result.current.result).toEqual(testData.slice(5, 10));

    // If query changes value should also be cleared while trigger is MANUAL
    rerender({ trigger: 'MANUAL', query: { search: 'Item 2' } });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(null);
    expect(result.current.result).toEqual(null);

    // Changing back to SHALLOW while maintaining same query must trigger fetch
    rerender({ trigger: 'SHALLOW', query: { search: 'Item 2' } });
    expect(result.current.isLoading).toBe(true);
    await advanceTimers();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.result).toEqual([testData[2]]);
});

test('useAsyncLookup should not cause issues if unmounted', async () => {
    jest.useFakeTimers();
    const execute = jest.fn(mockedPaginatedResponse);
    const { result, unmount } = renderHook(
        ({ query }) =>
            useAsyncLookup({
                execute,
                query,
            }),
        { initialProps: { query: {} } }
    );
    const errorSpy = jest.spyOn(global.console, 'error');
    expect(result.current.isLoading).toBe(true);
    expect(execute).toHaveBeenCalledTimes(1);
    unmount();
    await advanceTimers();
    expect(errorSpy).not.toHaveBeenCalled();
});

test('useAsyncLookup should support reset', async () => {
    jest.useFakeTimers();
    const execute = jest.fn(mockedPaginatedResponse);
    const { result, rerender } = renderHook(
        ({ query }) =>
            useAsyncLookup({
                execute,
                query,
            }),
        { initialProps: { query: {} } }
    );
    expect(result.current.isLoading).toBe(true);
    expect(execute).toHaveBeenCalledTimes(1);
    await advanceTimers();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.result).toEqual(testData.slice(0, 5));
    act(() => {
        result.current.reset();
    });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.result).toEqual(null);
    rerender({ query: { search: 'Item 2' } });
    expect(result.current.isLoading).toBe(true);
    expect(execute).toHaveBeenCalledTimes(2);
    await advanceTimers();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.result).toEqual([testData[2]]);
    expect(execute).toHaveBeenCalledTimes(2);
});

test('useAsyncLookup should support run', async () => {
    jest.useFakeTimers();
    const execute = jest.fn(mockedPaginatedResponse);
    const { result, rerender } = renderHook(
        ({ query }) =>
            useAsyncLookup({
                execute,
                query,
                trigger: 'MANUAL',
            }),
        { initialProps: { query: {} } }
    );
    expect(result.current.isLoading).toBe(false);
    act(() => {
        result.current.run();
    });
    expect(result.current.isLoading).toBe(true);
    expect(execute).toHaveBeenCalledTimes(1);
    await advanceTimers();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.result).toEqual(testData.slice(0, 5));
    rerender({ query: { search: 'Item 2' } });
    expect(result.current.isLoading).toBe(false);
    act(() => {
        result.current.run();
    });
    expect(result.current.isLoading).toBe(true);
    expect(execute).toHaveBeenCalledTimes(2);
    await advanceTimers();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.result).toEqual([testData[2]]);
    expect(execute).toHaveBeenCalledTimes(2);
});
// TODO: Should we support single values? eg. don't require array unless accumulating