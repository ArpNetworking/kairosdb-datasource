import _ from "lodash";
import { Moment } from "moment";
export interface RawTimeRange {
    from: any;
    to: Moment | string;
}
export declare function getRelativeTimesList(timepickerSettings: any, currentDisplay: any): _.Dictionary<(number | {
    from: string;
    to: string;
    display: string;
    section: number;
} | (() => {
    from: string;
    to: string;
    display: string;
    section: number;
}[]) | (<U>(callbackfn: (value: {
    from: string;
    to: string;
    display: string;
    section: number;
}, index: number, array: {
    from: string;
    to: string;
    display: string;
    section: number;
}[]) => U, thisArg?: any) => U[]) | {
    <S extends {
        from: string;
        to: string;
        display: string;
        section: number;
    }>(callbackfn: (value: {
        from: string;
        to: string;
        display: string;
        section: number;
    }, index: number, array: {
        from: string;
        to: string;
        display: string;
        section: number;
    }[]) => value is S, thisArg?: any): S[];
    (callbackfn: (value: {
        from: string;
        to: string;
        display: string;
        section: number;
    }, index: number, array: {
        from: string;
        to: string;
        display: string;
        section: number;
    }[]) => any, thisArg?: any): {
        from: string;
        to: string;
        display: string;
        section: number;
    }[];
} | ((callbackfn: (value: {
    from: string;
    to: string;
    display: string;
    section: number;
}, index: number, array: {
    from: string;
    to: string;
    display: string;
    section: number;
}[]) => boolean, thisArg?: any) => boolean) | (() => string) | ((...items: {
    from: string;
    to: string;
    display: string;
    section: number;
}[]) => number) | (() => {
    from: string;
    to: string;
    display: string;
    section: number;
}) | {
    (...items: ConcatArray<{
        from: string;
        to: string;
        display: string;
        section: number;
    }>[]): {
        from: string;
        to: string;
        display: string;
        section: number;
    }[];
    (...items: ({
        from: string;
        to: string;
        display: string;
        section: number;
    } | ConcatArray<{
        from: string;
        to: string;
        display: string;
        section: number;
    }>)[]): {
        from: string;
        to: string;
        display: string;
        section: number;
    }[];
} | ((separator?: string) => string) | ((start?: number, end?: number) => {
    from: string;
    to: string;
    display: string;
    section: number;
}[]) | ((compareFn?: (a: {
    from: string;
    to: string;
    display: string;
    section: number;
}, b: {
    from: string;
    to: string;
    display: string;
    section: number;
}) => number) => {
    from: string;
    to: string;
    display: string;
    section: number;
}[]) | {
    (start: number, deleteCount?: number): {
        from: string;
        to: string;
        display: string;
        section: number;
    }[];
    (start: number, deleteCount: number, ...items: {
        from: string;
        to: string;
        display: string;
        section: number;
    }[]): {
        from: string;
        to: string;
        display: string;
        section: number;
    }[];
} | ((searchElement: {
    from: string;
    to: string;
    display: string;
    section: number;
}, fromIndex?: number) => number) | ((callbackfn: (value: {
    from: string;
    to: string;
    display: string;
    section: number;
}, index: number, array: {
    from: string;
    to: string;
    display: string;
    section: number;
}[]) => void, thisArg?: any) => void) | {
    (callbackfn: (previousValue: {
        from: string;
        to: string;
        display: string;
        section: number;
    }, currentValue: {
        from: string;
        to: string;
        display: string;
        section: number;
    }, currentIndex: number, array: {
        from: string;
        to: string;
        display: string;
        section: number;
    }[]) => {
        from: string;
        to: string;
        display: string;
        section: number;
    }): {
        from: string;
        to: string;
        display: string;
        section: number;
    };
    (callbackfn: (previousValue: {
        from: string;
        to: string;
        display: string;
        section: number;
    }, currentValue: {
        from: string;
        to: string;
        display: string;
        section: number;
    }, currentIndex: number, array: {
        from: string;
        to: string;
        display: string;
        section: number;
    }[]) => {
        from: string;
        to: string;
        display: string;
        section: number;
    }, initialValue: {
        from: string;
        to: string;
        display: string;
        section: number;
    }): {
        from: string;
        to: string;
        display: string;
        section: number;
    };
    <U>(callbackfn: (previousValue: U, currentValue: {
        from: string;
        to: string;
        display: string;
        section: number;
    }, currentIndex: number, array: {
        from: string;
        to: string;
        display: string;
        section: number;
    }[]) => U, initialValue: U): U;
})[]>;
export declare function describeTextRange(expr: any): any;
export declare function describeTimeRange(range: RawTimeRange): string;
