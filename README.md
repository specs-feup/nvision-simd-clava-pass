# Vector-Vector SIMD Clava pass

This package detects vector-vector dot products written in plain C/C++ and replaces them with a MAC (multiply-and-accumulate) RISC-V custom instruction.

## Known limitations

- A for-loop without an init, a step or both **will** crash (`for (;;)`)
- for-each loops *may* crash (`for (int a : an_array)`)
- Having multiple writes to the same variable inside the same statement/expression, which is unspecified behaviour, *may* crash (`int b = a++ + ++a;`)