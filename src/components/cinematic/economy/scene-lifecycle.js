/* Each mounted scene owns its DOM listeners and observers. */
export function sceneLifecycle() {
  const controller = new AbortController();
  const observers = [];
  return {
    listen(target, event, callback, options = {}) {
      target.addEventListener(event, callback, { ...options, signal: controller.signal });
    },
    observe(callback, options) {
      const observer = new IntersectionObserver(callback, options);
      observers.push(observer);
      return observer;
    },
    dispose() {
      controller.abort();
      for (const observer of observers) observer.disconnect();
    },
  };
}
