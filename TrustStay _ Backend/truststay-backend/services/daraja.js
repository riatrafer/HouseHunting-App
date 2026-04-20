import axios from "axios";

const getAccessToken = async () => {
  const auth = Buffer.from(
    process.env.CONSUMER_KEY + ":" + process.env.CONSUMER_SECRET
  ).toString("base64");

  const res = await axios.get(
    "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
    {
      headers: {
        Authorization: `Basic ${auth}`,
      },
    }
  );

  return res.data.access_token;
};
const formatPhone = (phone) => {
  return phone.replace(/^0/, "254").replace(/^\+/, "");
};
const formattedPhone = formatPhone(phone);

export const stkPush = async (phone, amount) => {
  const token = await getAccessToken();

  const timestamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);

  const password = Buffer.from(
    process.env.SHORTCODE +
      process.env.PASSKEY +
      timestamp
  ).toString("base64");

  return axios.post(
    "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
    {
      BusinessShortCode: process.env.SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: amount,
      PartyA: formattedPhone,
      PartyB: process.env.SHORTCODE,
      PhoneNumber: formattedPhone,
      CallBackURL: process.env.CALLBACK_URL,
      AccountReference: "Rent",
      TransactionDesc: "Rent Payment",
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
};