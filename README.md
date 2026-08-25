# Sirr

Anonymous messaging for students and teachers.

## Local setup

1. Copy `.env.example` to `.env`.
2. Set `MONGODB_URI`, `SESSION_SECRET`, `TEACHER_ACCESS_CODE`, and the Twilio values.
3. Run `npm run start`.
4. Open `http://localhost:3000`.

The server waits for MongoDB before listening. Registration sends the six-digit code through Twilio and creates the account only after verification. OTP records expire after ten minutes.

## Deploy with Render and MongoDB Atlas

1. Create a MongoDB Atlas cluster and database user. Add `0.0.0.0/0` to Atlas Network Access for Render, or use Atlas's restricted Render integration where available.
2. Push this repository to GitHub.
3. In Render, choose **New > Blueprint** and select the repository. Render will read `render.yaml` and build the Docker service.
4. Add these secret environment variables in Render: `MONGODB_URI`, `TEACHER_ACCESS_CODE`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_FROM_NUMBER`.
5. Deploy and open the generated HTTPS URL.

Never commit `.env`, MongoDB credentials, or Twilio credentials. `SESSION_SECRET` must be long and random in production.
