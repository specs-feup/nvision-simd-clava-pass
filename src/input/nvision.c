/** Performs a matrix x vector product using using custom instructions,
 * and compares the result with the theoretical value obtained in SW,
 * indicating which elements of the output vector are identical in SW and HW
 * and which ones disagree.
 *
 * On success, it will print "TEST PASSED".
 * If any element of the output computed using custom instructions
 * doesn't match the SW computation, it will print "TEST FAILED".
 *
 * Additionally, it measures the time for the following implementations:
 * - CPU only
 * - CPU only, with 8x loop unrolling
 * - Custom Instructions, 8-bit config. (CPU is used to transfer the data)
 *
 * Instructions to add new tests:
 * 1. Create new `out_vec_*` variable under "Problem variables".
 * 2. Create new test function under "Different implementations of MxV product".
 * 3. Add any needed initialization routines under "Initialize platform".
 * 4. Add new `t_*` variable under "Perform computation in several
 *implementations".
 * 5. Add new block under "Perform computation in several implementations".
 * 6. Add result check to "Check results"
 * 7. Add new line under "Print times".
 **/

#include <limits.h> // CHAR_BIT
#include <stdint.h> // [u]int*_t
#include <stdio.h>  // printf()
// #include <stdlib.h> // rand() --> not used; causes linker error
// #include <assert.h> // assert() --> disabled by OpenTitan; CHECK()
// alternative not provided by X-HEEP

/** Customizable macros **/

// Define matrix dimensions for matrix multiplication operation
#define IV_LEN 784 // 32 //  inpupt vector length | matrix width  (assuming MxV)
#define OV_LEN 64  // outpupt vector length | matrix height (assuming MxV)
// Note: currently IV_LEN must be a multiple of 4 in order to write word by
// word. Note: IV_LEN and OV_LEN must fit in the accelerator's memories.

#define PACKED_LEN (IV_LEN / 4)

static int32_t packed_in_vec[PACKED_LEN];
static int32_t packed_in_mat[OV_LEN][PACKED_LEN];

#define VERBOSITY 1
/* -1 = suppress printf entirely
 *  0 = print test result and timing only
 *  1 = minimal; only report when we start SW/HW computation
 *  2 = print more detail of initialized variables
 *  3 = print debug info every time we start a memcpy transaction
 */

/** CR bit masks **/

// Input element width (for IV and IM elements)
#define CR_0_INPUT_2BIT 0x00
#define CR_0_INPUT_4BIT 0x01
#define CR_0_INPUT_8BIT 0x02
#define CR_0_INPUT_16BIT 0x03
#define CR_0_INPUT_32BIT 0x04
#define CR_0_INPUT_MASK 0x07

// Output element width (for OV elements)
#define CR_0_OUTPUT_32BIT 0x0000
#define CR_0_OUTPUT_64BIT 0x4000
#define CR_0_OUTPUT_MASK 0x4000

// Output clear-on-read
#define CR_0_CLR_ON_RD 0x0000
#define CR_0_NO_CLR_ON_RD 0x8000
#define CR_0_CLR_ON_RD_MASK 0x8000

/** Internal macros / check macros **/

// Element size
#define IV_BIT 8
#define IM_BIT IV_BIT
#define OV_BIT 32
#define IV_MULT OV_BIT

#define _CONCAT(prefix, infix, suffix) prefix##infix##suffix
#define INTn_T(n) _CONCAT(int, n, _t)
typedef INTn_T(IV_BIT) iv_elem_t;
typedef INTn_T(IM_BIT) im_elem_t;
typedef INTn_T(OV_BIT) ov_elem_t;

#define CR_0_INPUT_BITS(n) _CONCAT(CR_0_INPUT_, n, BIT)
#define CR_0_OUTPUT_BITS(n) _CONCAT(CR_0_OUTPUT_, n, BIT)
#define CR_0_CONFIG_WORD                                                       \
  (CR_0_INPUT_BITS(IV_BIT) | CR_0_OUTPUT_BITS(OV_BIT) | CR_0_CLR_ON_RD)

#define IV_LEN_MAX 1024 // Example maximum input vector length
#define OV_LEN_MAX 256  // Example maximum output vector length

// Check validity of IV_LEN and OV_LEN
#if (IV_BIT < 32 && IV_LEN % (32 / IV_BIT) != 0) ||                            \
    (OV_BIT < 32 && OV_LEN % (32 / OV_BIT) != 0)
#error Problem`s input/output vector sizes are not multiples of one 32-bit word.
#endif
#if IV_LEN > IV_LEN_MAX || OV_LEN > OV_LEN_MAX
#error IV_LEN or OV_LEN exceed the maximum size supported by HW. Please reduce them or partition the problem.
#endif

/** CPU memory access functions **/

/* Replacement for memcpy() but using volatile.
 * (Note that using memcpy() directly may not work since it's not intended for
 * volatile data.)
 *
 * Note: src, dst, and bytes MUST be aligned to 4-byte (32-bit) word boundaries.
 */
static void volatile_memcpy(volatile void *dst,
                            volatile const void *src, size_t bytes) {
  printf("Memcpy %p->%p (%d B)\r\n", (void *)src, (void *)dst, (int)bytes);

  // Ensure that everything is aligned to 4-byte (32-bit) words
  // assert((uintptr_t)dst % 4 == 0); // assert() disabled by OpenTitan; CHECK()
  // alternative not provided by X-HEEP assert((uintptr_t)src % 4 == 0);
  // assert(bytes % 4 == 0);

  volatile uint32_t *dst_w = (volatile uint32_t *) dst, *src_w = ( volatile uint32_t *) src;
  size_t words = bytes / sizeof *dst_w;
  for (size_t i = 0; i < words; i++)
    dst_w[i] = src_w[i];
}

/* Same but with 8x loop unroll */
static void volatile_memcpy_unroll(volatile void *dst,
                                   volatile const void *src,
                                   size_t bytes) {
  printf("Memcpy %p->%p (%d B)\r\n", (void *)src, (void *)dst, (int)bytes);

  // Ensure that everything is aligned to 4-byte (32-bit) words
  // assert((uintptr_t)dst % 4 == 0); // assert() disabled by OpenTitan; CHECK()
  // alternative not provided by X-HEEP assert((uintptr_t)src % 4 == 0);
  // assert(bytes % 4 == 0);

  volatile uint32_t *dst_w = (volatile uint32_t *) dst, *src_w = (volatile uint32_t *) src;
  size_t words = bytes / sizeof *dst_w;
  //~ #pragma GCC unroll 8 // doesn't seem to work; manually unrolling instead
  //~ for (size_t i = 0; i < words; i++) dst_w[i] = src_w[i];
  for (size_t i = 0; i < (words / 8) * 8; i += 8) {
    dst_w[i + 0] = src_w[i + 0];
    dst_w[i + 1] = src_w[i + 1];
    dst_w[i + 2] = src_w[i + 2];
    dst_w[i + 3] = src_w[i + 3];
    dst_w[i + 4] = src_w[i + 4];
    dst_w[i + 5] = src_w[i + 5];
    dst_w[i + 6] = src_w[i + 6];
    dst_w[i + 7] = src_w[i + 7];
  }
  for (size_t i = (words / 8) * 8; i < words; i++)
    dst_w[i] = src_w[i];
}

/** Random number generation **/

static uint32_t custom_rand_next = 1; // 32-bit seed
/* Custom random function, because the one in stdlib/libc_nano.a
 * causes weird linker dependency errors (something about _getpid_r).
 * This example implementation is based on the one from C11 standard (N1570),
 * modified to get the most significant part of seed as recommended for LCG.
 */
static int custom_rand_range(int min, int max) {
  // PRNG algorithm
  custom_rand_next = custom_rand_next * 1103515245 + 12345; // gen 32-bit seed
  // Adapt to range
  uint64_t range = (int64_t)max - (int64_t)min + 1;
  int64_t x =
      ((uint64_t)custom_rand_next * range) >> 32; // get MOST sig bits of LCG
  return x + min;
}
static void custom_srand(uint32_t seed) { custom_rand_next = seed; }

/** Problem variables **/

static iv_elem_t in_vec[IV_LEN];
static im_elem_t in_mat[OV_LEN][IV_LEN];
static ov_elem_t bias[OV_LEN];
static ov_elem_t out_vec_sw[OV_LEN];           // CPU
static ov_elem_t out_vec_sw_unroll[OV_LEN];    // CPU with 8x unroll
static ov_elem_t out_vec_custom_instr[OV_LEN]; // Custom instr, CPU moves data
static ov_elem_t out_vec_custom_instr_unroll[OV_LEN]; // Custom instr, CPU moves
                                                      // data (8x unroll)

/*
*************************************************************
* Custom Instructions for different multiplier configurations
*************************************************************
*/

// .insn r opcode6, func3, func7, rd, rs1, rs2
static inline void mac_4b_custom(signed int a, signed int b, signed int c,
                                 signed int d) {
  // asm volatile (
  //     ".insn r 0b0001011, 0x00, 0x0, x0, %[RS1], %[RS2]\n" // 4b config - MAC
  //     - custom0 (Instruction 1)
  //     ".insn r 0b0001011, 0x00, 0x0, x0, %[RS3], %[RS4]" // 4b config - MAC -
  //     custom0 (Instruction 2)
  //     :
  //     : [RS1] "r" (a), [RS2] "r" (b), [RS3] "r" (c), [RS4] "r" (d)
  // );
}

// .insn r opcode6, func3, func7, rd, rs1, rs2
static inline void mac_8b_custom(signed int a, signed int b, signed int c,
                                 signed int d) {
  // asm volatile (
  //     ".insn r 0b0001011, 0x02, 0x0, x0, %[RS1], %[RS2]\n" // 8b config - MAC
  //     - custom0 (Instruction 1)
  //     ".insn r 0b0001011, 0x02, 0x0, x0, %[RS3], %[RS4]" // 8b config - MAC -
  //     custom0 (Instruction 2)
  //     :
  //     : [RS1] "r" (a), [RS2] "r" (b), [RS3] "r" (c), [RS4] "r" (d)
  // );
}

// .insn r opcode6, func3, func7, rd, rs1, rs2
static inline void mac_16b_custom(signed int a, signed int b, signed int c,
                                  signed int d) {
  // asm volatile (
  //     ".insn r 0b0001011, 0x04, 0x0, x0, %[RS1], %[RS2]\n" // 16b config -
  //     MAC - custom0 (Instruction 1)
  //     ".insn r 0b0001011, 0x04, 0x0, x0, %[RS3], %[RS4]" // 16b config - MAC
  //     - custom0 (Instruction 2)
  //     :
  //     : [RS1] "r" (a), [RS2] "r" (b), [RS3] "r" (c), [RS4] "r" (d)
  // );
}

// .insn r opcode6, func3, func7, rd, rs1, rs2
static inline void mac_32b_custom(signed int a, signed int b, signed int c,
                                  signed int d) {
  // asm volatile (
  //     ".insn r 0b0001011, 0x06, 0x0, x0, %[RS1], %[RS2]\n" // 32b config -
  //     MAC - custom0 (Instruction 1)
  //     ".insn r 0b0001011, 0x06, 0x0, x0, %[RS3], %[RS4]" // 32b config - MAC
  //     - custom0 (Instruction 2)
  //     :
  //     : [RS1] "r" (a), [RS2] "r" (b), [RS3] "r" (c), [RS4] "r" (d)
  // );
}

// .insn r opcode6, func3, func7, rd, rs1, rs2
static inline signed int read_clear_custom() {
  signed int result = 0;
  // printf("read_clear_custom(): sending instruction");
  //  asm volatile (
  //      ".insn r 0b0001011, 0x07, 0x0, %[RD], x0, x0" // 32b config - R+CLR -
  //      custom0 : [RD] "=r" (result)
  //  );
  // printf("read_clear_custom: instruction sent, result = %d\n", result);
  return result;
}

/** Different implementations of MxV product (using global vars and params) **/

/* Compute using the processor */
static inline void MxV_sw(void) {
  for (int i = 0; i < OV_LEN; i++) {
    ov_elem_t accum = bias[i];
    for (int j = 0; j < IV_LEN; j++) {
      accum += in_mat[i][j] * in_vec[j];
    }
    out_vec_sw[i] = accum;
  }
}

/* Compute using the processor, with loop unrolling */
static inline void MxV_sw_unroll(void) {
  for (int i = 0; i < OV_LEN; i++) {
    ov_elem_t accum = bias[i];
    for (int j = 0; j < (IV_LEN / 8) * 8; j += 8) { // loop unroll
      accum += in_mat[i][j + 0] * in_vec[j + 0];
      accum += in_mat[i][j + 1] * in_vec[j + 1];
      accum += in_mat[i][j + 2] * in_vec[j + 2];
      accum += in_mat[i][j + 3] * in_vec[j + 3];
      accum += in_mat[i][j + 4] * in_vec[j + 4];
      accum += in_mat[i][j + 5] * in_vec[j + 5];
      accum += in_mat[i][j + 6] * in_vec[j + 6];
      accum += in_mat[i][j + 7] * in_vec[j + 7];
    }
    for (int j = (IV_LEN / 8) * 8; j < IV_LEN; j++) { // last IV_LEN%8 iters
      accum += in_mat[i][j] * in_vec[j];
    }
    out_vec_sw_unroll[i] = accum;
  }
}

void pack_data(void) {
  for (int j = 0; j < IV_LEN; j += 4) {
    int32_t packed_vec = 0;
    for (int k = 0; k < 4; k++) {
      packed_vec |= ((int32_t)(in_vec[j + k] & 0xFF)) << (8 * k);
    }
    packed_in_vec[j / 4] = packed_vec;
  }

  for (int i = 0; i < OV_LEN; i++) {
    for (int j = 0; j < IV_LEN; j += 4) {
      int32_t packed_mat = 0;
      for (int k = 0; k < 4; k++) {
        packed_mat |= ((int32_t)(in_mat[i][j + k] & 0xFF)) << (8 * k);
      }
      packed_in_mat[i][j / 4] = packed_mat;
    }
  }
}

/** Matrix x Vector Product Using Custom Instructions **/

/* Compute using the custom instructions for matrix-vector multiplication */
static inline void MxV_custom_8b(void) {
  for (int i = 0; i < OV_LEN; i++) {
    // Initialize result vector with biases
    out_vec_custom_instr[i] = bias[i];
    for (int j = 0; j < PACKED_LEN; j = j + 2) {
      // Perform MAC operation with pre-packed values
      mac_8b_custom(packed_in_mat[i][j], packed_in_vec[j],
                    packed_in_mat[i][j + 1], packed_in_vec[j + 1]);
    }
    // Read and clear accumulator
    out_vec_custom_instr[i] += read_clear_custom();
  }
}

/* Compute using the custom instructions for matrix-vector multiplication with
 * loop unrolling */
static inline void MxV_custom_8b_unroll(void) {
  for (int i = 0; i < OV_LEN; i++) {
    // Initialize result vector with biases
    out_vec_custom_instr_unroll[i] = bias[i];
    // Perform MAC operations with loop unrolling
    for (int j = 0; j < (PACKED_LEN / (2 * 8)) * 2 * 8; j += 2 * 8) {
      mac_8b_custom(packed_in_mat[i][j + 0], packed_in_vec[j + 0],
                    packed_in_mat[i][j + 1], packed_in_vec[j + 1]);
      mac_8b_custom(packed_in_mat[i][j + 2 * 1], packed_in_vec[j + 2 * 1],
                    packed_in_mat[i][j + 2 * 1 + 1],
                    packed_in_vec[j + 2 * 1 + 1]);
      mac_8b_custom(packed_in_mat[i][j + 2 * 2], packed_in_vec[j + 2 * 2],
                    packed_in_mat[i][j + 2 * 2 + 1],
                    packed_in_vec[j + 2 * 2 + 1]);
      mac_8b_custom(packed_in_mat[i][j + 2 * 3], packed_in_vec[j + 2 * 3],
                    packed_in_mat[i][j + 2 * 3 + 1],
                    packed_in_vec[j + 2 * 3 + 1]);
      mac_8b_custom(packed_in_mat[i][j + 2 * 4], packed_in_vec[j + 2 * 4],
                    packed_in_mat[i][j + 2 * 4 + 1],
                    packed_in_vec[j + 2 * 4 + 1]);
      mac_8b_custom(packed_in_mat[i][j + 2 * 5], packed_in_vec[j + 2 * 5],
                    packed_in_mat[i][j + 2 * 5 + 1],
                    packed_in_vec[j + 2 * 5 + 1]);
      mac_8b_custom(packed_in_mat[i][j + 2 * 6], packed_in_vec[j + 2 * 6],
                    packed_in_mat[i][j + 2 * 6 + 1],
                    packed_in_vec[j + 2 * 6 + 1]);
      mac_8b_custom(packed_in_mat[i][j + 2 * 7], packed_in_vec[j + 2 * 7],
                    packed_in_mat[i][j + 2 * 7 + 1],
                    packed_in_vec[j + 2 * 7 + 1]);
    }
    for (int j = (PACKED_LEN / (2 * 8)) * 2 * 8; j < PACKED_LEN; j = j + 2) {
      mac_8b_custom(packed_in_mat[i][j], packed_in_vec[j],
                    packed_in_mat[i][j + 1], packed_in_vec[j + 1]);
    }
    // Read and clear accumulator
    out_vec_custom_instr_unroll[i] += read_clear_custom();
  }
}

/** Comparison function **/

/* Compare OV vectors; return the number of mismatching elements */
static int compare(ov_elem_t obtained[], ov_elem_t expected[], int n_elem) {
  int good = 0, bad = 0;
  for (int i = 0; i < n_elem; i++) {
    if (obtained[i] == expected[i]) {
      good++;

      printf("... good:     OV[%d]: got %d (0x%X), expected %d (0x%X)\r\n", i,
             (int)obtained[i], (int)obtained[i], (int)expected[i],
             (int)expected[i]);
    } else {
      bad++;

      printf("*** MISMATCH: OV[%d]: got %d (0x%X), expected %d (0x%X)\r\n", i,
             (int)obtained[i], (int)obtained[i], (int)expected[i],
             (int)expected[i]);
    }
  }
  printf("Finished: %d correct, %d wrong.\r\n", good, bad);
  return bad;
}

/*
***********************************************************************
* Software functions for a "golden reference" of the custom instruction
***********************************************************************
*/
static int64_t acc_value = 0;

int32_t sign_extend(int32_t value, int ewidth) {
  int shift = IV_MULT - ewidth;
  return (value << shift) >> shift;
}

// Emulate multiplator function
int64_t multiplator_function(int32_t A_value, int32_t B_value, int ewidth) {
  int64_t result = 0;
  if (ewidth > 0) {
    for (int offset = 0; offset < IV_MULT; offset += ewidth) {
      int32_t elem_A = sign_extend(A_value >> offset, ewidth);
      int32_t elem_B = sign_extend(B_value >> offset, ewidth);
      int64_t elem_prod = (int64_t)elem_A * (int64_t)elem_B;
      result |= (elem_prod & ((1LL << (2 * ewidth)) - 1)) << (2 * offset);
    }
  }
  return result;
}

// Emulate MAC function
void mac_function(int32_t A_value, int32_t B_value, int ewidth) {
  int64_t multiplier_res = multiplator_function(A_value, B_value, ewidth);
  acc_value += multiplier_res;
}

// Emulate R+CLR function
int32_t read_clear_function() {
  int32_t acc_value_32 = (int32_t)(acc_value & 0xFFFFFFFF);
  acc_value = 0;
  return acc_value_32;
}

/** Main function **/

int main(void) {
  /** Initialize platform **/

  // Initialize CSR timer
  printf("Initializing timer\r\n");
  // CSR_CLEAR_BITS(CSR_REG_MCOUNTINHIBIT, 0x1); // Enable mcycle CSR
  // CSR_WRITE(CSR_REG_MCYCLE, 0); // Initialize mcycle to 0

  /** Initialize problem data **/

  printf("Initializing data\r\n");
  printf("- bias[*]\r\n");
  for (int i = 0; i < OV_LEN; i++)
    bias[i] = 0; // could be randomized as well
  printf("- in_vec[*]\r\n");
  for (int j = 0; j < IV_LEN; j++)
    in_vec[j] =
        custom_rand_range(-(1 << (IV_BIT - 1)), (1 << (IV_BIT - 1)) - 1);
  for (int i = 0; i < OV_LEN; i++) {
    printf("- in_mat[%d][*]\r\n", i);
    for (int j = 0; j < IV_LEN; j++) {
      in_mat[i][j] =
          custom_rand_range(-(1 << (IM_BIT - 1)), (1 << (IM_BIT - 1)) - 1);
    }
  }

  /** Pack data **/
  printf("Packing data\r\n");
  pack_data();

  /** Perform computation in several implementations **/

  uint32_t t0, t1, t_sw, t_sw_unroll, t_hw_custom_8b, t_hw_custom_8b_unroll;

  // Compute using SW
  printf("CPU computation\r\n");
  // CSR_READ(CSR_REG_MCYCLE, &t0); // start timer
  MxV_sw();
  // CSR_READ(CSR_REG_MCYCLE, &t1); // stop timer
  t_sw = t1 - t0;

  // Compute using SW (with unrolling)
  printf("CPU computation (unrolling)\r\n");
  // CSR_READ(CSR_REG_MCYCLE, &t0); // start timer
  MxV_sw_unroll();
  // CSR_READ(CSR_REG_MCYCLE, &t1); // stop timer
  t_sw_unroll = t1 - t0;

  // Compute using custom instructions (8-bit)
  printf("Custom Instructions (8-bit)\r\n");
  // CSR_READ(CSR_REG_MCYCLE, &t0); // start timer
  MxV_custom_8b();
  // CSR_READ(CSR_REG_MCYCLE, &t1); // stop timer
  t_hw_custom_8b = t1 - t0;

  // Compute using custom instructions (8-bit)
  printf("Custom Instructions (8-bit) (unrolling)\r\n");
  // CSR_READ(CSR_REG_MCYCLE, &t0); // start timer
  MxV_custom_8b_unroll();
  // CSR_READ(CSR_REG_MCYCLE, &t1); // stop timer
  t_hw_custom_8b_unroll = t1 - t0;

  /** Check results **/

  printf("Checking result\r\n");

  printf("CPU (+ 8x loop unrolling)\r\n");
  int bad_sw_unroll = compare(out_vec_sw_unroll, out_vec_sw, OV_LEN);
  //^ need to use out_vec_sw_unroll; otherwise call to MxV_sw_unroll() gets
  // optimized out
  printf("TEST %s\r\n", (bad_sw_unroll) ? "FAILED" : "PASSED");

  printf("Custom Instructions (8-bit)\r\n");
  int bad_custom_8b = compare(out_vec_custom_instr, out_vec_sw, OV_LEN);
  printf("TEST %s\r\n", (bad_custom_8b) ? "FAILED" : "PASSED");

  printf("Custom Instructions (8-bit) (unrolling)\r\n");
  int bad_custom_8b_unroll =
      compare(out_vec_custom_instr_unroll, out_vec_sw, OV_LEN);
  printf("TEST %s\r\n", (bad_custom_8b_unroll) ? "FAILED" : "PASSED");

  /** Print times **/

  printf("Printing timing result\r\n");
  printf("- CPU:            %9u clock cycles\r\n", t_sw);
  printf("- CPU (unrolled): %9u clock cycles\r\n", t_sw_unroll);
  printf("- Custom 8-bit:   %9u clock cycles\r\n", t_hw_custom_8b);

  printf("- Custom 8-bit (unrolled):   %9u clock cycles\r\n",
         t_hw_custom_8b_unroll);

  return 0;
}
