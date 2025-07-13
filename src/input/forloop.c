#include <stddef.h>
#include <stdint.h>
#include <stdio.h>

int32_t __nvision_sim_accum = 0;

void mac_sim_8b(int32_t a, int32_t b, int32_t c, int32_t d) {
  int8_t *a_cast = (int8_t *)(&a);
  int8_t *b_cast = (int8_t *)(&b);
  int8_t *c_cast = (int8_t *)(&c);
  int8_t *d_cast = (int8_t *)(&d);

  __nvision_sim_accum += a_cast[0] * b_cast[0];
  __nvision_sim_accum += a_cast[1] * b_cast[1];
  __nvision_sim_accum += a_cast[2] * b_cast[2];
  __nvision_sim_accum += a_cast[3] * b_cast[3];

  __nvision_sim_accum += c_cast[0] * d_cast[0];
  __nvision_sim_accum += c_cast[1] * d_cast[1];
  __nvision_sim_accum += c_cast[2] * d_cast[2];
  __nvision_sim_accum += c_cast[3] * d_cast[3];
}

void mac_sim_16b(int32_t a, int32_t b, int32_t c, int32_t d) {
  int16_t *a_cast = (int16_t *)(&a);
  int16_t *b_cast = (int16_t *)(&b);
  int16_t *c_cast = (int16_t *)(&c);
  int16_t *d_cast = (int16_t *)(&d);

  __nvision_sim_accum += a_cast[0] * b_cast[0];
  __nvision_sim_accum += a_cast[1] * b_cast[1];

  __nvision_sim_accum += c_cast[0] * d_cast[0];
  __nvision_sim_accum += c_cast[1] * d_cast[1];
}

int32_t clear_read_sim() {
  int32_t temp = __nvision_sim_accum;
  __nvision_sim_accum = 0;

  return temp;
}

void nvision_matrix_col_8b(int8_t *A, int8_t *B, int32_t *accum,
                           size_t length) {
  clear_read_sim();

  int mac_len = length / 8;
  int32_t *A_cast = (int32_t *)A;
  int32_t *B_cast = (int32_t *)B;

  for (int i = 0; i < mac_len; i++) {
    mac_sim_8b(A_cast[i * 2], B_cast[i * 2], A_cast[i * 2 + 1],
               B_cast[i * 2 + 1]);
  }

  *accum += clear_read_sim();

  for (int i = (length / 8) * 8; i < length; i++) {
    *accum += A[i] * B[i];
  }
}

void test(void) {
  int32_t result = 0;
  size_t len = 8;
  int8_t vector[8] = {10, 4, 8, 2, 6, 12, 3, 7};
  int8_t matrix_col[8] = {10, 4, 8, 2, 6, 12, 5, 1};

  // result += vector * vector
  for (size_t i = 0; i < len; i++) {
    result += vector[i] * matrix_col[i];
  }

  // result = result + vector * vector
  for (size_t i = 0; i < len; i++) {
    result = result + vector[i] * vector[i];
  }

  // result = result + multp
  for (size_t i = 0; i < len; i++) {
    int multp = vector[i] * vector[i];
    result = result + multp;
  }

  // result = multp + multp
  for (size_t i = 0; i < len; i++) {
    int multp = vector[i] * vector[i];
    result = multp + result;
  }

  // result = temp
  for (size_t i = 0; i < len; i++) {
    int multp = vector[i] * vector[i];
    int temp = multp + result;
    result = temp;
  }

  // single assignment, 1 op per assignment
  for (size_t i = 0; i < len; i++) {
    int vec1 = vector[i];
    int vec2 = matrix_col[i];
    int multp = vec1 * vec2;
    int temp = multp + result;
    result = temp;
  }
}

void test2(void) {
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

int main(void) {
  int32_t result = 0;
  size_t len = 9;
  int8_t vector[9] = {10, 4, 8, 2, 6, 12, 3, 1, 2};
  int8_t matrix_col[9] = {10, 4, 8, 2, 6, 12, 5, 2, 3};

  // ok
  for (size_t i = 0; i < len; i++) {
    result += vector[i] * matrix_col[i];
  }

  printf("%d\n", result);
  return 0;
}