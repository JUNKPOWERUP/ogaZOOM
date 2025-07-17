const correctPW = "0721";

// ローカルストレージ確認（以前ログイン済みなら即表示）
if (localStorage.getItem("sikotter-auth") === "ok") {
  showMainScreen();
}

document.getElementById("enter-button").addEventListener("click", () => {
  const pw = document.getElementById("password").value;

  if (pw === correctPW) {
    localStorage.setItem("sikotter-auth", "ok");
    showMainScreen();
  } else {
    document.getElementById("error-msg").style.display = "block";
  }
});

function showMainScreen() {
  document.getElementById("lock-screen").style.display = "none";
  document.getElementById("main-screen").style.display = "block";
}
