const mongoose = require("mongoose");

const SubmissionSchema = new mongoose.Schema(
  {
    studentId: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    candidateName: {
      type: String,
      required: true,
      trim: true,
    },
    firstName: { type: String, trim: true },
    middleName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    dob: { type: String },
    gender: { type: String },
    state: { type: String },
    district: { type: String },
    city: { type: String },
    // Base64 encoded photo — stored directly in MongoDB
    snapshot: {
      type: String,
      default: "",
    },
    duration: { type: String, default: "00:00" },
    tabSwitches: { type: Number, default: 0 },
    integrityStatus: {
      type: String,
      enum: ["clean", "warning", "flagged"],
      default: "clean",
    },
  },
  { timestamps: true }
);

// Auto-set integrity status based on tabSwitches
SubmissionSchema.pre("save", function (next) {
  if (this.tabSwitches === 0) this.integrityStatus = "clean";
  else if (this.tabSwitches <= 2) this.integrityStatus = "warning";
  else this.integrityStatus = "flagged";
  next();
});

module.exports = mongoose.model("Submission", SubmissionSchema);
