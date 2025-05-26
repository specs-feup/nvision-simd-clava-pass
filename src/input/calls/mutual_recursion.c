void bar();

void foo() {
  int w = 0;
  bar();
}

void bar() {
  int z = 1;
  foo();
}

int main() {
  int a = 0;
  foo();
}