#include <stddef.h>
#include <stdint.h>
#include <stdio.h>

int32_t accum = 0;

void mac_sim_8b(int32_t a, int32_t b, int32_t c, int32_t d) {
  int8_t *a_cast = (int8_t *)(&a);
  int8_t *b_cast = (int8_t *)(&b);
  int8_t *c_cast = (int8_t *)(&c);
  int8_t *d_cast = (int8_t *)(&d);

  accum += a_cast[0] * b_cast[0];
  accum += a_cast[1] * b_cast[1];
  accum += a_cast[2] * b_cast[2];
  accum += a_cast[3] * b_cast[3];

  accum += c_cast[0] * d_cast[0];
  accum += c_cast[1] * d_cast[1];
  accum += c_cast[2] * d_cast[2];
  accum += c_cast[3] * d_cast[3];
}

void mac_sim_16b(int32_t a, int32_t b, int32_t c, int32_t d) {
  int16_t *a_cast = (int16_t *)(&a);
  int16_t *b_cast = (int16_t *)(&b);
  int16_t *c_cast = (int16_t *)(&c);
  int16_t *d_cast = (int16_t *)(&d);

  accum += a_cast[0] * b_cast[0];
  accum += a_cast[1] * b_cast[1];

  accum += c_cast[0] * d_cast[0];
  accum += c_cast[1] * d_cast[1];
}

int32_t clear_read_sim() {
  int32_t temp = accum;
  accum = 0;

  return temp;
}

/*
    0 1 -> corre uma matrix_col e sai
    0 1 2 -> corre uma matrix_col, corre a tail
    0 1 2 3 4 -> corre 2 matrix_col, corre a tail
*/
void nvision_matrix_col_8b(int32_t *A, int32_t *B, int32_t *accum,
                           size_t length) {
  clear_read_sim();

  for (int i = 0; i < length - 1; i += 2) {
    mac_sim_8b(A[i], B[i], A[i + 1], B[i + 1]);
  }

  if (length % 2 == 1) {
    int8_t *a_cast = (int8_t *)&(A[length - 1]);
    int8_t *b_cast = (int8_t *)&(B[length - 1]);

    accum += a_cast[0] * b_cast[0];
    accum += a_cast[1] * b_cast[1];
    accum += a_cast[2] * b_cast[2];
    accum += a_cast[3] * b_cast[3];
  }

  *accum += clear_read_sim();
}

void nvision_matrix_col_8b_alt(int8_t *A, int8_t *B, int32_t *accum,
                               size_t length) {
  clear_read_sim();

  int mac_len = length / 4;
  int32_t *A_cast = (int32_t *)A;
  int32_t *B_cast = (int32_t *)B;

  for (int i = 0; i < mac_len - 1; i += 2) {
    mac_sim_8b(A_cast[i], B_cast[i], A_cast[i + 1], B_cast[i + 1]);
  }

  if (length % 2 == 1) {
    int8_t *a_cast = (int8_t *)&(A[length - 1]);
    int8_t *b_cast = (int8_t *)&(B[length - 1]);

    accum += a_cast[0] * b_cast[0];
    accum += a_cast[1] * b_cast[1];
    accum += a_cast[2] * b_cast[2];
    accum += a_cast[3] * b_cast[3];
  }

  *accum += clear_read_sim();
}

int main(void) {
  int32_t result = 0;
  size_t len = 8; // len has to be multiple of 8
  int8_t vector[8] = {10, 4, 8, 2, 6, 12, 3, 7};
  int8_t matrix_col[8] = {10, 4, 8, 2, 6, 12, 5, 1};

  // ok
  for (size_t i = 0; i < len; i++) {
    result += vector[i] * matrix_col[i];
  }

  // ok
  for (size_t i = 0; i < len; i++) {
    result = result + vector[i] * vector[i];
  }

  nvision_matrix_col_8b((int32_t *)matrix_col, (int32_t *)vector, &result,
                        len / 8);

  // problem
  for (size_t i = 0; i < len; i++) {
    int32_t temp = vector[i] * matrix_col[i];
    result += temp;
  }

  // problem
  for (size_t i = 0; i < len; i++) {
    int32_t temp = vector[i] * matrix_col[i];
    result += temp;
  }

  printf("%d\n", result);
  return 0;
}