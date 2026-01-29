# Vector-Vector SIMD Clava pass

This package provides a clava script that analyses C programs and, upon detecting portions of code suitable for optimization using a SIMD custom instruction, replaces it with functions that, internally, use those instructions as in-line assembly.

The focus of the analysis performed in this package is vector-vector dot-product operations, that is, when the elements of two vectors with matching indices are multiplied in pairs and then we sum all the resulst. The simplest case can be expressed in C as follows:

```c
void foo(char *vec_a, char *vec_b) {
    int len = 8;
    int accum = 0;
    for (int i = 0; i < len; i++) {
        accum += vec_a[i] * vec_b[i];
    }

    return accum;
}
```

This program would transform the function as follows:

```c
void foo(char *vec_a, char *vec_b) {
    int len = 8;
    int accum = 0;
    accum += __dot_prod_8b(vec_a, vec_b, 8);

    return accum;
}
```

the __dot_prod_8b function, along with all other functions used internally, would automatically be added to the translation unit. Vector-matrix multiplications, which internally correspond to various vector-vector dot-products, are also supported, as well as other scenarious that can be simplified into the one shown above. However, all eligible cases must guarantee the following:
- The elements of each multiplication must be contiguous in memory
- The indices of each multiplication pair must match (for easier analysis, for now)
- The start index must be 0 (for easier analysis, for now)
- The multiplication must not be interrupted halfway, or skip elements

In C terms, this roughly translates to:
- Must use a suitable for-loop; whiles and for-each are not yet supported. A suitable for-loop must:
    - Have no control-flow-altering statements (return, goto, break, continue)
    - The step of the loop must be 1 at all times (e.g. `i++`)
    - The end value must not change inside the loop (e.g. if the loop's condition is `i < a`, the variable 'a' cannot be modified in the loop)
    - Have no side-effects (any function call, modifying variables that were declared outside of the loop body) except increasing the accumulator
    - Start value must be 0 (e.g. `i = 0`)

## Prerequisites & Dependencies

- Node (v20 or v22)
- Java (17 or higher)

The project was developed and tested using Node v22.16.0 and OpenJDK 21.0.2

## Quickstart

To start developing and/or using the tool, clone the repository and install the npm dependencies:

**NOTE**: Some dependencies may not yet be published in NPM. If this is the case, please use instead the npm workspace available [here](https://github.com) and then procceed with this tutorial, skipping this step <!-- TODO: Add link -->

```sh
# clone repo
cd simd-clava-pass
npm install
```

Then, build the project

```sh
npm run build
```

This should also create a node "executable" named simd-pass, giving you access to a CLI utility. Due to technical limitations, this only works when the current working directory is this repository for now, though you can manipulate files in other places.

```sh
simd-pass --help # should give you a rundown of available options

# Modifies bar.c and outputs it to a new folder, outside this repository's scope
simd-pass -i ~/Documents/foo-project/bar.c -o ~/Documents/baz-project

```

Alternatively, create a new typescript file, import `Pass` from `src/pass.ts*`, write your logic and then run it as a standard Clava program. This is, essentially, using it as a library.

See [Project Structure](#project-structure) to familiarize yourself with the files and directories, and read the scripts part of the `package.json` if you need a hint on how to run Clava programs or using a test environment with Jest.

## Project Structure

### [src/pass.ts](src/pass.ts)

This is where the core logic of the analyses and transformation resides. If you want to use this project as a library, you only need to import the `applyPass()` function; it will perform the analysis and the transformations and return the number of loops modified. Please note that it assumes that Clava's AST has already been built and loaded, and it is modified after its execution.

### [src/index.ts](src/index.ts)

A simple wrapper that calls the pass, using hw instructions and outputting debug information. Useful if you need a program that just runs the pass on a loaded file, for instance, on a CMake pipeline (though you'd probably want debug information to be off that in instance). Also assumes that the AST has already been loaded.

### [src/cli.ts](src/cli.ts)

A slightly more complex wrapper than the previous one, allowing the user to specify various options via flags before running the pass. Requires you to specify which files will be loaded into the AST via the `--input` flag and also the output path via the `--output-path` flag. The `--help` flag provides further information.

### [src/cfg/](src/cfg/)

A collection of utilities for determining the value of variables at certain points in the program, when possible. Built upon [Clava Flow](https://github.com/specs-feup/clava-flow).

### [src/constprop/](src/constprop/)

A rough implementation of constant propagation based on Clava Flow. Also uses [Clava Code Transforms](https://github.com/specs-feup/clava-code-transforms) for constant folding.

### [src/input/](src/input/)

All C files used for testing.

### [src/insertedcode/](src/insertedcode/)

JS constant that contain C code that needs to be inserted into the C programs for the transformations.

### [src/utils/](src/utils/)

Miscellaneous utilities that may or may not be used across the code base. Most are obsolete since the introduction of Clava Flow.


## Known limitations

- A for-loop without a cond **will** crash (`for (int i = 0;;i++)`)
- for-each loops *may* crash (`for (int a : an_array)`)
- Having multiple writes to the same variable inside the same statement/expression, which is unspecified behaviour, *may* crash (`int b = a++ + ++a;`)
- Use of globals modified via pointers *may* yield incorrect results
- Use of non-constant static variables *may* yield incorrect results
- The CLI tool currently does not work outside the repository
- The code is very poorly optimized
- _All_ code is added to _all_ files, even when not needed (e.g. no transformations were done)
- Software sim instructions *may* result in incorrect behaviour when performing multiple calculations at once across translation units, or when performing calculations in one and reading in another. This is due to every translation unit having its own static variable to represent the accelerator's internal register
- Loops that perform two vector-vector dot-products at once, equivalent to two loops each with one vector-vector dot-product, are not detected or transformed
- CLI tool *could* allow the user to opt out of vector reduce simplification or constant propagation, for example
- A significant portion of the code is not documented, relying instead on hopefully clear naming
- CFG and constprop could be separate packages or added to other already existing libraries
- No CMake quickstart
- 4-bit operands are not yet supported due to unclear representation in C
- Assumes `if` blocks can't be inside expressions, though this is not the case (e.g. `__extension__( { if (1) ; else ; })`). In cases like this, CFG will not be able to detect reads/writes in the condition of the `if`