int main() {
  int a = 0;
  for (a = 1; a < 10; a--) {
    for (int i; i < 11; ++a) {
      a = 2;
    }
  }
  a + 3;
  a = 4;

  int b = 0;
  int i = 0;
  for (b = 1; b < 10; i++) {
    for (i = 0; i < 11; --b) {
      b = 2;
    }
  }
  b - 5;
  b = 6;
}