# OTP + Email delivery notes

OTP requests are generated and stored in Firestore (`otpRequests`) and delivered by email using `services/email.js`.

## Email delivery modes

Set these in `.env`:

- `EMAIL_MODE=auto`: use SMTP when `SMTP_*` is present, otherwise fallback to mock console logs
- `EMAIL_MODE=smtp`: require SMTP configuration and send real email
- `EMAIL_MODE=mock`: always log mock emails and skip external delivery

Required SMTP variables for real email:

- `SMTP_HOST`
- `SMTP_PORT` (usually `587` or `465`)
- `SMTP_USER`
- `SMTP_PASS`
- `EMAIL_FROM` (optional, defaults to `SMTP_USER`)

## Endpoints that send OTP by email

- Landlord register OTP: `POST /api/landlord/register/request-otp`
- Landlord login OTP: `POST /api/auth/landlord/request-otp`

If SMTP is configured correctly, these routes send real OTP messages to the recipient email.

