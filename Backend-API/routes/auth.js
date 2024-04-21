var admin = require('firebase-admin');
const express = require('express');
const { auth } = require('../config');
const { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail} = require('firebase/auth');
const { calculateAge, isValidDateFormat, isValidGender, } = require('../utils');

const router = express.Router();
router.use(express.json());

// route untuk melakukan registrasi pengguna
router.post('/register', async (req, res) => {
  const { email, password, name, gender, birthDate } = req.body;
  // validasi input
  if (!email || !password || !name || !gender || !birthDate) {
    return res.status(400).json({
      status: 'failed',
      message: 'Semua kolom input harus diisi',
      error: 'Input tidak boleh kosong'
    });
  }

  // Validasi gender (harus 'male' atau 'female')
  if (!isValidGender(gender)) {
    return res.status(400).json({
      status: 'failed',
      message: 'Harap pilih jenis kelamin yang valid (male, atau female)',
      error: 'Jenis kelamin tidak valid'
    });
  }

  // Validasi birthDate (format tanggal yang valid)
  if (!isValidDateFormat(birthDate)) {
    return res.status(400).json({
      status: 'failed',
      message: 'Harap masukkan tanggal lahir yang valid (format: DD-MM-YYYY)',
      error: 'Tanggal lahir tidak valid'
    });
  }

  try {
    // Membuat pengguna dengan email dan password
    const userRecord = await createUserWithEmailAndPassword(auth, email, password); 
    const age = calculateAge(birthDate); // Menghitung usia berdasarkan tanggal lahir
     // Menyimpan detail pengguna ke Realtime Database
    await admin.database().ref(`/users/${userRecord.user.uid}`).set({
      name, email, gender, birthDate, age
    });
    // Memberikan respons berhasil
    res.status(201).json({ 
      status: 'success', message: 'Pengguna berhasil terdaftar!', 
      userId: userRecord.user.uid, name, gender, birthDate, age
    });
    
  } catch (error) {
    // Penanganan error
    if (error.code === 'auth/invalid-email') {
      res.status(400).json({ 
        status: 'failed', message: 'Harus menggunakan format email dengan benar',
        error: 'Email tidak valid'
      });
    } else if (error.code === 'auth/email-already-in-use') {
      res.status(400).json({ 
        status: 'failed', message: 'Login atau gunakan email yang telah ada',
        error: 'Email telah digunakan'
      });
    } else if (error.code === 'auth/weak-password') {
      res.status(400).json({ 
        status: 'failed', message: 'Gunakan password yang valid (minimal 6 karakter)',
        error: 'Password lemah'
      });
    } else {
      res.status(500).json({ 
        status: 'failed', message: 'Gagal mendaftarkan pengguna',
        error: 'Server Error'
      });
    }
  }
});

// Route to login with email and password
router.post('/login', async (req, res) => {
  const { email, password } = req.body; // Mengambil payload dari request
  try {
    const userRecord = await signInWithEmailAndPassword(auth, email, password); // Proses login
    const token = await userRecord.user.getIdToken(); // token dari user yang berhasil login
    // timestamp kadaluarsa token dan konversi ke waktu lokal
    const tokenExp = await userRecord.user.stsTokenManager.expirationTime;
    const expirateTime = await new Date(tokenExp).toLocaleString('en-US', { 
      timeZone: 'Asia/Bangkok' 
    });
    // respon berhasil
    res.status(200).json({
      status: 'success', message: 'Berhasil login',
      token,
      expirateTime,
    });
    // penanganan error
  } catch (error) {
    if (error.code === 'auth/invalid-credential' ) {
      res.status(400).json({
        status: 'failed', message: 'Email atau password yang dimasukkan salah',
        error: 'Invalid Credential'
      });
    } else {
      res.status(500).json({
        status: 'failed', message: 'Tidak dapat melakukan login, coba lagi nanti',
        error: 'Server Error'
      });
    }
  }
});

// Route to log out
router.post('/logout', (req, res) => {
  // logout logic
  auth.signOut()
    .then(() => {
      res.status(200).json({ 
        status: 'success', message: 'Berhasil Logout' });
    })
    .catch((error) => {
      res.status(500).json({ 
        status: 'failed', message: 'Gagal Logout', 
        error: 'Server Error'
      });
    });
});

// Route to reset password
router.post('/reset-password', async (req, res) => {
  const { email } = req.body;
  try {
    await sendPasswordResetEmail(auth, email);
    
    // Password reset email sent successfully.
    res.status(200).json({ 
      status: 'success', message: 'Silahkan Cek Email Anda untuk Melakukan Reset Password!' 
    });
  } catch (error) {
    res.status(500).json({
      status: 'failed', message: 'Gagal mengirim email reset password',
      error: error.code
    });
  }
});

module.exports = router;