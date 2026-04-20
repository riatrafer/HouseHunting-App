import axios from "axios";

export const sendSMS = async (phone, message) => {
  console.log(`SMS to ${phone}: ${message}`);
};