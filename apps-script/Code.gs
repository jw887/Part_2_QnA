/**
 * Part 2 QnA – wrong-answer sync to Google Drive.
 *
 * Deploy once as a Web app (Execute as: Me, Who has access: Anyone).
 * The app POSTs each wrong answer here; this script appends it to a Google Sheet
 * called "Part 2 QnA – Wrong Answers" in your Drive (created automatically on first use).
 *
 * Optional: set TOKEN to any secret word and enter the same word in the app's Settings.
 */
const TOKEN = '';                       // e.g. 'selayang2029' – leave '' to disable
const SHEET_TITLE = 'Part 2 QnA – Wrong Answers';
const TAB = 'Wrong answers';
const HEADERS = ['Logged at', 'Chapter', 'Topic', 'Question ID', 'Question', 'Options',
  'My answer', 'Correct answer', 'Explanation', 'Source', 'Mode', 'Times attempted',
  'Times correct', 'My notes', 'Status'];

function sheet_() {
  const props = PropertiesService.getScriptProperties();
  let ss = null;
  const id = props.getProperty('SHEET_ID');
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  if (!ss) {
    ss = SpreadsheetApp.create(SHEET_TITLE);
    props.setProperty('SHEET_ID', ss.getId());
    const sh = ss.getSheets()[0];
    sh.setName(TAB);
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#16243f').setFontColor('#ffffff');
    sh.setColumnWidth(5, 420); sh.setColumnWidth(6, 320); sh.setColumnWidth(9, 420);
  }
  return ss.getSheetByName(TAB) || ss.getSheets()[0];
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const data = JSON.parse(e.postData.contents || '{}');
    if (TOKEN && data.token !== TOKEN) return json_({ ok: false, error: 'bad token' });
    const items = data.items || [];
    if (!items.length) return json_({ ok: true, n: 0 });
    const rows = items.map(it => [
      new Date(it.t || Date.now()), it.ch, it.chTitle, it.id, it.stem,
      (it.options || []).map((o, i) => 'ABCDE'[i] + '. ' + o).join('\n'),
      it.pick, it.correct, it.explanation, it.ref, it.mode, it.n, it.nOk, it.note || '', 'To review'
    ]);
    const sh = sheet_();
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, HEADERS.length).setValues(rows)
      .setWrap(true).setVerticalAlignment('top');
    return json_({ ok: true, n: rows.length, sheet: sh.getParent().getUrl() });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return json_({ ok: true, service: 'Part 2 QnA wrong-answer sync', sheet: sheet_().getParent().getUrl() });
}
