int nonConstGlobal = 0;
int constGlobal = 1;

void foo() { nonConstGlobal = 2; }

void bar() {
    int y = constGlobal;
    int z = nonConstGlobal;
}

int main() {
  int a = nonConstGlobal;
  foo();
  int b = nonConstGlobal;

  int c = constGlobal;
  foo();
  int d = constGlobal;
}