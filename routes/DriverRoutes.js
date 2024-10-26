const { urlencoded } = require("body-parser");
const express = require("express");
const { createDriver, driverLogin, getDriverData, getOnlineDrivers, updateDriverStatus, getDriverById, getMessages } = require("../controllers/DriverController");
const { getUserById } = require("../controllers/UserController");
const router = express.Router();

router.use(express.urlencoded({ extended: true }));
router.use(express.json());

router.post('/createdriver',createDriver)
router.post('/driverlogin',driverLogin)
router.post('/getdriverdata',getDriverData)
router.get('/getonlinedrivers',getOnlineDrivers)
router.put('/updatedriveronlinestatus/:id',updateDriverStatus)
router.get('/driverinfo/:id',getDriverById)
router.get('/userinfo/:id',getUserById)
router.get('/getmessages',getMessages)

module.exports = router;
