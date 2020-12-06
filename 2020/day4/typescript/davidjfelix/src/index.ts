import fs from 'fs'
import _ from 'lodash'

const input = fs
  .readFileSync('./input.txt', 'utf8')
  .split('\n\n')
  .map((block) => block.split(/\s/))

const passportsWithCorrectFields = input
  .map((passport) => _.fromPairs(passport.map((entry) => entry.split(':'))))
  .filter((passport) =>
    _.every(
      ['byr', 'iyr', 'eyr', 'hgt', 'hcl', 'ecl', 'pid'],
      _.partial(_.has, passport),
    ),
  )

// Part 1
console.log(passportsWithCorrectFields.length)

function isValidNumberInRange(
  subject: string,
  min: number,
  max: number,
): boolean {
  const maybeNum = Number(subject)
  if (isNaN(maybeNum)) {
    return false
  } else {
    return min <= maybeNum && maybeNum <= max
  }
}

const validPassports = passportsWithCorrectFields
  .filter(({ byr }) => isValidNumberInRange(byr, 1920, 2002))
  .filter(({ iyr }) => isValidNumberInRange(iyr, 2010, 2020))
  .filter(({ eyr }) => isValidNumberInRange(eyr, 2020, 2030))
  .filter(({ hgt }) => {
    if (hgt.endsWith('cm')) {
      return isValidNumberInRange(hgt.slice(0, -2), 150, 193)
    } else if (hgt.endsWith('in')) {
      return isValidNumberInRange(hgt.slice(0, -2), 59, 76)
    } else {
      return false
    }
  })
  .filter(({ hcl }) => hcl.match(/^#[0-9a-f]{6}$/))
  .filter(({ ecl }) =>
    _.includes(['amb', 'blu', 'brn', 'gry', 'grn', 'hzl', 'oth'], ecl),
  )
  .filter(({ pid }) => pid.match(/^[0-9]{9}$/))

// Part 2
console.log(validPassports.length)
