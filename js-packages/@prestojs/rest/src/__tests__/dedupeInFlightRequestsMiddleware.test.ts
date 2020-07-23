import { UrlPattern } from '@prestojs/routing';
import { FetchMock } from 'jest-fetch-mock';
import dedupeInFlightRequestsMiddleware from '../dedupeInFlightRequestsMiddleware';
import Endpoint from '../Endpoint';

const fetchMock = fetch as FetchMock;

beforeEach(() => {
    fetchMock.resetMocks();
    Endpoint.defaultConfig.requestInit = {};
});

test('should de-dupe in flight requests', async () => {
    let i = 0;
    fetchMock.mockResponse(() =>
        Promise.resolve({
            body: `hello world ${i++}`,
            init: {
                headers: {
                    'Content-Type': 'text/plain',
                },
            },
        })
    );
    const action1 = new Endpoint(new UrlPattern('/whatever/'), {
        middleware: [dedupeInFlightRequestsMiddleware()],
    });
    const p1 = action1.prepare().execute();
    const p2 = action1.prepare().execute();
    expect((await p1).result).toBe('hello world 0');
    expect((await p2).result).toBe('hello world 0');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((await action1.prepare().execute()).result).toBe('hello world 1');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const init1 = { headers: new Headers({ 'x-test': '123' }) };
    const p3 = action1.prepare().execute(init1);
    const p4 = action1.prepare().execute(init1);
    expect((await p3).result).toBe('hello world 2');
    expect((await p4).result).toBe('hello world 2');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect((await action1.prepare().execute(init1)).result).toBe('hello world 3');
    expect(fetchMock).toHaveBeenCalledTimes(4);
    const init5 = { headers: new Headers({ 'x-test': 'abc' }) };
    const init6 = { headers: new Headers({ 'x-test': '123' }) };
    const p5 = action1.prepare().execute(init5);
    const p6 = action1.prepare().execute(init6);
    expect((await p5).result).toBe('hello world 4');
    expect((await p6).result).toBe('hello world 5');
    expect(fetchMock).toHaveBeenCalledTimes(6);
});

test('should support customising key', async () => {
    let i = 0;
    fetchMock.mockResponse(() =>
        Promise.resolve({
            body: `hello world ${i++}`,
            init: {
                headers: {
                    'Content-Type': 'text/plain',
                },
            },
        })
    );
    const action1 = new Endpoint(new UrlPattern('/whatever/'), {
        middleware: [
            dedupeInFlightRequestsMiddleware({
                // Set key to ignore headers, only care about url
                getKey: url => url,
            }),
        ],
    });
    const p1 = action1.prepare().execute();
    const p2 = action1.prepare().execute();
    const p3 = action1.prepare().execute({ headers: { 'x-test': '123' } });
    expect((await p1).result).toBe('hello world 0');
    expect((await p2).result).toBe('hello world 0');
    expect((await p3).result).toBe('hello world 0');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((await action1.prepare().execute()).result).toBe('hello world 1');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const p4 = action1.prepare().execute();
    const p5 = action1.prepare().execute({ method: 'post' });
    expect((await p4).result).toBe('hello world 2');
    expect((await p5).result).toBe('hello world 3');
    expect(fetchMock).toHaveBeenCalledTimes(4);
});

test('should support customising test', async () => {
    let i = 0;
    fetchMock.mockResponse(() =>
        Promise.resolve({
            body: `hello world ${i++}`,
            init: {
                headers: {
                    'Content-Type': 'text/plain',
                },
            },
        })
    );
    const action1 = new Endpoint(new UrlPattern('/whatever/'), {
        middleware: [
            dedupeInFlightRequestsMiddleware({
                // All requests are subject to dedupe regardless of method
                test: () => true,
                getKey: url => url,
            }),
        ],
    });
    const p1 = action1.prepare().execute();
    const p2 = action1.prepare().execute({ method: 'POST' });
    const p3 = action1.prepare().execute({ method: 'PUT' });
    expect((await p1).result).toBe('hello world 0');
    expect((await p2).result).toBe('hello world 0');
    expect((await p3).result).toBe('hello world 0');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((await action1.prepare().execute()).result).toBe('hello world 1');
    expect(fetchMock).toHaveBeenCalledTimes(2);
});
