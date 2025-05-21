void bar(int* some) {
    return;
}

void foo() {
    int a = 8;
    bar(&a);
    int* b = &a;
}