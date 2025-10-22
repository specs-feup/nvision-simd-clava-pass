#include <stddef.h>
#include <stdint.h>
#include <stdio.h>

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

void test_16b(short vector[8], short matrix_col[8]) {
  int result = 0;

  for (size_t i = 0; i < 8; i++) {
    result += vector[i] * matrix_col[i];
  }
}

void test_32b(int vector[8], int matrix_col[8]) {
  int result = 0;

  for (size_t i = 0; i < 8; i++) {
    result += vector[i] * matrix_col[i];
  }
}

void test_mismatch_8_16(signed char vector[8], short matrix_col[8]) {
  int result = 0;
  
  for (size_t i = 0; i < 8; i++) {
    result += vector[i] * matrix_col[i];
  }
}

void test_mismatch_8_32(signed char vector[8], int matrix_col[8]) {
  int result = 0;
  
  for (size_t i = 0; i < 8; i++) {
    result += vector[i] * matrix_col[i];
  }
}

void test_mismatch_16_32(short vector[8], int matrix_col[8]) {
  int result = 0;
  
  for (size_t i = 0; i < 8; i++) {
    result += vector[i] * matrix_col[i];
  }
}

void test_mismatch_32_8(int vector[8], signed char matrix_col[8]) {
  int result = 0;
  
  for (size_t i = 0; i < 8; i++) {
    result += vector[i] * matrix_col[i];
  }
}

int main() {
  int vector_A[8] = {0, 1, 2, 3, 4, 19, 6, 300};
  int vector_B[8] = {1, 3, 1, 5, 3, 5, 2, 59};

  int accum = 0;
  for (int i = 0; i < 8; i++) {
    accum += vector_A[i] * vector_B[i];
  }

  printf("result: %d\n", accum);
}