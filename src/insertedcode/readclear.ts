export const FW_DECL_READ_CLEAR_SW: string = `
static signed int __nvision_sim_accum = 0;
inline static int __read_clear();
`;

export const FW_DECL_READ_CLEAR_HW: string = `
inline static int __read_clear();
`;


export const HW_READ_CLEAR_CODE: string = `
inline static int __read_clear() {
  int result = 0;
  asm volatile(".insn r 0b0001011, 0x07, 0x0, %[RD], x0, x0"
               : [RD] "=r"(result));
  return result;
}
`;

export const SW_READ_CLEAR_CODE: string = `
inline static int __read_clear() {
  int temp = __nvision_sim_accum;
  __nvision_sim_accum = 0;

  return temp;
}
`;
