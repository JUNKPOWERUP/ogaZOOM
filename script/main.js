document.getElementById("enter-button").addEventListener("click", () => {
  const pw = document.getElementById("password").value;
  const correctPW = "シコッター";

  if (pw === correctPW) {
    // ロック解除
    document.getElementById("lock-screen").style.display = "none";
    document.getElementById("main-screen").style.display = "block";
  } else {
    // エラーメッセージ表示
    document.getElementById("error-msg").style.display = "block";
  }
});
