const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Driver = require("../model/DriverModel");
const Message = require("../model/MessageModel");

// if (process.env.NODE_ENV !== "PRODUCTION") {
//     require("dotenv").config({
//       path: "../.env",
//     });
//   }

const jwttoken = process.env.JWT_SECRET;

//register new user
const createDriver = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      address,
      phone,
      carmodel,
      registration,
      photo,
    } = req.body;
    const existingUser = await Driver.findOne({ email });
    if (existingUser) {
      res.status(400).json({ message: "User already exists" });
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await Driver.create({
        name,
        email,
        address,
        password: hashedPassword,
        phone,
        carmodel,
        registration,
        photo,
      });
      res
        .status(200)
        .json({ message: "user account created successfully", user });
    }
  } catch (error) {
    console.log("error creating new user:", error);
    res.status(500).json({ message: error.message });
    return;
  }
};


const getMessages = async (req, res) => {
  try {
    const { senderId, receiverId } = req.query;
    const messages = await Message.find({
      $or: [
        { senderId:senderId,receiverId:receiverId },
        { senderId: receiverId, receiverId: senderId },
      ],
    }).populate("senderId", "_id name");
    res.status(200).json(messages);
  } catch (error) {
    console.log("error getting messages:", error);
    res.status(500).json({ message: error.message });
    return;
  }
};

// login user
const driverLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log(email, password);
    const user = await Driver.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    } else {
      const token = jwt.sign({ email: user.email }, jwttoken);
      if (res.status(200)) {
        console.log("login successfull");
        return res.send({ status: "ok", data: token });
      } else {
        return res.send({ error: "error" });
      }
    }
  } catch (error) {
    console.log("error", error);
  }
};

// get userdata
const getDriverData = async (req, res) => {
  const { token } = req.body;
  try {
    if(token){
      const user = await jwt.verify(token, jwttoken);
    const useremail = user.email;
    const userdata = await Driver.findOne({ email: useremail });
    if (!userdata) {
      return res.status(400).json({ message: "User not found" });
    }
    // console.log("USER COLLECTED",userdata);
    res
      .status(200)
      .json({ message: "User data fetched successfully", userdata });
    }
  } catch (error) {
    console.log("error getting user data:", error);
    res.status(500).json({ message: error.message });
    return;
  }
};

const getOnlineDrivers = async (req,res) => {
  try {
    const onlineDrivers = await Driver.find({ isOnline: true });
    return res.status(200).json(onlineDrivers);
  } catch (error) {
    console.error("Error fetching online drivers", error);
    return res.status(500).json({ error: "Failed to fetch online drivers." });
  }
};

// update user online status by id
const updateDriverStatus = async (req, res) => {
  const { id, isOnline } = req.body;
  console.log("request",id, isOnline)
  try {
    const driver = await Driver.findByIdAndUpdate(id, { isOnline: isOnline }, { new: true });
    if (!driver) {
      return res.status(404).json({ message: "Driver not found" });
    }
    console.log("updated driver",driver)
    res.status(200).json({ message: "Driver status updated successfully", driver });
  } catch (error) {
    console.error("Error updating driver status", error);
    res.status(500).json({ error: "Failed to update driver status." });
  }
};


// get driver data by id
const getDriverById = async (req, res) => {
  const { id } = req.params;
  try {
    const driver = await Driver.findById(id);
    if (!driver) {
      return res.status(404).json({ message: "Driver not found" });
    }
    res.status(200).json({ message: "Driver data fetched successfully", driver });
  } catch (error) {
    console.error("Error getting driver data", error);
    res.status(500).json({ error: "Failed to get driver data." });
  }
};

module.exports = {
  createDriver,
  driverLogin,
  getDriverData,
  getOnlineDrivers,
  updateDriverStatus,
  getDriverById,
  getMessages
};
