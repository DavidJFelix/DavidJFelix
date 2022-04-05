use std::collections::HashMap;

pub fn can_construct_note(magazine: &[&str], note: &[&str]) -> bool {
    let mut magazine_word_count: HashMap<&str, u32> = HashMap::new();
    let mut note_word_count: HashMap<&str, u32> = HashMap::new();

    magazine
        .iter()
        .for_each(|word| *magazine_word_count.entry(word).or_default() += 1);
    note.iter()
        .for_each(|word| *note_word_count.entry(word).or_default() += 1);

    note_word_count
        .into_iter()
        .all(|(word, count)| *magazine_word_count.entry(word).or_default() >= count)
}
