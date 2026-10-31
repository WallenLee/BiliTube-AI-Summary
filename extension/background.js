// Enable opening the side panel when the toolbar icon is clicked
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error("[Background] Error enabling sidepanel behavior:", error));

chrome.runtime.onInstalled.addListener(() => {
  console.log("[Background] AI 视频总结与思维导图插件已安装/加载完成。");
});
