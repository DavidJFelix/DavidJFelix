pub struct Player {
    pub health: u32,
    pub mana: Option<u32>,
    pub level: u32,
}

impl Player {
    pub fn revive(&self) -> Option<Player> {
        match (self.health, self.level) {
            (0, 0..=9) => Some(Player {
                health: 100,
                mana: None,
                level: self.level,
            }),
            (0, _) => Some(Player {
                health: 100,
                mana: Some(100),
                level: self.level,
            }),
            _ => None,
        }
    }

    pub fn cast_spell(&mut self, mana_cost: u32) -> u32 {
        match self.level {
            0..=9 => {
                match self.health.checked_sub(mana_cost) {
                    Some(x) => self.health = x,
                    None => self.health = 0,
                }
                0
            }
            _ => match self.mana {
                Some(mana) => match mana.checked_sub(mana_cost) {
                    Some(x) => {
                        self.mana = Some(x);
                        mana_cost * 2
                    }
                    None => 0,
                },
                _ => 0,
            },
        }
    }
}
