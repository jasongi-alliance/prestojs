import { UrlPattern } from '@prestojs/routing';
import { renderHook } from '@testing-library/react-hooks';
import { FetchMock } from 'jest-fetch-mock';
import { useState } from 'react';
import { act } from 'react-test-renderer';
import Endpoint, { ApiError, RequestError } from '../Endpoint';
import getPaginationState from '../getPaginationState';
import InferredPaginator from '../InferredPaginator';
import LimitOffsetPaginator from '../LimitOffsetPaginator';
import PageNumberPaginator from '../PageNumberPaginator';
import PaginatedEndpoint from '../PaginatedEndpoint';
import { PaginatorInterface, PaginatorInterfaceClass } from '../Paginator';

const fetchMock = fetch as FetchMock;

function useTestHook(
    paginatorClass: PaginatorInterfaceClass,
    initialState = {}
): PaginatorInterface {
    return new paginatorClass(useState(initialState), useState());
}

beforeEach(() => {
    fetchMock.resetMocks();
    Endpoint.defaultConfig.requestInit = {};
    Endpoint.defaultConfig.getPaginationState = getPaginationState;
});

test('prepare should maintain equality based on inputs', () => {
    const action = new Endpoint(new UrlPattern('/whatever/:id?/'));
    const a = action.prepare();
    expect(a).toBe(action.prepare());
    const b = action.prepare({ query: { a: 'b' } });
    expect(a).not.toBe(b);
    expect(b).toBe(action.prepare({ query: { a: 'b' } }));
    expect(b).not.toBe(action.prepare({ query: { a: 'c' } }));
    const c = action.prepare({ urlArgs: { id: 1 } });
    const d = action.prepare({ urlArgs: { id: 2 } });
    expect(c).not.toBe(d);
    expect(c).not.toBe(a);
    expect(c).toBe(action.prepare({ urlArgs: { id: 1 } }));

    const eArgs = { urlArgs: { id: 1 }, body: JSON.stringify({ a: 1, b: 2 }) };
    const e = action.prepare(eArgs);
    expect(e).toBe(action.prepare(eArgs));

    const fArgs = { urlArgs: { id: 1 }, headers: { Accept: 'application/json' } };
    const f = action.prepare(fArgs);
    expect(f).toBe(action.prepare(fArgs));
    expect(e).not.toBe(a);

    // Paginator should be factored into equality checks
    const noop = (): void => undefined;
    const gArgs = {
        urlArgs: { id: 1 },
        // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
        // @ts-ignore
        paginator: new PageNumberPaginator([{}, noop], [{}, noop]),
    };
    const g = action.prepare(gArgs);
    expect(g).toBe(action.prepare(gArgs));
    // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
    // @ts-ignore
    gArgs.paginator = new PageNumberPaginator([{}, noop], [{}, noop]);
    expect(g).not.toBe(action.prepare(gArgs));
});

test('should resolve URLs', () => {
    fetchMock.mockResponse('');
    const action = new Endpoint(new UrlPattern('/whatever/:id?/'));
    action.prepare().execute();
    expect(fetchMock.mock.calls.length).toEqual(1);
    expect(fetchMock.mock.calls[0][0]).toEqual('/whatever/');
    action.prepare({ urlArgs: { id: 2 } }).execute();
    expect(fetchMock.mock.calls.length).toEqual(2);
    expect(fetchMock.mock.calls[1][0]).toEqual('/whatever/2/');
    action.prepare({ urlArgs: { id: 2 }, query: { a: 'b' } }).execute();
    expect(fetchMock.mock.calls.length).toEqual(3);
    expect(fetchMock.mock.calls[2][0]).toEqual('/whatever/2/?a=b');
    action.prepare({ query: { a: 'b' } }).execute();
    expect(fetchMock.mock.calls.length).toEqual(4);
    expect(fetchMock.mock.calls[3][0]).toEqual('/whatever/?a=b');
});

test('should support calling execute without prepare', () => {
    fetchMock.mockResponse('');
    const action = new Endpoint(new UrlPattern('/whatever/:id?/'));
    action.execute();
    expect(fetchMock.mock.calls.length).toEqual(1);
    expect(fetchMock.mock.calls[0][0]).toEqual('/whatever/');
    action.execute({ urlArgs: { id: 2 } });
    expect(fetchMock.mock.calls.length).toEqual(2);
    expect(fetchMock.mock.calls[1][0]).toEqual('/whatever/2/');
    action.execute({ urlArgs: { id: 2 }, query: { a: 'b' } });
    expect(fetchMock.mock.calls.length).toEqual(3);
    expect(fetchMock.mock.calls[2][0]).toEqual('/whatever/2/?a=b');
    action.execute({ query: { a: 'b' } });
    expect(fetchMock.mock.calls.length).toEqual(4);
    expect(fetchMock.mock.calls[3][0]).toEqual('/whatever/?a=b');
});

test('should support transformation function', async () => {
    fetchMock.mockResponseOnce('hello world', {
        headers: {
            'Content-Type': 'text/plain',
        },
    });
    const action1 = new Endpoint(new UrlPattern('/whatever/'), {
        transformResponseBody: (data: Record<string, any>): Record<string, any> =>
            data.toUpperCase(),
    });
    expect((await action1.prepare().execute()).result).toBe('HELLO WORLD');
    const action2 = new Endpoint(new UrlPattern('/whatever/'), {
        transformResponseBody: (data: Record<string, any>): Record<string, any> =>
            Object.entries(data).reduce((acc, [k, v]) => ({ ...acc, [v]: k }), {}),
    });
    fetchMock.mockResponseOnce(JSON.stringify({ a: 'b', c: 'd' }), {
        headers: {
            'Content-Type': 'application/json',
        },
    });
    expect((await action2.prepare().execute()).result).toEqual({ b: 'a', d: 'c' });
});

test('should support merging global headers with action specific headers', async () => {
    fetchMock.mockResponse('');
    const expectHeadersEqual = (headers2): void => {
        const headers1 = new Headers(
            // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
            // @ts-ignore
            fetchMock.mock.calls[fetchMock.mock.calls.length - 1][1].headers
        );
        headers2 = new Headers(headers2);

        // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
        // @ts-ignore
        expect([...headers1.entries()]).toEqual([...headers2.entries()]);
    };
    const action1 = new Endpoint(new UrlPattern('/whatever/:id?/'));
    action1.prepare({ headers: { c: 'd' } }).execute({
        headers: { a: 'b' },
    });
    expectHeadersEqual({ a: 'b', c: 'd' });

    action1.prepare({ headers: new Headers({ c: 'd' }) }).execute({
        headers: { a: 'b' },
    });
    expectHeadersEqual({ a: 'b', c: 'd' });

    action1.prepare({ headers: new Headers({ c: 'd' }) }).execute({
        headers: [
            ['a', 'b'],
            ['e', 'f'],
        ],
    });
    expectHeadersEqual({ a: 'b', c: 'd', e: 'f' });

    action1
        .prepare({
            headers: [
                ['a', '1'],
                ['b', '2'],
            ],
        })
        .execute({
            headers: new Headers({
                // This will take precedence over config above
                b: '5',
                c: '10',
            }),
        });
    expectHeadersEqual({ a: '1', b: '5', c: '10' });

    const action2 = new Endpoint(new UrlPattern('/whatever/:id?/'), { headers: { a: 'one' } });
    action2.prepare({ headers: { b: 'two' } }).execute({
        headers: { c: 'three' },
    });
    expectHeadersEqual({ a: 'one', b: 'two', c: 'three' });

    action2.prepare({ headers: { b: 'two' } }).execute({
        headers: { b: undefined, c: 'three' },
    });
    expectHeadersEqual({ a: 'one', c: 'three' });

    Endpoint.defaultConfig.requestInit = {
        headers: {
            token: 'abc123',
            extra: '5',
        },
    };

    action2.prepare().execute({
        headers: { c: 'three' },
    });
    expectHeadersEqual({ a: 'one', c: 'three', token: 'abc123', extra: '5' });

    action2.execute({
        headers: { c: 'three', extra: undefined },
    });
    expectHeadersEqual({ a: 'one', c: 'three', token: 'abc123' });
});

test('should raise RequestError on bad request', async () => {
    fetchMock.mockResponseOnce(() => {
        throw new TypeError('Unknown error');
    });
    const action1 = new Endpoint(new UrlPattern('/whatever/'));
    let error;
    try {
        await action1.execute();
    } catch (err) {
        error = err;
    }
    expect(error).not.toBeFalsy();
    expect(error).toBeInstanceOf(RequestError);
    expect(error.message).toEqual('Unknown error');
});

test('should raise ApiError on non-2xx response', async () => {
    fetchMock.mockResponseOnce('', { status: 400, statusText: 'Bad Request' });
    const action1 = new Endpoint(new UrlPattern('/whatever/'));
    await expect(action1.execute()).rejects.toThrowError(new ApiError(400, 'Bad Request', ''));
    fetchMock.mockResponseOnce('', { status: 500, statusText: 'Server Error' });
    await expect(action1.execute()).rejects.toThrowError(new ApiError(500, 'Server Error', ''));

    fetchMock.mockResponseOnce(JSON.stringify({ name: 'This field is required' }), {
        headers: {
            'Content-Type': 'application/json',
        },
        status: 400,
        statusText: 'Bad Request',
    });
    let error;
    try {
        await action1.execute();
    } catch (err) {
        error = err;
    }
    expect(error).not.toBeFalsy();
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(400);
    expect(error.statusText).toBe('Bad Request');
    expect(error.content).toEqual({ name: 'This field is required' });
});

test('should update paginator state on response', async () => {
    const action1 = new PaginatedEndpoint(new UrlPattern('/whatever/'));
    let { result: hookResult } = renderHook(() => useTestHook(action1.getPaginatorClass()));

    const records = Array.from({ length: 5 }, (_, i) => ({ id: i }));
    fetchMock.mockResponseOnce(JSON.stringify({ count: 10, results: records }), {
        headers: {
            'Content-Type': 'application/json',
        },
    });
    await act(async () => {
        const { result } = await action1.execute({ paginator: hookResult.current });
        expect((hookResult.current as InferredPaginator).paginator).toBeInstanceOf(
            PageNumberPaginator
        );
        expect(
            ((hookResult.current as InferredPaginator).paginator as PageNumberPaginator).pageSize
        ).toBe(5);
        expect(result).toEqual(records);
    });

    // Should also work by passing paginator to prepare
    hookResult = renderHook(() => useTestHook(action1.getPaginatorClass())).result;
    fetchMock.mockResponseOnce(
        JSON.stringify({
            count: 10,
            results: records,
            next: 'http://loclahost/whatever/?limit=5&offset=5',
        }),
        {
            headers: {
                'Content-Type': 'application/json',
            },
        }
    );
    const prepared = action1.prepare({ paginator: hookResult.current });

    await act(async () => {
        const { result: result2 } = await prepared.execute();

        expect((hookResult.current as InferredPaginator).paginator).toBeInstanceOf(
            LimitOffsetPaginator
        );
        expect(
            ((hookResult.current as InferredPaginator).paginator as LimitOffsetPaginator).limit
        ).toBe(5);
        expect(result2).toEqual(records);
    });
});

test('should support changing paginatorClass & getPaginationState', async () => {
    Endpoint.defaultConfig.paginatorClass = PageNumberPaginator;
    Endpoint.defaultConfig.getPaginationState = (paginator, execReturnVal): Record<string, any> => {
        const { total, records, pageSize } = execReturnVal.decodedBody;
        return {
            total,
            results: records,
            pageSize,
        };
    };
    const action1 = new PaginatedEndpoint(new UrlPattern('/whatever/'));
    const { result: hookResult } = renderHook(() => useTestHook(action1.getPaginatorClass()));

    const records = Array.from({ length: 5 }, (_, i) => ({ id: i }));
    fetchMock.mockResponseOnce(JSON.stringify({ total: 10, records, pageSize: 5 }), {
        headers: {
            'Content-Type': 'application/json',
        },
    });
    await act(async () => {
        const { result } = await action1.execute({ paginator: hookResult.current });
        expect(hookResult.current).toBeInstanceOf(PageNumberPaginator);
        expect((hookResult.current as PageNumberPaginator).pageSize).toBe(5);
        expect(result).toEqual(records);
    });
});

test('should support custom URL resolve function', () => {
    fetchMock.mockResponse('');
    const endpoint = new Endpoint(new UrlPattern('/whatever/:id?/'), {
        resolveUrl(urlPattern, urlArgs, query): string {
            return urlPattern.resolve(urlArgs, { query: { ...query, always: 1 } });
        },
    });
    endpoint.prepare().execute();
    expect(fetchMock.mock.calls.length).toEqual(1);
    expect(fetchMock.mock.calls[0][0]).toEqual('/whatever/?always=1');
    endpoint.prepare({ urlArgs: { id: 2 } }).execute();
    expect(fetchMock.mock.calls.length).toEqual(2);
    expect(fetchMock.mock.calls[1][0]).toEqual('/whatever/2/?always=1');
    endpoint.prepare({ urlArgs: { id: 2 }, query: { a: 'b' } }).execute();
    expect(fetchMock.mock.calls.length).toEqual(3);
    expect(fetchMock.mock.calls[2][0]).toEqual('/whatever/2/?a=b&always=1');
    endpoint.prepare({ query: { a: 'b' } }).execute();
    expect(fetchMock.mock.calls.length).toEqual(4);
    expect(fetchMock.mock.calls[3][0]).toEqual('/whatever/?a=b&always=1');

    // Same thing but call execute directly without prepare
    fetchMock.resetMocks();
    endpoint.execute();
    expect(fetchMock.mock.calls.length).toEqual(1);
    expect(fetchMock.mock.calls[0][0]).toEqual('/whatever/?always=1');
    endpoint.execute({ urlArgs: { id: 2 } });
    expect(fetchMock.mock.calls.length).toEqual(2);
    expect(fetchMock.mock.calls[1][0]).toEqual('/whatever/2/?always=1');
    endpoint.execute({ urlArgs: { id: 2 }, query: { a: 'b' } });
    expect(fetchMock.mock.calls.length).toEqual(3);
    expect(fetchMock.mock.calls[2][0]).toEqual('/whatever/2/?a=b&always=1');
    endpoint.execute({ query: { a: 'b' } });
    expect(fetchMock.mock.calls.length).toEqual(4);
    expect(fetchMock.mock.calls[3][0]).toEqual('/whatever/?a=b&always=1');
});
