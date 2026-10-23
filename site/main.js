(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  ready(function () {
    document.getElementById("year").textContent = new Date().getFullYear();

    var header = document.querySelector("[data-header]");
    function onScroll() {
      if (!header) return;
      header.classList.toggle("is-scrolled", window.scrollY > 8);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    var toggle = document.querySelector("[data-menu-toggle]");
    var menu = document.querySelector("[data-mobile-menu]");
    if (toggle && menu) {
      toggle.addEventListener("click", function () {
        var open = toggle.getAttribute("aria-expanded") === "true";
        toggle.setAttribute("aria-expanded", String(!open));
        menu.hidden = open;
        menu.classList.toggle("is-open", !open);
      });
      menu.addEventListener("click", function (event) {
        if (event.target === menu || event.target.tagName === "A") {
          toggle.setAttribute("aria-expanded", "false");
          menu.hidden = true;
          menu.classList.remove("is-open");
        }
      });
    }

    var revealItems = Array.prototype.slice.call(document.querySelectorAll("[data-reveal]"));
    revealItems.forEach(function (item) {
      var siblings = item.parentElement
        ? Array.prototype.filter.call(item.parentElement.children, function (child) {
            return child.hasAttribute("data-reveal");
          })
        : [];
      var index = Math.max(0, siblings.indexOf(item));
      item.style.setProperty("--reveal-delay", Math.min(index, 5) * 70 + "ms");
    });

    if (reduced || !("IntersectionObserver" in window)) {
      revealItems.forEach(function (item) {
        item.classList.add("is-visible");
      });
      document.querySelectorAll("[data-count]").forEach(function (el) {
        el.textContent = formatCount(Number(el.getAttribute("data-count"))) + (el.getAttribute("data-suffix") || "");
      });
    } else {
      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);

            entry.target.querySelectorAll("[data-count]").forEach(countUp);
            if (entry.target.hasAttribute("data-count")) countUp(entry.target);
          });
        },
        { rootMargin: "0px 0px -8% 0px", threshold: 0.15 },
      );

      revealItems.forEach(function (item) {
        observer.observe(item);
      });
    }

    document.querySelectorAll(".faq details").forEach(function (detail) {
      if (reduced) return;
      detail.addEventListener("toggle", function () {
        if (!detail.open) return;
        document.querySelectorAll(".faq details").forEach(function (other) {
          if (other !== detail) other.open = false;
        });
      });
    });
  });

  function formatCount(value) {
    return value.toLocaleString("en-US");
  }

  function countUp(el) {
    if (el.dataset.counted === "true") return;
    el.dataset.counted = "true";

    var target = Number(el.getAttribute("data-count")) || 0;
    var suffix = el.getAttribute("data-suffix") || "";
    if (reduced || target === 0) {
      el.textContent = formatCount(target) + suffix;
      return;
    }

    var duration = 1200;
    var start = null;

    function frame(timestamp) {
      if (start === null) start = timestamp;
      var progress = Math.min((timestamp - start) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = formatCount(Math.round(target * eased)) + suffix;
      if (progress < 1) requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  }
})();
