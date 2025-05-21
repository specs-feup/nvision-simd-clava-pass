void bar(int some) {
    return;
}

void foo() {
    int a = 3;

    bar(a);

    while(a < 100) {}

    for (int i = a; i < a + 1; i++) {}
}