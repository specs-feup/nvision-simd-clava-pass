void foo();

void bar() {
    int y = 0;
    foo();
}

void foo() {
    int z = 1;
    bar();
}

int main() {
    while (1) {
        foo();
    }
}