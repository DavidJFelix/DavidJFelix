switch (foo) {
    case 0:
        const x = 1;
        break;
    case 2:
        x; // `x` can be used while it is not initialized
        break;
}
