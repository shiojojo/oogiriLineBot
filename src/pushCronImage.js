// Return a random image URL/text from the '画像' sheet (col 2)
function OdaiImage() {
  return getRandomFromSheet('画像', 2);
}

function linePushImage() {
  // Sync latest answers to tsukkomi before pushing
  try {
    syncTextTopicAnswersToTsukkomi();
  } catch (error) {
    Logger.log('Sync failed before push: ' + error.message);
    // Continue with push even if sync fails
  }

  const odaiImage = OdaiImage();
  const lineUserId = getScriptConfig_('LINE_USERID');

  if (lineUserId) {
    setGroupOdaiValue(lineUserId, odaiImage);
    const messages = [
      createTextMessage('写真でひとこと'),
      createTextMessage(odaiImage),
      createImageMessage(odaiImage),
    ];
    sendPushToLine(lineUserId, messages);
  } else {
    Logger.log('linePushImage aborted: LINE_USERID is not set');
  }
}
