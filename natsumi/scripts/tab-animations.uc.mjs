class NatsumiTabAnimationManager {
    constructor() {
        this.openingTabs = new WeakSet();
        this.animationTimers = new WeakMap();
        this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    }

    init() {
        const tabContainer = window.gBrowser?.tabContainer;
        if (!tabContainer) {
            return;
        }

        tabContainer.addEventListener("TabOpen", (event) => this.onTabOpen(event));
        tabContainer.addEventListener("TabSelect", (event) => this.onTabSelect(event));
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
        this.runPageTransition("refresh");
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

    runPageTransition(direction) {
        // Start on the incoming browser at selection time. If Firefox needs to
        // wait for its layer, the animation expires instead of playing late.
        const browser = window.gBrowser.selectedBrowser;
        const pageViewport = browser?.closest(".browserStack") ?? browser;
        this.restartAnimation(pageViewport, "natsumi-page-transition", direction, 250);
    }

    restartAnimation(element, attribute, value, duration, onFinish = null) {
        if (!element || this.reducedMotion.matches) {
            onFinish?.();
            return;
        }

        const previousTimer = this.animationTimers.get(element);
        if (previousTimer) {
            window.clearTimeout(previousTimer);
        }

        element.removeAttribute(attribute);
        void element.getBoundingClientRect().width;
        element.setAttribute(attribute, value);

        const timer = window.setTimeout(() => {
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
