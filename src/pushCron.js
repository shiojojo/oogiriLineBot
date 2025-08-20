function OdaiMessageCron() {
  return getRandomFromSheet('お題', 2);
}

function linePush() {
  const odai = OdaiMessageCron();

  if (typeof LINE_USERID !== 'undefined' && LINE_USERID) {
    // update group sheet if exists
    setGroupOdaiValue(LINE_USERID, odai);

    // push two messages: label and the actual odai
    const messages = [createTextMessage('お題'), createTextMessage(odai)];
    sendPushToLine(LINE_USERID, messages);
  } else {
    Logger.log('linePush aborted: LINE_USERID is not set');
  }
}
