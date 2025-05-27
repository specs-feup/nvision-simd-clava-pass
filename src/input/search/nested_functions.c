void notIncluded() { int u = 0; }

void test1() { int v = 1; }

void test2() { int w = 2; }

void baz() {
  int x = 3;
  test1();
  test2();
}

void bar() {
  int y = 5;
  baz();
}

void foo() {
  int z = 8;
  bar();
}

int main() {
  while (1) {
    foo();
  }
}