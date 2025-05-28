int main() {
    int a = 0;
    int changed = 1;
    for (int i = 2; i < 3; i++) {
        int b = a;
        int c = b;

        int d = changed;
        int e = d;

        for (int j = 5; j < 8; j++) {
            changed = 13;
        }
    }
}