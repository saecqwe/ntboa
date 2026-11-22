/**
 * Lightweight in-app navigation history tracker.
 * Prevents router.back() from exiting the app or returning to a blank Safari Start Page / login screen.
 */

let inAppNavStack = [];

export const recordPathname = (pathname) => {
  if (!pathname || typeof pathname !== 'string') return;
  const top = inAppNavStack[inAppNavStack.length - 1];
  if (top === pathname) return;

  // Detect browser/router back navigation to the immediately previous in-app entry
  if (inAppNavStack.length >= 2 && inAppNavStack[inAppNavStack.length - 2] === pathname) {
    inAppNavStack.pop();
    return;
  }

  inAppNavStack.push(pathname);
  if (inAppNavStack.length > 50) {
    inAppNavStack = inAppNavStack.slice(-50);
  }
};

export const resetInAppHistory = () => {
  inAppNavStack = [];
};

export const canGoBackInApp = () => {
  if (inAppNavStack.length <= 1) return false;
  const prev = inAppNavStack[inAppNavStack.length - 2];
  if (!prev || prev === '/' || prev.endsWith('/login')) return false;
  return true;
};

export const getFallbackBackRoute = (pathname = '') => {
  if (!pathname || typeof pathname !== 'string') return '/';
  if (pathname.startsWith('/admin/referees/')) return '/admin/referees';
  if (pathname.startsWith('/admin/evaluators/')) return '/admin/evaluators';
  if (pathname.startsWith('/admin/evaluations/')) return '/admin/evaluations';
  if (pathname.startsWith('/admin')) return '/admin/dashboard';
  if (pathname.startsWith('/evaluator/evaluation/')) return '/evaluator/evaluations';
  if (pathname.startsWith('/evaluator')) return '/evaluator/home';
  if (pathname.startsWith('/referee')) return '/referee/home';
  return '/';
};

export const safeGoBack = (router, pathname, fallbackHref) => {
  if (canGoBackInApp()) {
    router.back();
  } else {
    router.push(fallbackHref || getFallbackBackRoute(pathname));
  }
};
