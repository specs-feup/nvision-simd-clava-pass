void bar(int* valueModified) {
    *valueModified = 0;
}

void harmless(int* valueNotModified) {
    int pointless = *valueNotModified;
}

void foo() {
    int a = 3;
    bar(&a);
    int b = a;

    int c = 7;
    harmless(&c);
    int d = c;
}