# VoiceLab (IndicF5 on Kaggle)

## One-time setup
1. Install Python 3.11+, Node 18+, and ffmpeg.
2. Kaggle: verify your phone, create an API token (Settings → API), and in a notebook's Add-ons → Secrets add `HF_TOKEN`
   (your Hugging Face token; accept the IndicF5 model terms on its page first).
3. MongoDB Atlas: create a free cluster and a database user limited to one database; copy the connection string.
4. Copy `.env.example` to `.env` and fill it in. Never commit or zip `.env`.

## Run
    cd backend && pip install -r requirements.txt && python app.py
    cd frontend && npm install && npm run dev      # open the printed localhost address

Kaggle's CLI reads `KAGGLE_USERNAME` and `KAGGLE_KEY` from the environment (loaded from `.env`).

## Notes
- The first run may fail if the `HF_TOKEN` secret is not attached to the notebook "voicelab tts" on Kaggle.
  Open it once on Kaggle → Add-ons → Secrets → attach `HF_TOKEN`, then try again.
- Only one clip can be generated at a time. Voice samples are trimmed to 10 seconds.

## Accounts, login and one-command start
- Visitors see a landing page. Users sign up and log in; each user only sees their own voices and clips.
- Usernames, emails and **hashed** passwords are stored in the `users` collection in MongoDB. Passwords are never stored in plain text.
- Add these to `.env` (see `.env.example`): `SECRET_KEY` (a long random string), `APP_URL`, and optionally `SMTP_*` for password-reset emails.
  With no `SMTP_HOST`, the reset link is printed in the backend terminal.
- Voices added before login existed have no owner and will not appear. Add them again.
- Start both servers with one command from the project folder (`python` must be your Python 3.11+; use `python3` in `package.json` on Mac/Linux):
  ```
  npm run setup    # first time only
  npm run dev
  ```
  Then open http://localhost:5173. Ctrl+C stops both.
