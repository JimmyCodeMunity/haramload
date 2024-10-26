const mongoose = require("mongoose");
const DriverSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },

  address: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
    required: true,
  },
  carmodel: {
    type: String,
  },
  registration: {
    type: String,
  },
  // photo:{
  //     type: String,
  //     default:null
  // },
  isOnline: { type: Boolean, default: false },
  location: {
    type: { type: String, default: "Point" },
    coordinates: [Number], // [longitude, latitude]
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
  updated_at: {
    type: Date,
    default: Date.now,
  },
});
DriverSchema.index({ location: '2dsphere' });
const Driver = mongoose.model("Driver", DriverSchema);
module.exports = Driver;
