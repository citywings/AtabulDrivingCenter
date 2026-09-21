/**
 * REVIEWS CAROUSEL — user-controlled, accessible carousel.
 * Replaces the auto-scrolling marquee with manual navigation.
 */

function getCardsPerView(): number {
  const width = window.innerWidth;
  if (width < 480) return 1;
  if (width < 768) return 2;
  if (width < 1024) return 3;
  return 4;
}

function getCardWidth(track: HTMLElement): number {
  const card = track.querySelector<HTMLElement>(".tcard");
  if (!card) return 0;
  const trackStyle = getComputedStyle(track);
  const gap = parseFloat(trackStyle.gap) || 24;
  return card.offsetWidth + gap;
}

export function init() {
  const container = document.querySelector<HTMLElement>("[data-carousel]");
  const track = container?.querySelector<HTMLElement>("[data-carousel-track]");
  const prevBtn = container?.querySelector<HTMLButtonElement>("[data-carousel-prev]");
  const nextBtn = container?.querySelector<HTMLButtonElement>("[data-carousel-next]");
  const dotsContainer = container?.querySelector<HTMLElement>("[data-carousel-dots]");

  if (!container || !track || !prevBtn || !nextBtn || !dotsContainer) return;

  const cards = [...track.querySelectorAll<HTMLElement>(".tcard")];
  if (cards.length === 0) return;

  // Non-null assertions since we've verified them above
  const t = track!;
  const prev = prevBtn!;
  const next = nextBtn!;
  const dots = dotsContainer!;

  let currentIndex = 0;
  let isTransitioning = false;
  let touchStartX = 0;
  let touchStartIndex = 0;
  let touchMoved = false;

  function createDots(): void {
    const cardsPerView = getCardsPerView();
    const totalPages = Math.ceil(cards.length / cardsPerView);
    dots.innerHTML = "";
    for (let i = 0; i < totalPages; i++) {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "carousel-dot";
      dot.setAttribute("aria-label", `Go to review group ${i + 1} of ${totalPages}`);
      dot.setAttribute("role", "tab");
      dot.setAttribute("aria-selected", i === 0 ? "true" : "false");
      dot.addEventListener("click", () => goToPage(i));
      dots.appendChild(dot);
    }
    updateDots();
  }

  function updateDots(): void {
    const cardsPerView = getCardsPerView();
    const currentPage = Math.floor(currentIndex / cardsPerView);
    const dotElements = dots.querySelectorAll(".carousel-dot");
    dotElements.forEach((dot, i) => {
      dot.setAttribute("aria-selected", i === currentPage ? "true" : "false");
    });
  }

  function updateButtons(): void {
    const cardsPerView = getCardsPerView();
    const maxIndex = Math.max(0, cards.length - cardsPerView);
    prev.disabled = currentIndex <= 0;
    next.disabled = currentIndex >= maxIndex;
    prev.setAttribute("aria-disabled", String(currentIndex <= 0));
    next.setAttribute("aria-disabled", String(currentIndex >= maxIndex));
  }

  function goToIndex(index: number): void {
    if (isTransitioning) return;
    const cardsPerView = getCardsPerView();
    const maxIndex = Math.max(0, cards.length - cardsPerView);
    const clampedIndex = Math.max(0, Math.min(index, maxIndex));

    if (clampedIndex === currentIndex) return;

    isTransitioning = true;
    const cardWidth = getCardWidth(t);
    const offset = -clampedIndex * cardWidth;

    t.style.transform = `translateX(${offset}px)`;
    currentIndex = clampedIndex;

    t.addEventListener(
      "transitionend",
      () => {
        isTransitioning = false;
      },
      { once: true }
    );

    // Safety timeout: reset isTransitioning if transitionend doesn't fire
    // (e.g., if transition is interrupted or duration is 0)
    setTimeout(() => {
      isTransitioning = false;
    }, 500);

    updateButtons();
    updateDots();
  }

  function goToPage(page: number): void {
    const cardsPerView = getCardsPerView();
    goToIndex(page * cardsPerView);
  }

  function goToPrev(): void {
    const cardsPerView = getCardsPerView();
    goToIndex(currentIndex - cardsPerView);
  }

  function goToNext(): void {
    const cardsPerView = getCardsPerView();
    goToIndex(currentIndex + cardsPerView);
  }

  function handleResize(): void {
    createDots();
    goToIndex(0);
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      goToPrev();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      goToNext();
    }
  }

  function handleTouchStart(): void {
    // Reset any stuck transition state from previous interrupted transitions
    isTransitioning = false;
    touchStartX = 0;
    touchStartIndex = currentIndex;
    touchMoved = false;
  }

  function handleTouchMove(e: TouchEvent): void {
    if (touchStartX === 0) {
      touchStartX = e.touches[0].clientX;
      touchStartIndex = currentIndex;
    }

    const deltaX = e.touches[0].clientX - touchStartX;
    // Only treat as swipe if moved more than 10px (prevents accidental drag during scroll)
    if (Math.abs(deltaX) > 10) {
      touchMoved = true;
    }
    if (!touchMoved) return;

    const cardWidth = getCardWidth(t);
    const offset = -touchStartIndex * cardWidth + deltaX;
    t.style.transition = "none";
    t.style.transform = `translateX(${offset}px)`;
  }

  function handleTouchEnd(e: TouchEvent): void {
    if (!touchMoved) {
      t.style.transition = "";
      return;
    }

    const endX = e.changedTouches[0].clientX;
    const deltaX = endX - touchStartX;
    const threshold = 50; // Minimum swipe distance

    t.style.transition = "";

    if (Math.abs(deltaX) > threshold) {
      if (deltaX < 0) {
        // Swiped left -> go next
        goToNext();
      } else {
        // Swiped right -> go prev
        goToPrev();
      }
    } else {
      // Swipe too short, snap back to current page
      goToIndex(touchStartIndex);
    }
  }

  prev.addEventListener("click", goToPrev);
  next.addEventListener("click", goToNext);
  container.addEventListener("keydown", handleKeydown);
  t.addEventListener("touchstart", handleTouchStart, { passive: true });
  t.addEventListener("touchmove", handleTouchMove, { passive: true });
  t.addEventListener("touchend", handleTouchEnd, { passive: true });
  window.addEventListener("resize", handleResize, { passive: true });

  createDots();
  updateButtons();
}