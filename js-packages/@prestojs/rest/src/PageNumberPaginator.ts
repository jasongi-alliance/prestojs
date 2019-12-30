import { EndpointExecuteOptions } from './Endpoint';
import Paginator, { PaginationStateChangeListener } from './Paginator';

export type PageNumberPaginationState = {
    page?: number;
    pageSize?: number;
};

export default class PageNumberPaginator extends Paginator {
    total: number | null = null;

    get totalPages(): number | null {
        if (null == this.total || null == this.pageSize) {
            return null;
        }
        return Math.ceil(this.total / this.pageSize);
    }

    get page(): number | null | undefined {
        return this.currentState.page;
    }

    get pageSize(): number | null | undefined {
        return this.currentState.pageSize;
    }

    constructor(
        initialState: PageNumberPaginationState = {},
        onChange?: PaginationStateChangeListener
    ) {
        super(initialState || {}, onChange);
    }

    gotoPage(page: number): void {
        const totalPages = this.totalPages;
        if (page < 1) {
            throw new Error(`Invalid page ${page} - should be >= 1`);
        }
        if (totalPages !== null && page > totalPages) {
            throw new Error(`Invalid page ${page} - last page is ${totalPages}`);
        }
        this.setState(currentState => ({ ...currentState, page }));
    }

    setPageSize(pageSize: number): void {
        if (pageSize < 1) {
            throw new Error(`Invalid pageSize ${pageSize} - should be >= 1`);
        }
        this.setState(currentState => {
            // When page size changes we need to reset the page to page 1
            if (currentState.pageSize !== pageSize && currentState.page) {
                return { ...currentState, pageSize, page: 1 };
            }
            return { ...currentState, pageSize };
        });
    }

    next(): void {
        this.gotoPage((this.page || 1) + 1);
    }

    previous(): void {
        this.gotoPage((this.page || 1) - 1);
    }

    first(): void {
        this.gotoPage(1);
    }

    last(): void {
        if (null == this.total || null == this.pageSize) {
            throw new Error(
                'Cannot go to last page until pageSize and total number of results is known'
            );
        }
        this.gotoPage(Math.ceil(this.total / this.pageSize));
    }

    getRequestInit({ query, ...options }): EndpointExecuteOptions {
        const newQuery = { ...query };
        if (this.currentState.pageSize) {
            newQuery.pageSize = this.currentState.pageSize;
        }
        if (this.currentState.page) {
            newQuery.page = this.currentState.page;
        }
        return {
            query: newQuery,
            ...options,
        };
    }

    setResponse({ total, pageSize }: { total: number; pageSize?: number }): void {
        this.total = total;
        if (pageSize && this.currentState.pageSize !== pageSize) {
            this.setState(currentState => ({ ...currentState, pageSize }));
        }
    }

    syncState(state?: PageNumberPaginationState): void {
        if (!state) {
            return;
        }
        const nextState: PageNumberPaginationState = {};
        if (state.pageSize && state.pageSize !== this.pageSize) {
            nextState.pageSize = state.pageSize;
        }
        if (state.page && state.page !== this.page) {
            nextState.page = state.page;
        }
        if (Object.keys(nextState).length > 0) {
            this.setState(currentState => ({ ...currentState, ...nextState }));
        }
    }
}