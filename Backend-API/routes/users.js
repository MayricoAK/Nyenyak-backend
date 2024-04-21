const express = require('express');
var admin = require('firebase-admin');
const { db } = require('../config');
const { calculateAge, isValidDateFormat, isValidGender} = require('../utils');

const router = express.Router();
router.use(express.json());

// Mendapatkan detail dari data pengguna
router.get('/', async (req, res) => {
  try {
    const uid = req.user.uid;

    // Retrieve user data from Realtime Database
    const userSnapshot = await db.ref(`/users/${uid}`).once('value');
    const userData = userSnapshot.val();

    // Pengecekan apakah data pengguna ditemukan
    if (!userData) {
      return res.status(404).json({ status: 'failed', message: 'Pengguna tidak ditemukan' });
    }

    // Respon
    res.status(200).json({ status: 'success', user: userData });
  } catch (error) {
    res.status(500).json({ status: 'failed', message: 'Gagal mengambil data pengguna' });
  }
});

// Route to update user data
router.put('/', async (req, res) => {
  try {
    const uid = req.user.uid;
    const newData = req.body;

    // Retrieve user data from Realtime Database
    const userSnapshot = await admin.database().ref(`/users/${uid}`).once('value');
    const userData = userSnapshot.val();

    // Set nilai default jika variabel nama dan gender kosong
    newData.name = newData.name || userData.name;
    newData.gender = newData.gender || userData.gender;

    // Jika birthDate masih menggunakan nilai default dari app, set nilai birthDate yang ada
    if (newData.birthDate === "12-12-1212") {
      newData.birthDate = userData.birthDate || ""; 

      // Jika birthDate yang ada kosong atau tidak valid
      if (!newData.birthDate || newData.birthDate === "12-12-1212") {
        return res.status(400).json({ 
          status: 'failed', error: 'Format Tanggal Tidak Valid', message: 'Tanggal lahir yang dimasukkan tidak boleh default' });
      }
    }

    // Validasi nilai gender
    if (newData.gender && !isValidGender(newData.gender)) {
      return res.status(400).json({ 
        status: 'failed', error: 'Invalid Gender Value', message: 'Format gender atau jenis kelamin yang dimasukkan harus valid'
      });
    }

    // Proses update age jika birthDate valid
    if (newData.birthDate && !newData.age) {
      if (!isValidDateFormat(newData.birthDate)) {
        return res.status(400).json({ 
          status: 'failed', error: 'Format Tanggal Tidak Valid', message: 'Tanggal lahir harus dalam format dd-MM-yyyy' });
      }
      newData.age = calculateAge(newData.birthDate);
    }

    await db.ref(`/users/${uid}`).update(newData); // Proses update data pengguna

    // Respon
    res.status(200).json({ 
      status: 'success', message: 'Update data pengguna berhasil dilakukan', data: newData });
  } catch (error) {
    res.status(500).json({ 
      status: 'failed', error: 'Server Error', message: 'Update data pengguna gagal'});
  }
});

// Route to update password
router.post('/update-password', async (req, res) => {
  try {
    const { newPassword } = req.body; 
    // Validasi
    if (!newPassword) {
      return res.status(400).json({ status: 'failed', message: 'Password tidak boleh kosong!' });
    }

    // Pengecekan user
    const uid = req.user.uid;
    if (!uid) {
      return res.status(401).json({ status: 'failed', message: 'Unauthorized' });
    }

    // Proses update
    await admin.auth().updateUser(uid, {
      password: newPassword
    });

    // Respon
    res.status(200).json({ status: 'success', message: 'Password berhasil diganti' });
  } catch (error) {
    if (error.code === "auth/requires-recent-login") {
      return res.status(401).json({ 
        status: 'failed', message: 'Sesi habis, silakan login kembali' });
    } else if (error.code === "auth/weak-password") {
      return res.status(400).json({ 
        status: 'failed', error: 'Password Lemah', message: 'Gunakan password yang lebih kuat (minimal 6 karakter)' });
    }

    return res.status(500).json({ status: 'failed', error: 'Server Error', message: 'Gagal mengganti password' });
  }
});

module.exports = router;