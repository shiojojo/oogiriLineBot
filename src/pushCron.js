function OdaiMessageCron() {
  return getRandomFromSheet('お題', 2);
}

function linePush() {
  // Sync latest answers to tsukkomi before pushing
  try {
    syncTextTopicAnswersToTsukkomi();
  } catch (error) {
    Logger.log('Sync failed before push: ' + error.message);
    // Continue with push even if sync fails
  }

  const odai = OdaiMessageCron();
  const lineUserId = getScriptConfig_('LINE_USERID');

  if (lineUserId) {
    setGroupOdaiValue(lineUserId, odai);
    const messages = [createTextMessage('お題'), createTextMessage(odai)];
    sendPushToLine(lineUserId, messages);
  } else {
    Logger.log('linePush aborted: LINE_USERID is not set');
  }
}
