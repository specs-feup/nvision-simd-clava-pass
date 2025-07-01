void foo(int a) {
  int b;
  b = 0;
}

int main() {
  int a;
  a = 1;
  int b;
  b = 2;
  int c;
  c = 3;
  {
    int c;
    c = 5;
  }
}