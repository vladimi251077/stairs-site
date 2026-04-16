// SCROLL ANIMATION (как Apple)
const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if(entry.isIntersecting){
      entry.target.classList.add("show");
    }
  });
});

document.querySelectorAll(".fade-up").forEach(el => {
  observer.observe(el);
});

// HEADER BLUR
window.addEventListener("scroll", () => {
  const header = document.querySelector(".header");

  if(window.scrollY > 10){
    header.style.background = "rgba(0,0,0,.8)";
  } else {
    header.style.background = "rgba(0,0,0,.6)";
  }
});

// PARALLAX
document.addEventListener("mousemove", e => {
  const img = document.querySelector(".parallax img");
  if(!img) return;

  let x = (e.clientX / window.innerWidth - 0.5) * 20;
  let y = (e.clientY / window.innerHeight - 0.5) * 20;

  img.style.transform = `translate(${x}px, ${y}px) scale(1.03)`;
});
