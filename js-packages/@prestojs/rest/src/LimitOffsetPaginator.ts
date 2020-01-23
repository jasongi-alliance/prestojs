import { EndpointExecuteOptions } from './Endpoint';
import Paginator from './Paginator';

export type LimitOffsetPaginationState = {
    limit?: number;
    offset?: number;
};

export type InternalLimitOffsetPaginationState = {
    total?: number | null;
};

export default class LimitOffsetPaginator extends Paginator<
    LimitOffsetPaginationState,
    InternalLimitOffsetPaginationState
> {
    get total(): number | null {
        return this.internalState.total ?? null;
    }

    get limit(): number | null {
        return this.currentState.limit ?? null;
    }

    get offset(): number {
        return this.currentState.offset || 0;
    }

    /**
     * Return the state for the specified limit
     *
     * Does not transition state. To transition state call `setLimit` instead.
     */
    limitState(limit: number | null): LimitOffsetPaginationState {
        if (limit != null && limit < 1) {
            throw new Error(`Invalid limit ${limit} - should be >= 1`);
        }
        // When page size changes we need to adjust the offset
        if (limit != null && this.currentState.limit !== limit && this.currentState.offset) {
            const offset = Math.floor(this.currentState.offset / limit) * limit;
            return { ...this.currentState, limit, offset };
        }
        const nextState = { ...this.currentState, limit };
        if (limit == null) {
            delete nextState.offset;
            delete nextState.limit;
        }
        return nextState as LimitOffsetPaginationState;
    }

    setLimit(limit: number | null): void {
        this.setCurrentState(this.limitState(limit));
    }

    /**
     * Return the state for the specified offset
     *
     * Does not transition state. To transition state call `offsetState` instead.
     */
    offsetState(offset: number | null): LimitOffsetPaginationState {
        if (offset != null && offset < 0) {
            throw new Error(`Invalid offset ${offset} - should be >= 0`);
        }

        const nextState = { ...this.currentState, offset };
        if (offset === 0 || offset == null) {
            delete nextState.offset;
        }
        return nextState as LimitOffsetPaginationState;
    }

    setOffset(offset: number | null): void {
        return this.setCurrentState(this.offsetState(offset));
    }

    /**
     * Return the state for the next page
     *
     * Does not transition state. To transition state call `next` instead.
     */
    nextState(): LimitOffsetPaginationState | null {
        if (this.limit == null) {
            return null;
        }
        return this.offsetState(this.offset + this.limit);
    }

    /**
     * Go to the next page
     */
    next(): void {
        const nextState = this.nextState();
        if (nextState) {
            this.setCurrentState(nextState);
        }
    }

    /**
     * Return the state for the previous page
     *
     * Does not transition state. To transition state call `previous` instead.
     */
    previousState(): LimitOffsetPaginationState | null {
        if (this.limit == null) {
            return null;
        }
        return this.offsetState(Math.max(0, this.offset - this.limit));
    }

    /**
     * Go to the previous page.
     */
    previous(): void {
        if (this.limit == null) {
            throw new Error('Cannot go to next page until limit of current results is known');
        }
        this.setOffset(Math.max(0, this.offset - this.limit));
    }

    /**
     * Return the state for the first page
     *
     * Does not transition state. To transition state call `first` instead.
     */
    firstState(): LimitOffsetPaginationState {
        const nextState = { ...this.currentState };
        delete nextState.offset;
        return nextState;
    }

    /**
     * Go to the first page.
     */
    first(): void {
        this.setCurrentState(this.firstState());
    }

    /**
     * Return the state for the last page. If the last page isn't yet known (eg. results
     * haven't yet been returned) then null will be returned.
     *
     * Does not transition state. To transition state call `last` instead.
     */
    lastState(): LimitOffsetPaginationState | null {
        if (null == this.total || null == this.limit) {
            return null;
        }
        const offset = (Math.ceil(this.total / this.limit) - 1) * this.limit;
        return {
            ...this.currentState,
            offset,
        };
    }

    /**
     * Go to the last page.
     *
     * If the last page is not yet known because results haven't been returned this function
     * does nothing.
     */
    last(): void {
        const nextState = this.lastState();

        if (nextState) {
            this.setCurrentState(nextState);
        }
    }

    getRequestInit({ query, ...options }): EndpointExecuteOptions {
        const nextQuery = { ...query };
        if (this.limit) {
            nextQuery.limit = this.limit;
        }
        if (this.offset) {
            nextQuery.offset = this.offset;
        }
        return {
            query: nextQuery,
            ...options,
        };
    }

    setResponse({ limit, total }): void {
        this.setInternalState({ total });
        if (limit && this.currentState.limit !== limit) {
            this.setLimit(limit);
        }
    }
}
