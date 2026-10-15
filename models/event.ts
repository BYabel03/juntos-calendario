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
      match: /^[a-z0-9][a-z0-9-]{0,63}$/,
      required: true,
    },
    color: { type: String, default: "", validate: (value: string) => value === "" || /^#[0-9a-fA-F]{6}$/.test(value) },
  },
  { timestamps: true }
);
eventSchema.index({ owner: 1, date: 1 });
export default mongoose.models.CalendarEvent ||
  mongoose.model("CalendarEvent", eventSchema);
