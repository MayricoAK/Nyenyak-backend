var admin = require('firebase-admin');
const express = require('express');
const { auth } = require('../config');
const { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail} = require('firebase/auth')

const router = express.Router();
router.use(express.json());

const { differenceInYears, parse, isValid } = require('date-fns');
function calculateAge(dateOfBirth) {
  const dob = parse(dateOfBirth, 'dd-MM-yyyy', new Date());
  const age = differenceInYears(new Date(), dob);
  return age;
}

function isValidDateFormat(dateString) {
  const parsedDate = parse(dateString, 'dd-MM-yyyy', new Date());
  return isValid(parsedDate);
}

router.post('/register', async (req, res) => {
  const { email, password, name, gender, birthDate } = req.body;

  if (!isValidDateFormat(birthDate)) {
    return res.status(400).json({
      status: 'failed',
      error: 'Format Tanggal Tidak Valid',
      message: 'Tanggal lahir harus dalam format dd-MM-yyyy'
    });
  }

  try {
    const userRecord = await createUserWithEmailAndPassword(auth, email, password);
    const age = calculateAge(birthDate)
    await admin.database().ref(`/users/${userRecord.user.uid}`).set({
      name,
      email,
      gender,
      birthDate,
      age
    });

    res.status(201).json({ 
      status: 'success',
      message: 'Pengguna berhasil terdaftar!', 
      userId: userRecord.user.uid,
      name,
      gender,
      birthDate,
      age
    });
  } catch (error) {
    if (error.code === 'auth/invalid-email') {
      res.status(400).json({ 
        status: 'failed',
        message: 'Harus menggunakan format email dengan benar',
        error: 'Email tidak valid'
      });
    } else if (error.code === 'auth/email-already-in-use') {
      res.status(400).json({ 
        status: 'failed',
        message: 'Login atau gunakan email yang telah ada',
        error: 'Email telah digunakan'
      });
    } else if (error.code === 'auth/weak-password') {
      res.status(400).json({ 
        status: 'failed',
        message: 'Gunakan password yang valid (minimal 6 karakter)',
        error: 'Password lemah'
      });
    } else {
      res.status(500).json({ 
        status: 'failed',
        message: 'Gagal mendaftarkan pengguna',
        error: 'Server Error'
      });
    }
  }
});

// Route to log in with email and password
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const userRecord = await signInWithEmailAndPassword(auth, email, password);
    const token = await userRecord.user.getIdToken();
    const tokenExp = userRecord.user.stsTokenManager.expirationTime;
    const expirateTime = new Date(tokenExp).toLocaleString('en-US', { timeZone: 'Asia/Bangkok' });
    res.status(200).json({
      status: 'success',
      message: 'Berhasil login',
      token,
      expirateTime,
    });
  } catch (error) {
    if (error.code === 'auth/invalid-credential' ) {
      res.status(401).json({
        status: 'failed',
        message: 'Email atau password yang dimasukkan salah',
        error: 'Invalid Credential'
      });
    } else {
      res.status(500).json({
        status: 'failed',
        message: 'Tidak dapat melakukan login, coba lagi nanti',
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
        status: 'success',
        message: 'Berhasil Logout' });
    })
    .catch((error) => {
      res.status(500).json({ 
        status: 'failed',
        message: 'Gagal Logout', 
        error: 'Server Error'
      });
    });
});

// Route to reset password
router.post('/resetpassword', (req, res) => {
  const { email } = req.body;
  sendPasswordResetEmail(auth, email)
  .then(() => {
    res.status(200).json({ 
      status: 'success',
      message: 'Email untuk melakukan reset password telah dikirim!' });
  })
  .catch((error) => {
    const errorCode = error.code;
    const errorMessage = error.message;
    res.status(500).json({
      status: 'failed',
      message: errorMessage,
      error: errorCode
    });
    // ..
  });
});

// Route to log in with Google
router.post('/google-login', async (req, res) => {
    const { idToken } = req.body;
  
    try {
      const credential = admin.auth.GoogleAuthProvider.credential(idToken);
      const userRecord = await admin.auth().signInWithCredential(credential);
  
      const token = await userRecord.getIdToken();
  
      res.status(200).json({ 
        status: 'success',
        message: 'Login Google berhasil', 
        token 
      });
    } catch (error) {
      res.status(401).json({ 
        status: 'failed',
        message: 'Login Google gagal'
      });
    }
  });

// Route to get all users
router.get('/', async (req, res) => {
    try {
      const userRecords = await admin.auth().listUsers();
      const users = userRecords.users.map(userRecord => ({
        uid: userRecord.uid,
        email: userRecord.email,
      }));
  
      res.status(200).json({ 
        status: 'success', 
        users 
      });
    } catch (error) {
      res.status(500).json({ 
        status: 'failed', 
        message: 'Terjadi kesalahan ketika mengambil data user', 
        error: "Server Error"
      });
    }
  });

module.exports = router;
