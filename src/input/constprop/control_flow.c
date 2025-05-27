int foo() { return 0 + 1; }

void bar() {
  int q = 2;
  int r = foo();
  int s = foo();
  int t = 3;

  if (r) {
    int u = q;
    t = 5;
    int v = t;
    if (s) {
      int w = q;
      t = 8;
      int x = t;
    }
    int y = t;
  }

  int z = t;
  int alpha = q;
}

void baz() {
  int beta = 13;
  int gamma = 21;

  while (1) {
    int delta = beta;
    gamma = 34;
    int epsilon = gamma;
  }
  
  int zeta = beta;
  int eta = gamma;
}

int main() {
  int a = foo();
  int b = 55;
  if (a) {
    b = 89;
  }

  int c = b;
}