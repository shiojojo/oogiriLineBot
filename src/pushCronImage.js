// Return a random image URL/text from the '画像' sheet (col 2)
function OdaiImage() {
  return getRandomFromSheet('画像', 2);
}

function linePushImage() {
  const odaiImage = OdaiImage();

  // Update group sheet if it exists
  if (typeof LINE_USERID !== 'undefined' && LINE_USERID) {
    setGroupOdaiValue(LINE_USERID, odaiImage);

    // Use shared helper to push messages
    const messages = [
      createTextMessage('写真でひとこと'),
      createTextMessage(odaiImage),
      createImageMessage(odaiImage),
    ];
    sendPushToLine(LINE_USERID, messages);
  } else {
    Logger.log('linePushImage aborted: LINE_USERID is not set');
  }
}
