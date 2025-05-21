int bar() {
    return 0;
}

void foo() {
    int a = 2;
    a = bar();
    int b = a;

    int c = 2 + 2;
    int d = c;
}