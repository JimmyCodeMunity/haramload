const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const http = require("http");
const { Server } = require("socket.io");
const geolib = require("geolib");
const Stripe = require("stripe");
const STRIPE_SECRET_KEY =
  "sk_test_51Oc4wRJE5eZbfcv0cFDOguSg9YFS8Bswru6JaXimoGk6NbBuBy2fUi8CKTjsaHPV7dlS1cTXJrd2mmPfrJg8WjEo00fuiP5l84";

  const stripe = Stripe(STRIPE_SECRET_KEY);

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.json());
const GOOGLE_MAPS_API_KEY = "AIzaSyDdUQ1EIQJB46n2RSusQro1qP3Pd4mGZcA";

if (process.env.NODE_ENV !== "PRODUCTION") {
  require("dotenv").config({
    path: "./.env",
  });
}

const server = http.createServer(app);

// const io = new Server(server, {
//   cors: {
//     origin: [
//       "http://localhost:3000",
//       "http://192.168.1.130:8000",
//       "http://localhost:3001",
//       "https://cbfe-41-139-202-31.ngrok-free.app",
//       "exp://192.168.1.130:8081"
//     ], // Add multiple origins here
//     methods: ["GET", "POST"],
//   },
// });

const io = new Server(server, {
  cors: {
    // origin: ["http://localhost:3000", "http://localhost:3001","https://cbfe-41-139-202-31.ngrok-free.app"], // Add multiple origins here
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// environment variable
const port = 8000;
// const port = process.env.PORT || 8000;
const dbconn = process.env.DB_URL;

server.listen(port, (req, res) => {
  console.log(`Server is running on port ${port}`);
});


// Create a payment route
app.post('/create-payment-intent', async (req, res) => {
  try {
    const { amount, currency } = req.body;
    console.log("amount",amount)
    console.log("currency",currency)

    // Create a customer
    const customer = await stripe.customers.create();

    // Create an ephemeral key for the customer
    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customer.id },
      { apiVersion: '2022-11-15' }
    );

    // Create a PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount, // Amount in smallest unit, for example 5000 means $50.00
      currency: currency || 'usd',
      customer: customer.id,
      automatic_payment_methods: { enabled: true }, // Enable automatic payment methods
    });

    res.send({
      paymentIntent: paymentIntent.client_secret,
      ephemeralKey: ephemeralKey.secret,
      customer: customer.id,
    });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
});

//connect to db
mongoose
  .connect(dbconn, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log("Connected to db");
  })
  .catch((error) => {
    console.error("Error connecting to db", error);
  });

app.get("/", (req, res) => {
  res.send("Api is running dawg");
});

// Track drivers' sockets
const drivers = new Map(); // This will hold the driverId and their corresponding socket ID
const users = new Map(); // This will hold the driverId and their corresponding socket ID
const userSocketMap = {};
// const driverSocketMap = {}
// Track driver's location
io.on("connection", (socket) => {
  console.log("user connected successfully", socket.id);
  const userId = socket.handshake.query.userId;
  console.log("userid", userId);

  if (userId !== "undefined") {
    userSocketMap[userId] = socket.id;
  }
  console.log("user socket map", userSocketMap);
  socket.on("disconnect", () => {
    console.log("user disconnected", socket.id);
    delete userSocketMap[userId];
    console.log("user socket map after disconnect", userSocketMap);
  });

  // driver onlinemode
  socket.on("driver-go-online", async ({ driverId, location }) => {
    // console.log("long", location.longitude);
    // console.log("lat", location.latitude);

    // return;
    if (location) {
      console.log("driverid", driverId);
      console.log("location", location);
      console.log("request", "go online req");
      const driver = await Driver.findByIdAndUpdate(
        driverId,
        {
          isOnline: true,
          location: {
            type: "Point",
            coordinates: [location.longitude, location.latitude],
          },
        },
        { new: true }
      );
      console.log(driver);
      drivers.set(driverId, socket.id);

      io.emit("driver-online", driver);
    }
  });

  socket.on("disconnect", () => {
    console.log(`user ${socket.id} disconnected`);

    // Remove driver from the map when they disconnect
    for (let [driverId, socketId] of drivers.entries()) {
      if (socketId === socket.id) {
        drivers.delete(driverId);
        break;
      }
    }
  });


  // listen to paid trips
  
  socket.on("trip-paid", async ({ tripId }) => {

    const trip = await Trip.findById(tripId);
    if (trip) {
      trip.status = "completed";
      // console.log("trip acceted is",trip)
      // return
      await trip.save();
      

      // Notify the user that the trip has been accepted
      const userpaid = trip?.driverId.toString();
      const userSocketId = userSocketMap[userpaid];
      if (userSocketId) {
        // users.set(userSocketId, socket.id);
        console.log("completed trip", trip);
        io.to(userSocketId).emit("trip-paid-successfully", trip);
      } else {
        console.log("error setting order id");
      }
    } else {
      console.error("Trip not found!");
    }
  });
  socket.on("trip-payment-cancelled",async(tripId)=>{
    console.log("payment cancelled with id",tripId)

  })


  // send messages
  socket.on("sendMessage",({senderId,receiverId,message,tripId,type})=>{
    const receiverSocketId = userSocketMap[receiverId];
    console.log("receiver", receiverSocketId);
    console.log("type", type);
    console.log("message", message);
    console.log("trip id", tripId);
    // const sendingfrom = senderId;
    
    if(receiverSocketId){
      // console.log("message received by",receiverId)
      // sendMessage(userid,senderId, receiverId, message,receiverSocketId)
      // io.to(receiverSocketId).emit("newMessage", {senderId:sendingfrom, receiverId, message});
      sendMessage(io, receiverSocketId, senderId, receiverId, message,tripId,type);
    }
  })

  // driver offline mode
  socket.on("driver-go-offline", async ({ driverId, location }) => {
    console.log("driverid", driverId);
    console.log("curretlocation", location);
    console.log("request", "go offline req");

    // return;
    if (location) {
      const driver = await Driver.findByIdAndUpdate(
        driverId,
        {
          isOnline: false,
          location: {
            type: "Point",
            coordinates: [location.longitude, location.latitude],
          },
        },
        { new: true }
      );
      console.log(driver);

      io.emit("driver-offline", driver);
    }
  });

 

  socket.on("driver-location-update", async (data) => {
    const { driverId, location } = data;
    if (location && location.latitude && location.longitude) {
      // console.log(`Driver ${driverId} moved to:`, location);
      // Update location in database or broadcast to nearby users
      const driver = await Driver.findByIdAndUpdate(
        driverId,
        {
          location: {
            type: "Point",
            coordinates: [location.longitude, location.latitude],
          },
        },
        { new: true }
      );
      // console.log("driver w new locaion",driver)

      io.emit("driver-location-changed", driver);
    } else {
      console.error(`Invalid location data from driver ${driverId}`);
    }
  });



  // Handle driver accepting or rejecting trip
  socket.on("driver-accept-trip", async (tripId) => {
    const trip = await Trip.findByIdAndUpdate(
      tripId,
      { status: "accepted" },
      { new: true }
    );
    io.emit("trip-status-update", trip);
  });

  socket.on("accept-trip", async ({ tripId }) => {
    console.log("Driver accepted trip:", tripId);

    const trip = await Trip.findById(tripId);
    if (trip) {
      trip.status = "accepted";
      await trip.save();
      console.log("accepted trip", trip);

      // Notify the user that the trip has been accepted
      const userSocketId = users.get(trip.userId.toString());
      users.set(userSocketId, socket.id);
      console.log("user order", userSocketId);
      if (userSocketId) {
        io.to(userSocketId).emit("trip-acceptedbydriver", trip);
      }

      console.log(
        `Driver accepted the trip and user ${trip.userId} has been notified.`
      );
    } else {
      console.error("Trip not found!");
    }
  });

  socket.on("start-trip", async ({ tripId }) => {
    console.log("Driver Started trip:", tripId);

    const trip = await Trip.findById(tripId);
    if (trip) {
      trip.status = "started";
      // console.log("trip acceted is",trip)
      // return
      // await trip.save();
      console.log("started trip", trip);
      console.log("started user", trip.userId.toString());

      // Notify the user that the trip has been accepted
      const userSocketId = users.get(trip.userId.toString());
      users.set(userSocketId, socket.id);
      console.log("user socket", userSocketId);
      if (userSocketId) {
        // users.set(userSocketId, socket.id);
        console.log("user order", userSocketId);
        io.to(userSocketId).emit("started", trip);
      } else {
        console.log("error setting order id");
      }

      // if (userSocketId) {
      //   io.to(userSocketId).emit("trip-acceptedbydriver", trip);
      // }

      console.log(
        `Driver started the trip and user ${trip.userId} has been notified.`
      );
    } else {
      console.error("Trip not found!");
    }
  });


  socket.on("driver-accepted", async ({ tripId }) => {
    console.log("Driver Accepted trip:", tripId);

    const trip = await Trip.findById(tripId);
    if (trip) {
      trip.status = "drivingtodestination";
      // console.log("trip acceted is",trip)
      // return
      await trip.save();
      console.log("started trip", trip);
      console.log("started user", trip.userId.toString());

      // Notify the user that the trip has been accepted
      const tripuser = trip.userId.toString();
      const userSocketId = userSocketMap[tripuser]
      // console.log("user socket", userSocketId);
      if (userSocketId) {
        // users.set(userSocketId, socket.id);
        console.log("user order", userSocketId);
        io.to(userSocketId).emit("driving-to-destination", trip);
      } else {
        console.log("error setting order id");
      }

      // if (userSocketId) {
      //   io.to(userSocketId).emit("trip-acceptedbydriver", trip);
      // }

      console.log(
        `Driver started the trip and user ${trip.userId} has been notified.`
      );
    } else {
      console.error("Trip not found!");
    }
  });
  socket.on("driver-declined", async ({ tripId }) => {
    console.log("Driver declined trip:", tripId);

    const trip = await Trip.findById(tripId);
    if (trip) {
      trip.status = "declined";
      // console.log("trip acceted is",trip)
      // return
      // await trip.save();
      console.log("started trip", trip);
      console.log("started user", trip.userId.toString());

      // Notify the user that the trip has been accepted
      const tripuser = trip.userId.toString();
      const userSocketId = userSocketMap[tripuser]
      // console.log("user socket", userSocketId);
      if (userSocketId) {
        // users.set(userSocketId, socket.id);
        console.log("user order", userSocketId);
        io.to(userSocketId).emit("driver-declined-trip", trip);
      } else {
        console.log("error setting order id");
      }

      // if (userSocketId) {
      //   io.to(userSocketId).emit("trip-acceptedbydriver", trip);
      // }

      console.log(
        `Driver started the trip and user ${trip.userId} has been notified.`
      );
    } else {
      console.error("Trip not found!");
    }
  });



  // detect when ride is cancelled
  socket.on("user-cancel-ride", async ({ tripId }) => {
    console.log("Ride cancelled:", tripId);

    const trip = await Trip.findById(tripId);
    if (trip) {
      trip.status = "cancelled";
      await trip.save();

      // Notify the user that the trip has been cancelled
      // const userSocketId = users.get(trip.userId.toString());
      // if (userSocketId) {
      //   io.to(userSocketId).emit("trip-cancelled", trip);
      // }

      // Clear the driver’s socket to prevent further requests
      const drivercancelled = trip.driverId.toString();
      const driverSocketId = userSocketMap[drivercancelled];
      if (driverSocketId) {
        // userSocketMap[driverCancelled] = undefined;
        // emit to driver
        io.to(driverSocketId).emit("user-cancelled-ride", trip);
        console.log(`Driver ${trip.driverId} removed from userSocketMap.`);
      }
      console.log("cancelled driver", drivercancelled);
      
      }
    }
  )

  // socket.on("reject-trip", async ({ tripId }) => {
  //   console.log("Driver rejected trip:", tripId);

  //   const trip = await Trip.findById(tripId);
  //   if (trip) {
  //     trip.status = "rejected";
  //     await trip.save();

  //     // Notify the user that the trip has been rejected
  //     const userSocketId = users.get(trip.userId.toString());
  //     if (userSocketId) {
  //       io.to(userSocketId).emit("trip-rejected", trip);
  //     }

  //     // Clear the driver’s socket to prevent further requests
  //     const driverSocketId = drivers.get(trip.driverId.toString());
  //     if (driverSocketId) {
  //       drivers.delete(trip.driverId.toString()); // Remove the driver from the active list
  //       console.log(`Driver ${trip.driverId} removed from active sockets.`);
  //     }

  //     console.log(
  //       `Driver rejected the trip and user ${trip.userId} has been notified.`
  //     );
  //   } else {
  //     console.error("Trip not found!");
  //   }
  // });


  // socket.on("request-payment",async(trip)=>{
  //   console.log("driver requesting payment fro trip",trip)
  // })

  socket.on("request-payment", async ({ trip }) => {
    console.log("driver requesting payment fro trip:", trip.userId);

    const mytrip = await Trip.findById(trip?._id);
    if (mytrip) {
      mytrip.status = "awaitingpayment";
      // await mytrip.save();

      // Notify the user that the trip has been rejected
      const usertopay = mytrip?.userId.toString();
      console.log("usertopay", usertopay);
      const userSocketId = userSocketMap[usertopay];
      console.log("request payment from",userSocketId)
      if (userSocketId) {
        io.to(userSocketId).emit("please-pay", trip);
      }

      // console.log(
      //   `Driver requested the trip and user ${trip.userId} has been notified.`
      // );
    } else {
      console.error("Trip not found!");
    }
  });
  socket.on("reject-trip", async ({ tripId }) => {
    console.log("Driver rejected trip:", tripId);

    const trip = await Trip.findById(tripId);
    if (trip) {
      trip.status = "rejected";
      await trip.save();

      // Notify the user that the trip has been rejected
      const userSocketId = users.get(trip.userId.toString());
      if (userSocketId) {
        io.to(userSocketId).emit("trip-rejected", trip);
      }

      console.log(
        `Driver rejected the trip and user ${trip.userId} has been notified.`
      );
    } else {
      console.error("Trip not found!");
    }
  });

  const rejectedDriversMap = new Map(); // Keep track of drivers who rejected each trip


  

  socket.on("trip-has-started", async ({ trip, userId, receiverId }) => {
    console.log("trip", trip);
    console.log("driver Id", userId);
    console.log("client Id", receiverId);

    const receiverSocketId = userSocketMap[receiverId];
    if (receiverSocketId) {
      console.log("Receiver socket id:", receiverSocketId);
      // Send the trip to the specific client
      io.to(receiverSocketId).emit("trip-has-started", trip);

      // Confirm on the driver's side
      // socket.emit("trip-has-started", trip);
    } else {
      console.log("Receiver socket id not found!");
    }
  });

  socket.on("driver-is-waiting", async ({ trip, userId, receiverId }) => {
    console.log("driver is waiting");
    // console.log("driver Id", userId);
    // console.log("client Id", receiverId);

    const receiverSocketId = userSocketMap[receiverId];
    if (receiverSocketId) {
      console.log("Receiver socket id:", receiverSocketId);
      // Send the trip to the specific client
      io.to(receiverSocketId).emit("driver-is-waiting", trip);

      // Confirm on the driver's side
      // socket.emit("trip-has-started", trip);
    } else {
      console.log("Receiver socket id not found!");
    }
  });

  socket.on(
    "find-driver",
    async ({ userId, startLocation, destinationLocation, from, to }) => {
      // users.set(userId, socket.id);
      // console.log("request from",userId)
      // console.log("starting",startLocation)
      // console.log("ending",destinationLocation)

      const receiverSocketId = userSocketMap[userId];
      // console.log(`User ${userId} has been assigned socket ID: ${socket.id}`);

      // Store rejected drivers in a Set, initially empty
      const rejectedDrivers = {};
      // return

      console.log("userid" + userId);
      console.log("startLocationlat" + startLocation.latitude);
      console.log("startLocationlong" + startLocation.longitude);
      console.log("destinationLocation" + destinationLocation.latitude);

      const onlineDrivers = await Driver.find({ isOnline: true });
      console.log("found driver", onlineDrivers);

      // Fetch distance and time from Google Maps API
      try {
        const response = await axios.get(
          `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${startLocation.latitude},${startLocation.longitude}&destinations=${destinationLocation.latitude},${destinationLocation.longitude}&key=${GOOGLE_MAPS_API_KEY}`
        );

        if (
          response.data.rows &&
          response.data.rows[0] &&
          response.data.rows[0].elements &&
          response.data.rows[0].elements[0]
        ) {
          const distanceInMeters =
            response.data.rows[0].elements[0].distance.value;
          const timeInMinutes =
            response.data.rows[0].elements[0].duration.value / 60;
          const tripPrice = calculatePrice(distanceInMeters);

          // Proceed to find the closest driver and handle rejection
          await assignDriverToTrip({
            userId,
            startLocation,
            destinationLocation,
            distanceInMeters,
            timeInMinutes,
            tripPrice,
            rejectedDrivers,
            from,
            to,
          });
        } else {
          console.error(
            "Invalid response structure from Google API",
            response.data
          );
          socket.emit("error", {
            message: "Unable to calculate distance/time.",
          });
        }
      } catch (error) {
        console.error("Error calling Google Maps API:", error);
        socket.emit("error", {
          message: "Failed to get distance and time from Google Maps API.",
        });
      }
    }
  );

  async function assignDriverToTrip({
    userId,
    startLocation,
    destinationLocation,
    distanceInMeters,
    timeInMinutes,
    tripPrice,
    rejectedDrivers,
    from,
    to,
  }) {
    // Find online drivers that haven't rejected the trip
    const onlineDrivers = await Driver.find({
      isOnline: true,
      _id: { $nin: Array.from(rejectedDrivers) }, // Exclude drivers who have rejected
    });

    if (onlineDrivers.length > 0) {
      const validDrivers = onlineDrivers.filter(
        (driver) =>
          driver.location &&
          driver.location.coordinates &&
          driver.location.coordinates.length === 2
      );

      if (validDrivers.length === 0) {
        console.error("No drivers with valid locations.");
        return;
      }

      const closestDriver = validDrivers.reduce((prev, current) => {
        const prevDistance = geolib.getDistance(
          {
            latitude: startLocation.latitude,
            longitude: startLocation.longitude,
          },
          {
            latitude: prev.location.coordinates[1],
            longitude: prev.location.coordinates[0],
          }
        );
        const currentDistance = geolib.getDistance(
          {
            latitude: startLocation.latitude,
            longitude: startLocation.longitude,
          },
          {
            latitude: current.location.coordinates[1],
            longitude: current.location.coordinates[0],
          }
        );
        return currentDistance < prevDistance ? current : prev;
      });

      if (closestDriver) {
        console.log(`Assigning driver ${closestDriver._id} to trip`);

        const trip = new Trip({
          userId,
          driverId: closestDriver._id,
          startLocation: {
            coordinates: [startLocation.latitude, startLocation.longitude],
          },
          destinationLocation: {
            coordinates: [
              destinationLocation.latitude,
              destinationLocation.longitude,
            ],
          },
          // distance: parseInt(distanceInMeters/1000).toFixed(1),
          distance: Number((distanceInMeters / 1000).toFixed(1)),
          timeEstimate: timeInMinutes,
          price: parseInt(tripPrice),
          from: from,
          to: to,
        });

        await trip.save();

        // const driverSocket = drivers.get(closestDriver._id.toString());
        const driverSocket = closestDriver._id;
        console.log("driverSocket: " + driverSocket);
        const receiverSocketId = userSocketMap[driverSocket];
        console.log("rec socket", receiverSocketId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("trip-request", trip);
          socket.emit("trip-accepted", trip);
        } else {
          console.error(`Driver ${closestDriver._id} is offline`);
        }
      }
    } else {
      console.log("No available drivers for the trip.");
      const userSocketId = users.get(userId.toString());
      if (userSocketId) {
        io.to(userSocketId).emit("no-drivers-available", { userId });
      }
    }
  }

  socket.on("driving-t0-destination",async()=>{

  })

  socket.on("driver-reject-trip", async (tripId) => {
    const trip = await Trip.findByIdAndUpdate(
      tripId,
      { status: "rejected" },
      { new: true }
    );
    io.emit("trip-status-update", trip);
  });
});

// Function to calculate price
function calculatePrice(distance) {
  const baseFare = 250; // Base fare price
  const perKmRate = 20; // Price per km
  const fare = baseFare + (distance / 1000) * perKmRate;
  console.log("fare", fare);
  return fare;
}

//routes
const userroutes = require("./routes/UserRoutes");
const driverroutes = require("./routes/DriverRoutes");
const Trip = require("./model/TripModel");
const Driver = require("./model/DriverModel");
const { default: axios } = require("axios");
const { sendMessage } = require("./controllers/UserController");

//api routes
app.use("/api/v1/user/", userroutes);
app.use("/api/v1/driver", driverroutes);
