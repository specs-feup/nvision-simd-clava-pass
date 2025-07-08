# Vector-Vector SIMD Clava pass

This package detects vector-vector dot products written in plain C/C++ and replaces them with a MAC (multiply-and-accumulate) RISC-V custom instruction.

## Known limitations

- A for-loop without an init, a step or both **will** crash (`for (;;)`)
- for-each loops *may* crash (`for (int a : an_array)`)
- Having multiple writes to the same variable inside the same statement/expression, which is unspecified behaviour, *may* crash (`int b = a++ + ++a;`)
- Use of non-constant globals *may* yield incorrect results
- Use of non-constant static variables *may* yield incorrect results
- For a loop to be suitable for parallelization, it must abide by the following rules:
    - Have no control-flow-altering statements (return, goto, break, continue)
    - The step of the loop must be 1 at all times (e.g. `i++`)
    - The end value must not change inside the loop (e.g. if the loop's condition is `i < a`, the variable 'a' cannot be modified in the loop)
    - Have no side-effects (any function call, modifying variables that were declared outside of the loop body) except increasing the accumulator
    - Start value must be 0 (e.g. `i = 0`)