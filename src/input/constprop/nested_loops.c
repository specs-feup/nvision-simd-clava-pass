int main() {
    int a;
    for (int i = 0; i < 200; i++) {
        int b = a;
        int c = b;

        int d = a;
        int e = d;

        for (int j = 0; j < 30; j++) {
            b = 1;
            d++;
        }
    }
}