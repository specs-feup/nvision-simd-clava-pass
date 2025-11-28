export const FW_DECL_CODE_4: string = `
#include <stddef.h>

inline static void __mac_4b(int a, int b, int c, int d);
inline static int __dot_prod_4b(signed char *A, signed char *B, size_t length);
`;

export const SW_MAC_CODE_4: string = `
inline static void __mac_4b(int a, int b, int c, int d) {
  signed char *a_cast = (signed char *)(&a);
  signed char *b_cast = (signed char *)(&b);
  signed char *c_cast = (signed char *)(&c);
  signed char *d_cast = (signed char *)(&d);

  __nvision_sim_accum += ((a_cast[0] << 4) >> 4) * ((b_cast[0] << 4) >> 4);
  __nvision_sim_accum += (a_cast[0] >> 4) * (b_cast[0] >> 4);

  __nvision_sim_accum += ((a_cast[1] << 4) >> 4) * ((b_cast[1] << 4) >> 4);
  __nvision_sim_accum += (a_cast[1] >> 4) * (b_cast[1] >> 4);

  __nvision_sim_accum += ((a_cast[2] << 4) >> 4) * ((b_cast[2] << 4) >> 4);
  __nvision_sim_accum += (a_cast[2] >> 4) * (b_cast[2] >> 4);

  __nvision_sim_accum += ((a_cast[3] << 4) >> 4) * ((b_cast[3] << 4) >> 4);
  __nvision_sim_accum += (a_cast[3] >> 4) * (b_cast[3] >> 4);


  __nvision_sim_accum += ((c_cast[0] << 4) >> 4) * ((d_cast[0] << 4) >> 4);
  __nvision_sim_accum += (c_cast[0] >> 4) * (d_cast[0] >> 4);

  __nvision_sim_accum += ((c_cast[1] << 4) >> 4) * ((d_cast[1] << 4) >> 4);
  __nvision_sim_accum += (c_cast[1] >> 4) * (d_cast[1] >> 4);

  __nvision_sim_accum += ((c_cast[2] << 4) >> 4) * ((d_cast[2] << 4) >> 4);
  __nvision_sim_accum += (c_cast[2] >> 4) * (d_cast[2] >> 4);

  __nvision_sim_accum += ((c_cast[3] << 4) >> 4) * ((d_cast[3] << 4) >> 4);
  __nvision_sim_accum += (c_cast[3] >> 4) * (d_cast[3] >> 4);
}
`;

export const HW_MAC_CODE_4: string = `
inline static void __mac_4b(int a, int b, int c, int d) {
  asm volatile(".insn r 0b0001011, 0x00, 0x0, x0, %[RS1], %[RS2]\\n"
               ".insn r 0b0001011, 0x00, 0x0, x0, %[RS3], %[RS4]"
               :
               : [RS1] "r"(a), [RS2] "r"(b), [RS3] "r"(c), [RS4] "r"(d));
}
`;

export const DOT_PROD_CODE_4: string = `
inline static int __dot_prod_4b(signed char *A, signed char *B, size_t length) {
  int mac_len = length / 8;
  int accum = 0;
  int *A_cast = (int *)A;
  int *B_cast = (int *)B;

  for (int i = 0; i < mac_len; i++) {
    __mac_8b(A_cast[i * 2], B_cast[i * 2], A_cast[i * 2 + 1],
               B_cast[i * 2 + 1]);
  }

  accum += __read_clear();

  for (int i = (length / 8) * 8; i < length; i++) {
    accum += A[i] * B[i];
  }
  
  return accum;
}
`;
