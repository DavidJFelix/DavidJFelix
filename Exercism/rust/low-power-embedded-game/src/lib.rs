pub fn divmod(dividend: i16, divisor: i16) -> (i16, i16) {
    (dividend / divisor, dividend % divisor)
}

pub fn evens<T>(iter: impl Iterator<Item = T>) -> impl Iterator<Item = T> {
    return iter
        .enumerate()
        .filter(|&(i, _)| i % 2 == 0)
        .map(|(_, e)| e);
}

pub struct Position(pub i16, pub i16);
impl Position {
    pub fn manhattan(&self) -> i16 {
        let &Position(a, b) = self;
        a.abs() + b.abs()
    }
}
