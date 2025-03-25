#include <stdint.h>
#include <stddef.h>
#include <stdio.h>

int intAndInt(int a, int b)
{
    int c = 2;
    int d = 3;
    int e = 2 + 3;
    a = b + e;
    b = e + e;
    b = e * e;
    a = b + 3;
    int f = a + a;
    c = 2;
    int X[3000] = {0};
    X[c] = 12;
    X[d] = c;

    if (c == 2)
    {
        int x = a + b;
        a = 44;
        int y = a + b;
        f = x + y;
    }
    return f;
}

int foo(int a, int b) {
    int c = 1 + 2 + 3;
    int e = c * 2;
    int d = a + c;
    return e + d;
}

int main(void) {
    int32_t result = 0;
    int8_t vector[] = {10, 4, 8, 2, 6, 12};
    int8_t matrix_col[] = {10, 4, 8, 2, 6, 12};

    size_t len = 6;
    
    for (size_t i = 0; i < len; i++) {
        result += vector[i] * matrix_col[i];
    }

    printf("%d\n", result);
    return 0;
}