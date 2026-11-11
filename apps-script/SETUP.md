# Wrong answers → Google Drive: one-time setup (about 3 minutes)

The app sends every wrong answer to a small Google Apps Script "web app" that you own.
The script writes each one as a row in a Google Sheet called **Part 2 QnA – Wrong Answers**
in your Drive. Claude can then read that Sheet and analyse your weak areas.

Use your **MOH Google account** (the one Claude's Google Drive connection uses), so Claude can read the Sheet.

## Steps

1. Go to **https://script.google.com** (signed in as your MOH account) and click **New project**.
2. Rename it (top left) to **Part 2 QnA sync**.
3. Delete everything in `Code.gs` and paste in the whole of `apps-script/Code.gs` from this folder.
   - Optional: put a secret word between the quotes in `const TOKEN = '';`
4. Click **Save** (the disk icon).
5. Click **Deploy → New deployment**. Click the gear next to "Select type", choose **Web app**.
   - Description: `Part 2 QnA`
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Click **Deploy**, then **Authorize access**. Choose your account, then **Advanced → Go to Part 2 QnA sync (unsafe) → Allow**.
   (This warning appears for every personal script that hasn't been reviewed by Google. The script only creates and writes to its own Sheet.)
7. Copy the **Web app URL** (ends in `/exec`).
8. In the app: **Settings (⚙) → Send wrong answers to Google Drive** → paste the link (and the secret word if you set one) → **Save & send test**.
9. Check your Drive: a Sheet called **Part 2 QnA – Wrong Answers** appears with a test row. Delete the test row.

Do step 8 on each device you use (laptop and phone). The link is stored only on that device. It is not in the public code.

## If "Anyone" is not offered in step 5

Your MOH Workspace may block public web apps. Then do the steps with your personal Gmail instead,
and once the Sheet exists, share it (Editor or Viewer) with your MOH email so Claude can read it.

## How it behaves

- Practice mode: sent a second or two after you submit a wrong answer.
- Exam mode: sent when you finish the session.
- Offline: answers wait on the device and are sent next time you're online. The Review page shows how many are waiting.
- Review page → **Send all wrong**: sends every question currently marked wrong (useful the first time).
- Review page → **Download (.md)**: a file of all current wrong answers, if you'd rather upload it to Drive by hand.

## Then ask Claude

"Analyse my Part 2 QnA wrong answers" – Claude reads the Sheet, groups mistakes by topic and error type,
and teaches each one in depth.

## Updating the script later

Edit the code, then **Deploy → Manage deployments → ✏ Edit → Version: New version → Deploy**.
The URL stays the same.
