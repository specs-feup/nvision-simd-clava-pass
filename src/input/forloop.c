#include <stdio.h>

void test2(void) {
  signed char matrix[3][8] = {{0, 1, 2, 3, 4, 5, 6, 7},
                         {8, 9, 10, 11, 12, 13, 14, 15},
                         {16, 17, 18, 19, 20, 21, 22, 23}};

  signed char vector[8] = {0, 1, 2, 3, 4, 5, 6, 7};

  for (int i = 0; i < 3; i++) {
    int accum = 0;

    for (int j = 0; j < 8; j++) {
      accum += matrix[i][j] * vector[j];
    }
  }
}

int main(void) {
  int result = 0;
  size_t len = 9;
  signed char vector[9] = {10, 4, 8, 2, 6, 12, 3, 1, 2};
  signed char matrix_col[9] = {10, 4, 8, 2, 6, 12, 5, 2, 3};

  // ok
  for (size_t i = 0; i < len; i++) {
    result += vector[i] * matrix_col[i];
  }

  printf("%d\n", result);
  return 0;
}