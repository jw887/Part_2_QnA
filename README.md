# Part 2 QnA

A Pastest-style MCQ question bank built from my daily Master of Surgery study topics.
One chapter per daily topic (001, 002, …), each with ~15 high-yield single-best-answer questions,
explanations and source references.

## Use it

Open `index.html` in any browser (double-click works – no server needed).

- **Dashboard** – overall progress, score, progress per chapter, quick start buttons
- **Chapters** – start a chapter in Practice (instant answer + explanation) or Exam mode (timed, answers at the end)
- **Create session** – pick chapters, filter (all / unanswered / incorrect / flagged), number of questions, mode
- **Review** – everything you got wrong, flagged, or wrote notes on
- In a question: `A`–`E` choose · `Enter` submit/next · `←` `→` move · `F` flag · `✕` strikes out an option

Progress is saved in the browser (localStorage), separately on each device.
To move progress between laptop and phone: **Settings → Export progress**, then **Import** on the other device.

## Add a new daily topic

1. Copy `data/ch014.json` to `data/ch015.json` and fill it in:
   ```json
   {
     "no": 15,
     "title": "Undescended testis",
     "section": "11 Paediatric Surgery",
     "delivered": "2026-11-11",
     "questions": [
       {
         "stem": "Question text…",
         "options": ["A", "B", "C", "D", "E"],
         "answer": 2,
         "explanation": "Why C is right…",
         "ref": "Guideline / trial"
       }
     ]
   }
   ```
   `answer` is the 0-based index of the correct option in the list as written (0 = first).
2. Run `python3 build.py` – this rebuilds `questions.js` (and shuffles option order so the
   correct answer isn't always in the same slot).
3. Refresh the page. Add new questions to the **end** of a chapter so saved progress stays matched.

## Put it on GitHub Pages (use it on your phone)

1. Create a new repository on GitHub, e.g. `part2-qna` (it can be private if you have GitHub Pro; otherwise public).
2. Upload everything in this folder (`index.html`, `app.js`, `styles.css`, `questions.js`, `data/`, `build.py`, `README.md`).
   - Website: **Add file → Upload files**, drag the folder contents in, **Commit**.
   - Or Terminal: `cd ~/Desktop/Part_2_QnA && git init && git add . && git commit -m "Part 2 QnA" && git branch -M main && git remote add origin https://github.com/<you>/part2-qna.git && git push -u origin main`
3. Repository **Settings → Pages → Source: Deploy from a branch → main / (root) → Save**.
4. After about a minute it's live at `https://<you>.github.io/part2-qna/`.
   On iPhone: open it in Safari → Share → **Add to Home Screen** to get an app icon.

Every time you add a chapter: run `build.py`, then upload/commit the changed files.

## Files

| File | What it is |
|---|---|
| `index.html` | The app page |
| `app.js` | App logic (sessions, scoring, timer, review, storage) |
| `styles.css` | Look and feel (light + dark mode) |
| `questions.js` | Generated question bundle – don't edit by hand |
| `data/chNNN.json` | One file per daily topic – edit these |
| `build.py` | Bundles `data/` into `questions.js` |
