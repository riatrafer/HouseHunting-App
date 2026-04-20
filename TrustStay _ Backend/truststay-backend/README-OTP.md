# OTP notes (Kenya dev/testing)

This project currently uses **simulated OTP** for development:

- Landlord register: `POST /api/landlord/register/request-otp` returns `simulatedOtp`
- Landlord login: `POST /api/auth/landlord/request-otp` returns `simulatedOtp`

## Why simulated?

Safaricom's Daraja is for **M-Pesa APIs**, not a free OTP/SMS testing service. For real OTP via SMS you typically use an SMS provider.

## Options for real OTP (SMS)

- **Africa’s Talking**: widely used in Kenya, has sandbox/dev workflows for SMS.
- **Twilio**: global, works in Kenya; trial accounts can be used for testing.
- **Safaricom SMS (bulk/A2P)**: usually commercial and requires onboarding; not a "free OTP testing" flow like Daraja sandbox.

## Implementation approach

The backend already persists OTP requests in Firestore (`otpRequests` collection) with TTL checks. To upgrade to real SMS:

- Keep generating/storing the OTP server-side.
- Send the OTP to the phone using the provider SDK/API.
- Remove `simulatedOtp` from responses once delivery is verified.

