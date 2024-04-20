const express = require('express');
var admin = require('firebase-admin');
const { db } = require('../config');
const { calculateAge, isValidDateFormat} = require('../utils');

const router = express.Router();
router.use(express.json());

// Route to get user data by UID
router.get('/', async (req, res) => {
  try {
    const uid = req.user.uid;

    const userSnapshot = await db.ref(`/users/${uid}`).once('value');
    const userData = userSnapshot.val();

    if (!userData) {
      return res.status(404).json({ 
        status: 'failed', message: 'Tidak dapat menemukan pengguna' 
      });
    }
    res.status(200).json({ status: 'success', user: userData });
  } catch (error) {
    console.error('Error fetching user data:', error.message);
    res.status(500).json({ 
      status: 'failed', message: 'Tidak dapat mengambil data user' 
    });
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

    if (newData.birthDate && !newData.age) {
      if (!isValidDateFormat(newData.birthDate)) {
        return res.status(400).json({
          status: 'failed', error: 'Format Tanggal Tidak Valid',
          message: 'Tanggal lahir harus dalam format dd-MM-yyyy'
        });
      }
      newData.age = calculateAge(newData.birthDate);
    }

    // Validate and handle errors for name
    if (!newData.name) {
      newData.name = userData.name;
    }

    // Validate and handle errors for gender
    if (!newData.gender) {
      newData.gender = userData.gender;
    }

    // Validate and handle errors for birthdate
    if (newData.birthDate == "12-12-1212") {
      return res.status(400).json({
        status: 'failed', error: 'Invalid birthDate Value',
        message: 'Format tanggal lahir tidak valid'
      });
    }

    // Additional validation for gender values
    if (newData.gender && !['male', 'female'].includes(newData.gender.toLowerCase())) {
      return res.status(400).json({
        status: 'failed', error: 'Invalid Gender Value',
        message: 'Format gender atau jenis kelamin tidak valid'
      });
    }

    await db.ref(`/users/${uid}`).update(newData);

    res.status(200).json({ 
      status: 'success', message: 'Update data pengguna berhasil dilakukan', 
      data: newData
    });
  } catch (error) {
    console.error('Error updating user data:', error.message);
    res.status(500).json({ 
      status: 'failed', error: 'Server Error',
      message: 'Update data pengguna gagal'
    });
  }
});

// Route to update password
router.post('/update-password', async (req, res) => {
  try {
    // Check if newPassword is provided in the request body
    const { newPassword } = req.body; 
    if (!newPassword) {
      return res.status(400).json({ 
        status: 'failed', message: 'Password tidak boleh kosong!' 
      });
    }

    // Check if user is authenticated
    if (!req.user || !req.user.uid) {
      return res.status(401).json({ 
        status: 'failed', message: 'Unauthorized' });
    }
    
    const uid = req.user.uid;
    
    // Retrieve user data from Realtime Database
    const userSnapshot = await admin.database().ref(`/users/${uid}`).once('value');
    const userData = userSnapshot.val();

    if (!userData) {
      return res.status(404).json({ 
        status: 'failed', message: 'User not found' 
      });
    }

    // Update password using Firebase Authentication API
    await admin.auth().updateUser(uid, {
      password: newPassword
    });

    res.status(200).json({
      status: 'success', message: 'Password telah berhasil diganti'
    });
  } catch (error) {
    if (error.code === "auth/requires-recent-login") {
      res.status(401).json({
        status: 'failed', message: 'Sesi habis, silahkan login kembali'
      });
    } else if (error.code === "auth/weak-password") {
      res.status(400).json({
        status: 'failed', error: 'Password Lemah',
        message: 'Gunakan password yang valid (minimal 6 karakter)'
      });
    } else {
      res.status(500).json({
        status: 'failed', error: 'Server Error',
        message: 'Password tidak dapat diganti'
      });
    }
  }
});

module.exports = router;