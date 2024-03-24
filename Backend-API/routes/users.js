const express = require('express');
const { db } = require('../config');

const router = express.Router();
router.use(express.json());

// Route to get user data by UID
router.get('/', async (req, res) => {
  try {
    const uid = req.user.uid;

    const userSnapshot = await db.ref(`/users/${uid}`).once('value');
    const userData = userSnapshot.val();

    if (!userData) {
      return res.status(404).json({ status: 'failed', message: 'Tidak dapat menemukan pengguna' });
    }

    res.status(200).json({ status: 'success', user: userData });
  } catch (error) {
    console.error('Error fetching user data:', error.message);
    res.status(500).json({ status: 'failed', message: 'Tidak dapat mengambil data user' });
  }
});

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

// Route to update user data
router.put('/', async (req, res) => {
  try {
    const uid = req.user.uid;
    const newData = req.body;

    if (newData.birthDate && !newData.age) {
      if (!isValidDateFormat(birthDate)) {
        return res.status(400).json({
          status: 'failed',
          error: 'Format Tanggal Tidak Valid',
          message: 'Tanggal lahir harus dalam format dd-MM-yyyy'
        });
      }
      newData.age = calculateAge(newData.birthDate);
    }

    await db.ref(`/users/${uid}`).update(newData);

    res.status(200).json({ status: 'success', message: 'Update data pengguna berhasil dilakukan', data: newData });
  } catch (error) {
    console.error('Error updating user data:', error.message);
    res.status(500).json({ status: 'failed', message: 'Update data pengguna gagal' });
  }
});

module.exports = router;