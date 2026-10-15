import mongoose, { Schema } from "mongoose";

const eventSchema = new Schema(
  {
    owner: { type: String, required: true, index: true },
    title: { type: String, required: true, maxlength: 120 },
    date: { type: String, required: true },
    start: { type: String, required: true },
    end: { type: String, required: true },
    location: { type: String, default: "", maxlength: 200 },
    description: { type: String, default: "", maxlength: 2000 },
    category: {
      type: String,
      enum: ["personal", "trabajo", "bienestar", "social"],
      required: true,
    },
  },
  { timestamps: true }
);
eventSchema.index({ owner: 1, date: 1 });
export default mongoose.models.CalendarEvent ||
  mongoose.model("CalendarEvent", eventSchema);
