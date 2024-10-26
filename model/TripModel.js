// // models/Trip.js
// const mongoose = require('mongoose');

// const tripSchema = new mongoose.Schema({
//   userId: String,
//   driverId: String,
//   startLocation: { coordinates: [Number] },
//   destinationLocation: { coordinates: [Number] },
//   distance: String, // in meters
//   price: Number, // price in your preferred currency
//   status: { type: String, default: 'pending' }, // 'pending', 'accepted', 'completed'
//   timeEstimate: Number, // time in minutes
// });

// const Trip = mongoose.model('Trip', tripSchema);
// module.exports = Trip;


const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const TripSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  driverId: {
    type: Schema.Types.ObjectId,
    ref: 'Driver',
    required: true,
  },
  from:{
    type: String,
  },
  to:{
    type: String,
  },
  startLocation: {
    type: {
      type: String,
      enum: ['Point'], // GeoJSON Point type
      default: 'Point',
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
    },
  },
  destinationLocation: {
    type: {
      type: String,
      enum: ['Point'], // GeoJSON Point type
      default: 'Point',
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
    },
  },
  distance: {
    type: Number, // Distance in meters
    required: true,
  },
  timeEstimate: {
    type: Number, // Estimated time in minutes
    required: true,
  },
  price: {
    type: Number, // Price of the trip
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'completed', 'cancelled','declined','drivingtodestination','awaitingpayment'],
    default: 'pending',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Trip', TripSchema);

