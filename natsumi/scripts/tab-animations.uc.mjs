class NatsumiTabAnimationManager {
    constructor() {
        this.openingTabs = new WeakSet();
        this.animationTimers = new WeakMap();
        this.pageTransitionElement = null;
        this.pendingPageTransition = null;
        this.pageTransitionFrame = null;
        this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    }

    init() {
        const tabContainer = window.gBrowser?.tabContainer;
        if (!tabContainer) {
            return;
        }

        tabContainer.addEventListener("TabOpen", (event) => this.onTabOpen(event));
        tabContainer.addEventListener("TabSelect", (event) => this.onTabSelect(event));
        window.gBrowser.addEventListener("TabSwitched", (event) => this.onTabSwitched(event));
    }

    onTabOpen(event) {
        const tab = event.target;
        if (!tab?.classList?.contains("tabbrowser-tab")) {
            return;
        }

        this.openingTabs.add(tab);
        window.requestAnimationFrame(() => this.runTabOpenAnimation(tab));
    }

    onTabSelect(event) {
        const tab = event.target;
        const previousTab = event.detail?.previousTab;
        if (
            !tab?.classList?.contains("tabbrowser-tab") ||
            tab !== window.gBrowser.selectedTab ||
            !previousTab ||
            previousTab === tab
        ) {
            return;
        }

        if (!this.openingTabs.has(tab)) {
            this.restartAnimation(tab, "natsumi-tab-switch-animation", "", 167);
        }

        const tabContainer = window.gBrowser.tabContainer;
        if (tabContainer.getAttribute("orient") === "vertical") {
            this.clearPageTransition();
            this.runPageTransition("refresh");
        } else {
            const tabIndex = tab.index ?? tab._tPos;
            const previousTabIndex = previousTab.index ?? previousTab._tPos;
            if (tabIndex > previousTabIndex) {
                this.queuePageTransition(tab, "slide-from-right");
            } else if (tabIndex < previousTabIndex) {
                this.queuePageTransition(tab, "slide-from-left");
            } else {
                this.clearPageTransition();
            }
        }
    }

    onTabSwitched(event) {
        const tab = event.detail?.tab;
        if (tab && tab === this.pendingPageTransition?.tab) {
            this.startPendingPageTransition(tab);
        }
    }

    runTabOpenAnimation(tab) {
        if (!tab.isConnected || this.reducedMotion.matches) {
            this.openingTabs.delete(tab);
            return;
        }

        const tabWidth = tab.getBoundingClientRect().width;
        const tabHeight = tab.getBoundingClientRect().height;
        const paddingLeft = window.getComputedStyle(tab).paddingLeft;
        const paddingRight = window.getComputedStyle(tab).paddingRight;
        const paddingTop = window.getComputedStyle(tab).paddingTop;
        const paddingBottom = window.getComputedStyle(tab).paddingBottom;

        tab.style.setProperty("--natsumi-animation-width", `calc(${tabWidth}px - ${paddingLeft} - ${paddingRight})`);
        tab.style.setProperty("--natsumi-animation-height", `calc(${tabHeight}px - ${paddingTop} - ${paddingBottom})`);
        this.restartAnimation(tab, "natsumi-animation", "", 250, () => {
            this.openingTabs.delete(tab);
        });
    }

    queuePageTransition(tab, type, duration = 300) {
        this.clearPageTransition();
        this.pendingPageTransition = { tab, type, duration };

        // A cached tab can become visually selected before TabSelect fires.
        // Otherwise TabSwitched will start the transition once its layers are ready.
        if (tab.hasAttribute("visuallyselected")) {
            this.startPendingPageTransition(tab);
        }
    }

    startPendingPageTransition(tab) {
        const pendingTransition = this.pendingPageTransition;
        if (!pendingTransition || pendingTransition.tab !== tab || this.pageTransitionFrame) {
            return;
        }

        // TabSwitched is dispatched just before the refresh driver tick that
        // makes the incoming browser visible. Start on that paint boundary so
        // the animation's first frame is not consumed while the panel is hidden.
        this.pageTransitionFrame = window.requestAnimationFrame(() => {
            this.pageTransitionFrame = null;
            if (
                this.pendingPageTransition !== pendingTransition ||
                pendingTransition.tab !== window.gBrowser.selectedTab
            ) {
                return;
            }

            this.pendingPageTransition = null;
            this.runPageTransition(
                pendingTransition.type,
                pendingTransition.duration,
                pendingTransition.tab.linkedBrowser
            );
        });
    }

    runPageTransition(type, duration = 300, browser = window.gBrowser.selectedBrowser) {
        const pageViewport = browser?.closest(".browserStack") ?? browser;
        if (this.pageTransitionElement && this.pageTransitionElement !== pageViewport) {
            this.stopAnimation(this.pageTransitionElement, "natsumi-page-transition");
        }

        this.pageTransitionElement = pageViewport;
        this.restartAnimation(pageViewport, "natsumi-page-transition", type, duration, () => {
            if (this.pageTransitionElement === pageViewport) {
                this.pageTransitionElement = null;
            }
        });
    }

    clearPageTransition() {
        if (this.pageTransitionFrame) {
            window.cancelAnimationFrame(this.pageTransitionFrame);
            this.pageTransitionFrame = null;
        }
        this.pendingPageTransition = null;

        if (this.pageTransitionElement) {
            this.stopAnimation(this.pageTransitionElement, "natsumi-page-transition");
            this.pageTransitionElement = null;
        }
    }

    stopAnimation(element, attribute) {
        const timer = this.animationTimers.get(element);
        if (timer) {
            window.clearTimeout(timer);
            this.animationTimers.delete(element);
        }
        element?.removeAttribute(attribute);
    }

    restartAnimation(element, attribute, value, duration, onFinish = null) {
        if (!element) {
            onFinish?.();
            return;
        }

        this.stopAnimation(element, attribute);
        if (this.reducedMotion.matches) {
            onFinish?.();
            return;
        }

        void element.getBoundingClientRect().width;
        element.setAttribute(attribute, value);

        const timer = window.setTimeout(() => {
            if (this.animationTimers.get(element) !== timer) {
                return;
            }
            element.removeAttribute(attribute);
            this.animationTimers.delete(element);
            onFinish?.();
        }, duration + 50);
        this.animationTimers.set(element, timer);
    }
}

if (!document.body.natsumiTabAnimationManager) {
    document.body.natsumiTabAnimationManager = new NatsumiTabAnimationManager();
    document.body.natsumiTabAnimationManager.init();
}
