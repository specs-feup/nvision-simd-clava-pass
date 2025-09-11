signed int foo(signed char A[8], signed char B[8]) {
  signed int accum = 0;
  for (int i = 0; i < 8; i++) {
    int d = 3;
    accum += A[i] * B[(2) + (i) + d+1];
  }
  return accum;
}