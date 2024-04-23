const express = require('express');
// const crypto = require('crypto');
const axios = require('axios');
const { db, verifyFirebaseToken } = require('../config');
const { generateUniqueId, getCurrentTimestamp, calculateBMI, convertBMI, 
        calculateSleepQuality,calculateStressLevel,calculateBpCategory, isValidDiagnosisId 
      } = require('../utils');

const router = express.Router();
router.use(express.json());

router.use(verifyFirebaseToken);

// Mendapatkan diagnosis pada pengguna
router.get('/', async (req, res) => {
  try {
    const uid = req.user.uid;

    // Mengambil data diagnosis dari database
    const snapshot = await db.ref(`diagnosis/${uid}`).once('value');
    const data = snapshot.val();

    // Memasukkan data dari database ke array map
    let diagnoses = Object.keys(data).map(key => ({
      id: key,
      ...data[key]
    }));

    // Sorting diagnosis by date in Descending order
    diagnoses.sort((a, b) => {
      const dateA = new Date(a.date.split('-').reverse().join('-'));
      const dateB = new Date(b.date.split('-').reverse().join('-'));
      return dateB - dateA;
    });

    // Mengubah diagnosis yang sudah sorting menjadi respon JSON
    res.json(diagnoses);
  } catch (error) {
    res.status(500).json({ status: 'failed', message: 'Terjadi kesalahan ketika mengambil data diagnosis' });
  }
});

// Mendapatkan detail dari satu diagnosis
router.get('/:id', async (req, res) => {
  try {
    const diagnosisId = req.params.id; // Mendapatkan ID diagnosis dari parameter URL
    const uid = req.user.uid; // Mendapatkan UID

    // Mengambil data diagnosis dari Firebase Realtime Database
    const snapshot = await db.ref(`diagnosis/${uid}/${diagnosisId}`).once('value');
    const diagnosis = snapshot.val(); // Mendapatkan nilai data diagnosis dari snapshot

    if (!diagnosis) {
      // Jika data diagnosis tidak ditemukan untuk pengguna yang sedang masuk
      return res.status(404).json({ status: "failed", message: 'Data diagnosis tidak ditemukan' });
    }

    // Respons
    res.json(diagnosis);
  } catch (error) {
    res.status(500).json({ status: "failed", message: 'Terjadi kesalahan ketika mengambil data diagnosis' });
  }
});

// Route untuk membuat diagnosis baru
router.post('/', async (req, res) => {
  try {
    const uid = req.user.uid; // Mendapatkan UID pengguna dari permintaan

    // Mengambil data pengguna dari Firebase Realtime Database berdasarkan UID
    const userSnapshot = await db.ref(`/users/${uid}`).once('value');
    const userData = userSnapshot.val();

    // Memeriksa apakah data pengguna ditemukan
    if (!userData) {
      return res.status(400).json({ status: "failed", message: 'Pengguna tidak dapat ditemukan' });
    }

    // Mendapatkan detail dari data pengguna
    const {
      gender: userGender,
      age: userAge,
      name: userName,
    } = userData;

    // Mendapatkan data dari permintaan
    const {
      weight, height, sleepDuration, qualityOfSleep, physicalActivityLevel, 
      stressLevel, bloodPressure, heartRate, dailySteps
    } = req.body;

    // Validasi input:
    // - Semua input harus diisi
    if (!height || !weight || !heartRate || !dailySteps ) {
      return res.status(400).json({ status: "failed", message: 'Data yang dimasukkan tidak boleh kosong, Mohon isi semua data dengan benar' });
    }
    // - Durasi tidur dan aktivitas fisik tidak boleh lebih dari 24 jam
    if (sleepDuration > 24 || physicalActivityLevel > 24) {
      return res.status(400).json({ status: "failed", message: 'Durasi yang dimasukkan tidak dapat melebihi 24 jam' });
    }
    // - Nilai input tidak boleh 0
    if (sleepDuration <= 0 || physicalActivityLevel < 0 || bloodPressure <= 0 || heartRate <= 0 || dailySteps < 0) {
      return res.status(400).json({ status: "failed", message: 'Pastikan semua nilai yang dimasukkan valid' });
    }

    // Menghitung BMI (Body Mass Index) berdasarkan berat dan tinggi
    const BMIcategory = calculateBMI(height, weight);

    // Membuat ID dan timestamp baru untuk diagnosis
    const newId = generateUniqueId();
    const createdAt = await getCurrentTimestamp();

    // Mengonversi level aktivitas fisik dari jam menjadi menit
    const toMinute = physicalActivityLevel * 60;

    // Membuat objek data untuk dikirim ke Flask model API
    const modelApiInput = {
      "Gender": userGender === 'Male' ? 1 : 0,
      "Age": userAge,
      "Sleep_Duration": sleepDuration,
      "Sleep_Quality": calculateSleepQuality(qualityOfSleep),
      "Physical_Activity_Level": physicalActivityLevel,
      "Stress_Level": calculateStressLevel(stressLevel),
      "BMI_Category": convertBMI(BMIcategory),
      "Heart_Rate": heartRate,
      "Daily_Steps": dailySteps,
      "BP_Category": calculateBpCategory(bloodPressure)
    };

    // Mengirim data ke Flask model API untuk prediksi
    const modelApi = 'https://nyenyak-model-api-z2dhcxitca-et.a.run.app/prediction';
    const modelApiResponse = await axios.post(modelApi, modelApiInput);

    // Mendapatkan prediksi gangguan tidur dari respons model API
    const sleepDisorderPrediction = modelApiResponse.data.sleep_disorder;

    // Mendapatkan solusi untuk gangguan tidur dari Firebase Realtime Database
    const solution = await db.ref(`solution/${sleepDisorderPrediction}`).once('value').then(snapshot => snapshot.val());

    // Membuat objek diagnosis baru
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

    // Menyimpan data diagnosis ke Firebase Realtime Database
    await db.ref(`diagnosis/${uid}/${newId}`).set(newDiagnosis);

    // Memberikan respons sukses jika diagnosis berhasil dibuat
    res.status(201).json({ status: "success", message: "Data diagnosis berhasil ditambahkan", newDiagnosis });
  } catch (error) {
    // Menangani kesalahan yang mungkin terjadi saat membuat diagnosis
    res.status(500).json({ status: "failed", message: 'Tidak dapat membuat data diagnosis' });
  }
});

// menghapus diagnosis berdasarkan ID
router.delete('/:id', async (req, res) => {
  try {
    const diagnosisId = req.params.id; // Mendapatkan diagnosisId dari parameter URL
    const uid = req.user.uid; // Mendapatkan UID (User ID) dari pengguna yang sedang masuk

    // Validasi diagnosis
    if (!isValidDiagnosisId(diagnosisId)) {
      return res.status(400).json({ status: "failed", message: 'Invalid diagnosis ID' });
    }

    // Proses penghapusan diagnosis dari Firebase Realtime Database
    await db.ref(`diagnosis/${uid}/${diagnosisId}`).remove();

    // Mengirim respons
    res.status(200).json({ status: "success", message: 'Data diagnosis telah dihapus' });
  } catch (error) {
    res.status(500).json({ status: "failed", message: 'Terjadi kesalahan ketika menghapus data diagnosis' });
  }
});

module.exports = router;