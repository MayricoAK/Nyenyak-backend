const express = require('express');
// const crypto = require('crypto');
const axios = require('axios');
const { db, verifyFirebaseToken } = require('../config');
const { generateUniqueId, getCurrentTimestamp, isNumeric } = require('../utils');

const router = express.Router();
router.use(express.json());

router.use(verifyFirebaseToken);

// Route to get all diagnoses by logged user
router.get('/', (req, res) => {
  const uid = req.user.uid;

  db.ref(`diagnosis/${uid}`).once('value')
    .then((snapshot) => {
      const data = snapshot.val();
      let diagnoses = [];

      // Extract diagnosis objects from snapshot
      if (data) {
        // Convert snapshot to an array of diagnoses
        diagnoses = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));

        // Sort the diagnoses by date in descending order
        diagnoses.sort((a, b) => {
          // Parse dates in the format "DD-MM-YYYY"
          const dateA = new Date(a.date.split('-').reverse().join('-'));
          const dateB = new Date(b.date.split('-').reverse().join('-'));
          return dateB - dateA;
        });
      }

      res.json(diagnoses);
    })
    .catch((error) => {
      console.error('Error fetching diagnoses:', error.message);
      res.status(500).json({ status: 'failed', message: 'Terjadi kesalahan ketika mengambil data diagnosis' });
    });
});

// Route to get a specific diagnosis by ID for the logged-in user
router.get('/:id', (req, res) => {
  try {
    const diagnosisId = req.params.id;
    const uid = req.user.uid;

    db.ref(`diagnosis/${uid}/${diagnosisId}`).once('value', (snapshot) => {
      const diagnosis = snapshot.val();

      if (!diagnosis) {
        return res.status(404).json({ status: "failed", message: 'Belum memiliki data diagnosis' });
        // return res.status(404).json({ status: "failed", message: 'Belum memiliki data diagnosis' });
      }

      res.json(diagnosis);
    }, (error) => {
      console.error('Error fetching diagnosis:', error.message);
      res.status(500).json({ status: "failed", message: 'Terjadi kesalahan ketika mengambil data diagnosis' });
    });
  } catch (error) {
      console.error('Exception in fetching diagnosis:', error.message);
      res.status(500).json({ status: "failed", message: 'Tidak dapat mengambil data diagnosis' });
  }
});

// Route to create a new diagnosis
router.post('/', async (req, res) => {
  try {
  const uid = req.user.uid;

  const userSnapshot = await db.ref(`/users/${uid}`).once('value');
  const userData = userSnapshot.val();

  if (!userData) {
    return res.status(400).json({ message: 'Pengguna tidak dapat ditemukan' });
  }

  const {
    gender: userGender,
    age: userAge,
    name: userName,
  } = userData;

  const {
    weight,
    height,
    sleepDuration,
    qualityOfSleep,
    physicalActivityLevel,
    stressLevel,
    bloodPressure,
    heartRate,
    dailySteps
  } = req.body;

  // validasi input
  if (
    !isNumeric(weight) ||
    !isNumeric(height) ||
    !isNumeric(sleepDuration) ||
    !isNumeric(qualityOfSleep) ||
    !isNumeric(physicalActivityLevel) ||
    !isNumeric(stressLevel) ||
    !isNumeric(bloodPressure) ||
    !isNumeric(heartRate) ||
    !isNumeric(dailySteps)
  ) {
    return res.status(400).json({ message: 'Mohon pastikan semua nilai yang dimasukkan adalah angka' });
  }

  if (sleepDuration > 24 || physicalActivityLevel > 24) {
    return res.status(400).json({ message: 'Durasi yang dimasukkan tidak dapat melebihi 24 jam' });
  }
  if (sleepDuration <= 0 || physicalActivityLevel < 0 || bloodPressure <= 0 || heartRate <= 0 || dailySteps < 0) {
    return res.status(400).json({ message: 'Pastikan semua nilai yang dimasukkan valid' });
  }
  if (!height || !weight || !heartRate || !dailySteps ) {
    return res.status(400).json({ message: 'Mohon isi semua data dengan benar' });
  }
  
  const heightInMeters = height / 100;
  const BMI = weight / (heightInMeters ** 2);

  let BMIcategory;
  if (BMI < 25) {
    BMIcategory = 'Normal';
  } else if (BMI < 30) {
    BMIcategory = 'Overweight';
  } else {
    BMIcategory = 'Obese';
  }

  const newId = generateUniqueId();
  const createdAt = getCurrentTimestamp();

  const toMinute = physicalActivityLevel*60;

  // Data in the format accepted by the Flask model API
  const modelApiInput = {
    "Gender": userGender === 'Male' ? 1 : 0,
    "Age": userAge,
    "Sleep_Duration": sleepDuration,
    "Sleep_Quality": (() => {
      if (qualityOfSleep >= 4 && qualityOfSleep <= 9) {
        return qualityOfSleep - 4;
      } else if (qualityOfSleep < 4) {
        return 0;
      } else {
        return 5;
      }
    })(),
    "Physical_Activity_Level": physicalActivityLevel,
    "Stress_Level": (() => {
      if (stressLevel >= 3 && stressLevel <= 8) {
        return stressLevel - 3;
      } else if (stressLevel < 3) {
        return 0;
      } else {
        return 5;
      }
    })(),
    "BMI_Category": BMIcategory === 'Obese' ? 1 : (BMIcategory === 'Overweight' ? 2 : 0),
    "Heart_Rate": heartRate,
    "Daily_Steps": dailySteps,
    "BP_Category": (() => {
      if (bloodPressure === 'Normal') {
        return 1;
      } else if (bloodPressure === 'Stage 1') {
        return 2;
      } else if (bloodPressure === 'Stage 2') {
        return 3;
      } else {
        return 0;
      }
    })()
  };
  
  // Send data to Flask model API
  const modelApi = 'https://nyenyak-model-api-z2dhcxitca-et.a.run.app/prediction'; // PUT DEPLOYED MODEL API ENDPOINT HERE, DONT FORGET TO ADD /prediction to ENDPOINT
  const modelApiResponse = await axios.post(modelApi, modelApiInput);

  const sleepDisorderPrediction = modelApiResponse.data.sleep_disorder;

  const solution = await db.ref(`solution/${sleepDisorderPrediction}`).once('value').then(snapshot => snapshot.val());

  const newDiagnosis = {
    id: newId,
    uid: uid,
    date: createdAt,
    gender: userGender,
    age: userAge,
    name: userName,
    BMIcategory,
    sleepDuration,
    qualityOfSleep,
    physicalActivityLevel: toMinute,
    stressLevel,
    bloodPressure,
    heartRate,
    dailySteps,
    sleepDisorder: sleepDisorderPrediction,
    solution: solution
  };

  db.ref(`diagnosis/${uid}/${newId}`).set(newDiagnosis)
  .then(() => {
      res.status(201).json({ status: "success", message: "Data diagnosis berhasil ditambahkan", newDiagnosis });
  })
  .catch((error) => {
      console.error('Error creating diagnosis:', error.message);
      res.status(500).json({ status: "failed", message: 'Terjadi kesalahan ketika membuat data diagnosis' });
  });
  } catch (error) {
    console.error('Exception in creating diagnosis:', error.message);
    res.status(500).json({ status: "failed", message: 'Tidak dapat membuat data diagnosis' });
  }
});

// Route to delete a diagnosis by ID
router.delete('/:id', (req, res) => {
  try {
    const diagnosisId = req.params.id;
    const uid = req.user.uid;

    db.ref(`diagnosis/${uid}/${diagnosisId}`).remove()
      .then(() => {
        res.status(200).json({ status: "success", message: 'Data diagnosis telah dihapus' });
      })
      .catch((error) => {
        console.error('Error deleting diagnosis:', error.message);
        res.status(500).json({ status: "failed", message: 'Terjadi kesalahan ketika menghapus data diagnosis' });
      });
  } catch (error) {
    console.error('Exception in deleting diagnosis:', error.message);
    res.status(500).json({ status: "failed", message: 'Tidak dapat menghapus data diagnosis' });
  }
});

module.exports = router;