#include <stdint.h>

int main(void) {
  int8_t matrix[3][8] = {{0, 1, 2, 3, 4, 5, 6, 7},
                         {8, 9, 10, 11, 12, 13, 14, 15},
                         {16, 17, 18, 19, 20, 21, 22, 23}};

  int8_t vector[8] = {0, 1, 2, 3, 4, 5, 6, 7};

  for (int i = 0; i < 3; i++) {
    int accum = 0;

    for (int j = 0; j < 8; j++) {
      accum += matrix[i][j] * vector[j];
    }
  }
}
