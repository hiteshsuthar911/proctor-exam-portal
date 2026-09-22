const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const StudentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Student name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    studentId: {
      type: String,
      required: [true, "Student ID is required"],
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: [20, "Student ID cannot exceed 20 characters"],
    },
    pin: {
      type: String,
      required: [true, "PIN is required"],
      minlength: 4,
    },
    exam: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: ["pending", "active", "submitted", "finished"],
      default: "pending",
    },
  },
  { timestamps: true }
);

// Hash PIN before saving
StudentSchema.pre("save", async function (next) {
  if (!this.isModified("pin")) return next();
  const salt = await bcrypt.genSalt(10);
  this.pin = await bcrypt.hash(this.pin, salt);
  next();
});

// Compare PIN
StudentSchema.methods.comparePin = async function (candidatePin) {
  return bcrypt.compare(candidatePin, this.pin);
};

// Never return the pin field in JSON responses
StudentSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.pin;
  return obj;
};

module.exports = mongoose.model("Student", StudentSchema);
