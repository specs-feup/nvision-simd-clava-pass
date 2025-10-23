export const FW_DECL_CODE_16: string = `
#include <stddef.h>

inline static void __mac_16b(int a, int b, int c, int d);
inline static int __dot_prod_16b(short *A, short *B, size_t length);
`;

export const SW_MAC_CODE_16: string = `
inline static void __mac_16b(int a, int b, int c, int d) {
  short *a_cast = (short *)(&a);
  short *b_cast = (short *)(&b);
  short *c_cast = (short *)(&c);
  short *d_cast = (short *)(&d);

  __nvision_sim_accum += a_cast[0] * b_cast[0];
  __nvision_sim_accum += a_cast[1] * b_cast[1];

  __nvision_sim_accum += c_cast[0] * d_cast[0];
  __nvision_sim_accum += c_cast[1] * d_cast[1];
}
`;

export const HW_MAC_CODE_16: string = `
inline static void __mac_16b(int a, int b, int c, int d) {
  asm volatile(".insn r 0b0001011, 0x04, 0x0, x0, %[RS1], %[RS2]\\n"
               ".insn r 0b0001011, 0x04, 0x0, x0, %[RS3], %[RS4]"
               :
               : [RS1] "r"(a), [RS2] "r"(b), [RS3] "r"(c), [RS4] "r"(d));
}
`;

export const DOT_PROD_CODE_16: string = `
inline static int __dot_prod_16b(short *A, short *B, size_t length) {
  int mac_len = length / 4;
  int accum = 0;
  int *A_cast = (int *)A;
  int *B_cast = (int *)B;

  for (int i = 0; i < mac_len; i++) {
    __mac_16b(A_cast[i * 2], B_cast[i * 2], A_cast[i * 2 + 1],
               B_cast[i * 2 + 1]);
  }

  accum += __read_clear();

  for (int i = (length / 4) * 4; i < length; i++) {
    accum += A[i] * B[i];
  }
  
  return accum;
}
`;
