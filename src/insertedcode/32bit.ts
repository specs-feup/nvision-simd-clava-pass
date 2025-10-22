export const FW_DECL_CODE_32: string = `
#include <stddef.h>

inline static void __mac_32b(int a, int b, int c, int d);
inline static void __dot_prod_32b(int *A, int *B, volatile int *accum,
                           size_t length);
`;

export const SW_MAC_CODE_32: string = `
inline static void __mac_32b(int a, int b, int c, int d) {
  __nvision_sim_accum += a * b;
  __nvision_sim_accum += c * d;
}
`;

export const HW_MAC_CODE_32: string = `
inline static void __mac_32b(int a, int b, int c, int d) {
  asm volatile(".insn r 0b0001011, 0x06, 0x0, x0, %[RS1], %[RS2]\\n"
               ".insn r 0b0001011, 0x06, 0x0, x0, %[RS3], %[RS4]"
               :
               : [RS1] "r"(a), [RS2] "r"(b), [RS3] "r"(c), [RS4] "r"(d));
}
`;

export const DOT_PROD_CODE_32: string = `
inline static void __dot_prod_32b(int *A, int *B, volatile int *accum,
                           size_t length) {
  int mac_len = length / 2;
  for (int i = 0; i < mac_len; i++) {
    __mac_32b(A[i * 2], B[i * 2], A[i * 2 + 1], B[i * 2 + 1]);
  }

  *accum += __read_clear();

  if (length % 2 == 1) {
    *accum += A[length-1] * B[length-1];
  }
}
`;