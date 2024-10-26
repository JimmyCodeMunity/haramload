const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  senderId: {
    // type: mongoose.Schema.Types.ObjectId,
    // ref: "User",
    type:String
  },
  receiverId: {
    // type: mongoose.Schema.Types.ObjectId,
    // ref: "Driver",
    type:String
  },
  message: {
    type: String,
  },
  tripId: {
    type: String,
  },
  type: {
    type: String,
  },
  timeStamp: {
    type: Date,
    default: Date.now,
  },
});

const Message = mongoose.model("Message", messageSchema);
module.exports = Message;
