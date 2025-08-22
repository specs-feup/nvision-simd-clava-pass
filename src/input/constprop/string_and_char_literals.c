char* glob = "glob";

void foo(char* bar) {};

int main(void) {
    char a = 'a';
    char* b = "hello";
    char* c = b;
    char* d = glob;
    int e = a + 2;
    foo(b);
}
