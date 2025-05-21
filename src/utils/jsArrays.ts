/**
 * Returns an array of indices whose matching elements in 
 * arr match the provided predicate 
 * 
 * @param predicate 
 * a function used to determine if an
 * arr's element's index should be included in the
 * returned array. Should return true if it is to be
 * included, and false otherwise.
 */
export function findAllIndices<T>(arr: Array<T>, predicate: (value: T) => boolean): Array<number> {
    const retArray = [];
    
    for (let i = 0; i < arr.length; i++) {
        if (predicate(arr[i])) retArray.push(i);
    }

    return retArray;
}