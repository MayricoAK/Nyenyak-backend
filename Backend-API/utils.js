const { differenceInYears, parse, isValid } = require('date-fns');
const crypto = require('crypto');

function calculateAge(dateOfBirth) {
  const dob = parse(dateOfBirth, 'dd-MM-yyyy', new Date());
  const age = differenceInYears(new Date(), dob);
  return age;
}

function isValidDateFormat(dateString) {
  const parsedDate = parse(dateString, 'dd-MM-yyyy', new Date());
  return isValid(parsedDate);
}

function generateUniqueId(size = 8) {
  return crypto.randomBytes(size).toString('hex');
}
  
function getCurrentTimestamp() {
  const date = new Date();
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  
  return `${day}-${month}-${year}`;
}

module.exports = { calculateAge, isValidDateFormat, generateUniqueId, getCurrentTimestamp};