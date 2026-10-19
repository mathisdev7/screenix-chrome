let frame = 0;

function tick() {
  frame++;
  document.getElementById("counter").textContent = `${document.title} · frame ${frame}`;
  requestAnimationFrame(tick);
}

tick();

document.getElementById("route").addEventListener("click", () => {
  history.pushState({}, "", `?route=${Date.now()}`);
  document.body.style.background = "#1e3a8a";
  document.getElementById("label").textContent = "In-page route changed";
});
