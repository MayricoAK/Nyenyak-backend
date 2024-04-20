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
function calculateBMI(height, weight){
  const heightInMeters = height / 100;
  const BMI = weight / (heightInMeters ** 2);
  let BMIcategory;
    if (BMI < 25) {
      return BMIcategory = 'Normal';
    } else if (BMI < 30) {
      return BMIcategory = 'Overweight';
    } else {
      return BMIcategory = 'Obese';
    }
}

function convertBMI(BMIcategory) {
  let category = 0;
  if (BMIcategory === 'Obese') {
    category = 1;
  } else if (BMIcategory === 'Overweight') {
    category = 2;
  }

  return category;
}

// Menghitung Sleep Quality
function calculateSleepQuality(qualityOfSleep) {
  if (qualityOfSleep >= 4 && qualityOfSleep <= 9) {
    return qualityOfSleep - 4;
  } else if (qualityOfSleep < 4) {
    return 0;
  } else {
    return 5;
  }
}

// Menghitung Stress Level
function calculateStressLevel(stressLevel) {
  if (stressLevel >= 3 && stressLevel <= 8) {
    return stressLevel - 3;
  } else if (stressLevel < 3) {
    return 0;
  } else {
    return 5;
  }
}

// Menghitung BP Category
function calculateBpCategory(bloodPressure) {
  switch (bloodPressure) {
    case 'Normal':
      return 1;
    case 'Stage 1':
      return 2;
    case 'Stage 2':
      return 3;
    default:
      return 0;
  }
}

function isValidDiagnosisId(id) {
  // Implement your validation logic here
  return typeof id === 'string' && id.trim().length > 0;
}

function isValidGender(gender) {
  return ['male', 'female'].includes(gender.toLowerCase());
}

module.exports = { isValidGender, isValidDiagnosisId, calculateAge, isValidDateFormat, generateUniqueId, getCurrentTimestamp, calculateBMI, convertBMI, calculateSleepQuality,calculateStressLevel,calculateBpCategory };