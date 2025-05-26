void notIncluded() { int b = 17; }

void test2() { int n = 13; }

void test1() { int m = 7; }

void baz() {
  int k = 1;

  test1();
  test2();
}

void foo() {
  int x = 0;
  baz();
}

void bar() {
  int y = 2;
  foo();
}

int main() {
  int a = 5;
  bar();
}