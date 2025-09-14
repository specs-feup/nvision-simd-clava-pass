#include <stddef.h>
#include <stdint.h>

void foo(int8_t vector[8], int8_t matrix_col[8]) {
  int32_t result = 0;

  // result += vector * vector
  for (size_t i = 0; i < 8; i++) {
    result += vector[i] * matrix_col[i];
  }

  // result = result + vector * vector
  for (size_t i = 0; i < 8; i++) {
    result = result + vector[i] * vector[i];
  }

  // result = result + multp
  for (size_t i = 0; i < 8; i++) {
    int multp = vector[i] * vector[i];
    result = result + multp;
  }

  // single assignment, 1 op per assignment
  for (size_t i = 0; i < 8; i++) {
    int vec1 = vector[i];
    int vec2 = matrix_col[i];
    int multp = vec1 * vec2;
    int temp = multp + result;
    result = temp;
  }

  /* ... */
}

void bar(int8_t matrix[3][8], int8_t vector[8]) {
  for (int i = 0; i < 3; i++) {
    int accum = 0;

    for (int j = 0; j < 8; j++) {
      accum += matrix[i][j] * vector[j];
    }
  }

  /* ... */

}

void baz(int8_t matrix[3][8], int8_t vector[8], int8_t out_vec[8]) {
  for (int i = 0; i < 3; i++) {
    for (int j = 0; j < 8; j++) {
      out_vec[i] += matrix[i][j] * vector[j];
    }
  }

  /* ... */

}

void foobar(int8_t matrix[24], int8_t vector[8], int8_t out_vec[8]) {
  for (int i = 0; i < 3; i++) {
    for (int j = 0; j < 8; j++) {
      out_vec[i] += matrix[i*8+j] * vector[j];
    }
  }

  /* ... */
}