void foo() {
  {
    int c;
    {
      int d;
    }
  }
}

int main() {
  for (int a; a < 1; a++) {
    for (int b; b <= 20; ++b)
      ;
  }
}