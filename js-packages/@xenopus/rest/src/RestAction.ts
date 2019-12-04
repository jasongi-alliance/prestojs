/**
 * TODO: Name? Action too overloaded? RestApi?
 */
import { UrlPattern } from '@xenopus/routing';
import isEqual from 'lodash/isEqual';

type ExecuteInitOptions = Omit<RequestInit, 'headers'> & {
    headers?: HeadersInit | Record<string, undefined | string>;
};

type RestActionOptions = ExecuteInitOptions & {
    decodeBody?: (res: Response) => any;
    transformBody?: (data: any) => any;
};

type UrlResolveOptions = {
    urlArgs?: Record<string, any>;
    query?: Record<string, boolean | string | null | number>;
};

type PrepareOptions = ExecuteInitOptions & UrlResolveOptions;

/**
 * Merge two Headers instances together
 */
function mergeHeaders(headers1: Headers, headers2: Headers): Headers {
    headers2.forEach((value, key) => {
        headers1.set(key, value);
    });
    return headers1;
}

// If we pass an object to useSWR it uses it as the key but if we pass a function (eg. execute) then
/**
 * Given multiple RequestInit objects merge them into a single RequestInit merging headers
 * from each one. Does not merge body. The last object passed with the value set takes
 * precedence.
 *
 * @param args
 */
function mergeRequestInit(...args: ExecuteInitOptions[]): RequestInit {
    return args.reduce((acc: RequestInit, init) => {
        const { headers: currentHeaders, ...rest } = init;
        Object.assign(acc, rest);
        if (currentHeaders) {
            const headersToDelete: string[] = [];
            let headersToAssign: HeadersInit;
            if (!(currentHeaders instanceof Headers)) {
                const entries = Array.isArray(currentHeaders)
                    ? currentHeaders
                    : Object.entries(currentHeaders);
                const filteredEntries: HeadersInit = [];
                for (const [key, value] of entries) {
                    if (value === undefined) {
                        headersToDelete.push(key);
                    } else {
                        filteredEntries.push([key, value]);
                    }
                }
                headersToAssign = new Headers(filteredEntries);
            } else {
                headersToAssign = currentHeaders;
            }
            const mergedHeaders: Headers = mergeHeaders(
                new Headers(acc.headers || {}),
                headersToAssign
            );
            headersToDelete.forEach(key => mergedHeaders.delete(key));
            acc.headers = mergedHeaders;
        }
        return acc;
    }, {});
}

// it will call that to generate the key... which is not what we want
class PreparedAction {
    action: RestAction;
    options: PrepareOptions;
    urlResolveOptions: UrlResolveOptions;

    constructor(
        action: RestAction,
        urlResolveOptions: UrlResolveOptions,
        options: ExecuteInitOptions
    ) {
        this.action = action;
        this.options = options;
        this.urlResolveOptions = urlResolveOptions;
    }

    execute(init: ExecuteInitOptions = {}): Promise<any> {
        // TODO: This means that if this.options or init tries to remove
        // a default header by setting it to undefined it will not work
        // as the resulting object is a `Headers` instance that has had
        // the key removed from it already... but then in execute in RestAction
        // we merge it with the defaultConfig
        return this.action.execute({
            ...this.urlResolveOptions,
            ...mergeRequestInit(this.options, init),
        });
    }
}

/**
 * Indicates a response outside the 200 range
 *
 * @param status response status code
 * @param statusText HTTP status code message
 * @param content the contents returned by server as processed be decodeBody
 */
export class ApiError extends Error {
    status: number;
    statusText: string;
    content: any;
    constructor(status: number, statusText: string, content: any) {
        super();
        this.status = status;
        this.statusText = statusText;
        this.content = content;
        this.message = `${status} - ${statusText}`;
    }
}

export class RequestError extends Error {}

/**
 * Decode body and return content based on Content-Type
 *
 * If type includes 'json' (eg. application/json) returns decoded json
 * If type includes 'text (eg. text/plain, text/html) returns text
 * If status is 204 or 205 will return null
 *
 * Otherwise Response object itself is returned
 * @param response
 */
function defaultDecodeBody(response: Response): Response | Record<string, any> | string | null {
    const contentType = response.headers.get('Content-Type');
    const emptyCodes = [204, 205];

    if (emptyCodes.includes(response.status)) {
        return null;
    }

    if (contentType && contentType.includes('json')) {
        return response.json();
    }

    if (contentType && contentType.includes('text')) {
        return response.text();
    }

    // TODO: Do we bother handling blob types? eg. response.blob() if image/* etc

    return response;
}

/**
 * Describe an REST API endpoint that can then be executed.
 *
 * Accepts a `UrlPattern` and optionally a `decodeBody` function which decodes the `Response` body as returned by
 * `fetch` and a `transformBody` function that can transform the decoded body. The default `decodeBody` handles
 * decoding the data based on content type and is suitable for endpoints that return JSON or text with the appropriate
 * content types. If you just wish to do something with the decoded data (eg. the JSON data) use `transformBody`.
 *
 * In addition you can pass all options accepted by `fetch` and these will be used as defaults to any call to `execute`
 * or `prepare`.
 *
 * Usage:
 *
 * ```js
 * const userList = new Action(new UrlPattern('/api/users/'));
 * const users = await userList.execute();
 * ```
 *
 * You can pass `urlArgs` and `query` to resolve the URL:
 *
 * ```js
 * const userDetail = new Action(new UrlPattern('/api/user/:id/'));
 * // Resolves to /api/user/1/?showAddresses=true
 * const user = await userDetail.execute({ urlArgs: { id: 1 }, query: 'showAddresses': true });
 * ```
 *
 * You can also pass through any `fetch` options to both the constructor and calls to `execute` and `prepare`
 *
 * ```
 * // Always pass through Content-Type header to all calls to userDetail
 * const userDetail = new Action(new UrlPattern('/api/user/:id/'), {
 *     'Content-Type': 'application/json'
 * });
 * // Set other fetch options at execution time
 * userDetail.execute({ urlArgs: { id: 1 }, method: 'PATCH', body: JSON.stringify({ name: 'Dave' }) });
 * ```
 *
 * Often you have some global options you want to apply everywhere. This can be set on `RestAction`
 * directly:
 *
 * ```js
 * // Set default options to pass through to the request init option of `fetch`
 * RestAction.defaultConfig.requestInit = {
 *   headers: {
 *     'X-CSRFToken': getCsrfToken(),
 *   },
 * };
 *
 * // All actions will now use the default headers specified
 * userDetail.execute({ urlArgs: { id: 1 } });
 * ```
 *
 * You can also "prepare" an action for execution by calling the `prepare` method. Each call to prepare will
 * return the same object (ie. it passes strict equality checks) given the same parameters. This is useful when
 * you need to have a stable cache key for an action. For example you may have a React hook that executes
 * your action when things change:
 *
 * ```js
 * import useSWR from 'swr';
 *
 * ...
 *
 * // prepare the action and pass it to useSWR. useSWR will then call the second parameter (the "fetcher")
 * // which executes the prepared action.
 * const { data } = useSWR([action.prepare()], (preparedAction) => preparedAction.execute());
 * ```
 *
 * You can wrap this up in a custom hook to make usage more ergonomic:
 *
 * ```js
 * import { useCallback } from 'react';
 * import useSWR from 'swr';
 *
 * /**
 * * Wrapper around useSWR for use with `RestAction`
 * * @param action RestAction to execute. Can be null if not yet ready to execute
 * * @param args Any args to pass through to `prepare`
 * * @return Object Same values as returned by useSWR with the addition of `execute` which
 * * can be used to execute the action directly, optionally with new arguments.
 * *
 * export default function useRestAction(action, args) {
 *   const preparedAction = action ? action.prepare(args) : null;
 *   const execute = useCallback(init => preparedAction.execute(init), [preparedAction]);
 *   return {
 *     execute,
 *     ...useSWR(preparedAction && [preparedAction], act => act.execute()),
 *   };
 * }
 * ```
 */
export default class RestAction {
    static defaultConfig: { requestInit: RequestInit } = {
        requestInit: {},
    };

    urlPattern: UrlPattern;
    transformBody?: (data: any) => any;
    urlCache: Map<string, Map<{}, PreparedAction>>;
    decodeBody: (res: Response) => any;
    requestInit: ExecuteInitOptions;

    constructor(
        urlPattern: UrlPattern,
        { decodeBody = defaultDecodeBody, transformBody, ...requestInit }: RestActionOptions = {}
    ) {
        this.urlPattern = urlPattern;
        this.transformBody = transformBody;
        this.urlCache = new Map();
        this.decodeBody = decodeBody;
        this.requestInit = requestInit;
    }

    /**
     * Prepare an action for execution. Given the same parameters returns the same object. This is useful
     * when using libraries like `useSWR` that accept a parameter that identifies a request and is used
     * for caching but execution is handled by a separate function.
     *
     * For example to use with `useSWR` you can do:
     *
     * ```js
     * const { data } = useSWR([action.prepare()], (preparedAction) => preparedAction.execute());
     * ```
     *
     * If you just want to call the action directly then you can bypass `prepare` and just call `execute`
     * directly.
     */
    prepare({ urlArgs = {}, query, ...init }: PrepareOptions = {}): PreparedAction {
        const url = this.urlPattern.resolve(urlArgs, { query });
        let cache = this.urlCache.get(url);
        if (!cache) {
            cache = new Map();
            this.urlCache.set(url, cache);
        }
        for (const [key, value] of cache.entries()) {
            if (isEqual(key, init)) {
                return value;
            }
        }
        const execute = new PreparedAction(this, { urlArgs, query }, init);
        cache.set(init, execute);
        return execute;
    }

    /**
     * Triggers the `fetch` call for an action
     *
     * This can be called directly or indirectly via `prepare`.
     *
     * If the fetch call itself fails (eg. a network error) a `RequestError` will be thrown.
     *
     * If the response is a non-2XX response an `ApiError` will be thrown.
     *
     * If the call is successful the body will be decoded using `decodeBody`. The default implementation
     * will decode JSON to an object or return text based on the content type. If the content type is
     * not JSON or text the raw `Response` will be returned.
     *
     * You can transform the decoded body with `transformBody`. This is useful if you need to do something
     * with the returned data. For example you could add it to a cache or create an instance of a class.
     *
     * ```js
     * // Via prepare
     * const preparedAction = action.prepare({ urlArgs: { id: '1' }});
     * preparedAction.execute();
     *
     * // Directly
     * action.execute({ urlArgs: { id: '1' }});
     * ```
     *
     * @param urlArgs args to pass through to `urlPattern.resolve`
     * @param query query params to pass through to `urlPattern.resolve`
     * @param init Options to pass to `fetch`. These will be merged with any options passed to `RestAction` directly
     * and `RestAction.defaultConfig.requestInit`. Options passed here will take precedence. Only the `headers` key will be merged if it
     * exists in multiple places (eg. defaultConfig may include headers you want on every request). If you need to remove
     * a header entirely set the value to `undefined`.
     */
    async execute({ urlArgs = {}, query, ...init }: PrepareOptions = {}): Promise<any> {
        const url = this.urlPattern.resolve(urlArgs, { query });
        try {
            const cls = Object.getPrototypeOf(this).constructor;
            return fetch(
                url,
                mergeRequestInit(cls.defaultConfig.requestInit, this.requestInit, init)
            )
                .then(async res => {
                    if (!res.ok) {
                        throw new ApiError(res.status, res.statusText, await this.decodeBody(res));
                    }
                    return res;
                })
                .then(res => this.decodeBody(res))
                .then(data => (this.transformBody ? this.transformBody(data) : data));
        } catch (err) {
            // Fetch itself threw an error. This can happen on network error.
            // All other errors (eg. 40X responses) are handled above on res.ok
            // check
            throw new RequestError(err.message);
        }
    }
}
