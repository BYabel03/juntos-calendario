import mongoose, { Schema } from "mongoose";

const calendarSchema = new Schema({
  owner: { type: String, required: true },
  calendarId: { type: String, required: true, match: /^[a-z0-9][a-z0-9-]{0,63}$/ },
  label: { type: String, required: true, maxlength: 60 },
  color: { type: String, required: true, match: /^#[0-9a-fA-F]{6}$/ },
});
calendarSchema.index({ owner: 1, calendarId: 1 }, { unique: true });
export default mongoose.models.UserCalendar || mongoose.model("UserCalendar", calendarSchema);
