signed int foo(signed char A[8], signed char B[8]) {
  signed int accum = 0;
  for (int i = 0; i < 8; i++) {
    int d = 3;
    int e = d;
    if (1) e = 2;
    accum += A[i] * B[i + e];
  }
  return accum;
}