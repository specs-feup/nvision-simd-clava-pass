export function findAllIndices<T>(arr: Array<T>, predicate: (value: T) => boolean): Array<number> {
    const retArray = [];
    
    for (let i = 0; i < arr.length; i++) {
        if (predicate(arr[i])) retArray.push(i);
    }

    return retArray;
}

export function findAll<T>(arr: Array<T>, predicate: (value: T) => boolean): Array<T> {
    const retArray = [];

    for (const idx of findAllIndices(arr, predicate)) {
        retArray.push(arr[idx]);
    }

    return retArray;
}